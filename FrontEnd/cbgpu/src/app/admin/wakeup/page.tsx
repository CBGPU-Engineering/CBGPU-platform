'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { format } from 'date-fns';
import { ShieldAlert, X, Play, Pause, Square, SkipForward, ListMusic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import { loadYoutubeIframeApi, type YTPlayer } from '@/lib/youtubePlayer';

const DORMS = ['청운학사', '사름학사'] as const;
type Dorm = typeof DORMS[number];
const DORM_KEY = 'cbgpu.admin.wakeup.dorm';
const SONGS_PER_DAY = 8;

// 그날 신청곡이 8개가 안 채워지면 나머지 자리는 이 곡으로 채운다 — 하루 재생
// 목록은 항상 정확히 8곡. 실제 DB 행이 없는 가짜 항목이라 재생 완료 처리 대상이
// 아니고(markPlayed에서 걸러짐), 대기열/전체 목록에는 나타나지 않는다.
const FILLER_VIDEO_ID = 'gFx-NjTw3sM';
function makeFillerSong(index: number) {
  return {
    id: null,
    isFiller: true,
    title: '기본 기상송 (자동 채움)',
    thumbnail_url: `https://i.ytimg.com/vi/${FILLER_VIDEO_ID}/hqdefault.jpg`,
    youtube_video_id: FILLER_VIDEO_ID,
    _key: `filler-${index}`,
  };
}

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function AdminWakeupPage() {
  const { isWakeupManager, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  const [dorm, setDorm] = useState<Dorm>(DORMS[0]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DORM_KEY);
      if (saved && (DORMS as readonly string[]).includes(saved)) setDorm(saved as Dorm);
    } catch { /* localStorage unavailable */ }
  }, []);
  const changeDorm = (value: string) => {
    endSession();
    setDorm(value as Dorm);
    try { localStorage.setItem(DORM_KEY, value); } catch { /* best-effort only */ }
  };

  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── 재생: 하루 정확히 8곡(모자라면 기본 기상송으로 채움), 실제로 끝까지
  // 재생된 곡만 '재생 완료'로 기록 ──────────────────────────────────────
  const playerRef = useRef<YTPlayer | null>(null);
  const [session, setSession] = useState<any[] | null>(null);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const nowPlaying = session?.[sessionIndex] ?? null;

  // onStateChange below is registered once, the first time the player is
  // created, and never re-registered — so it must never call `advance`
  // directly (that would freeze it to whatever `session`/`sessionIndex` were
  // at that one render, forever). advanceRef always points at the latest
  // `advance` closure instead, kept current every render below.
  const advanceRef = useRef<(markCurrentPlayed: boolean) => void>(() => {});

  const ensurePlayer = async () => {
    if (playerRef.current) return playerRef.current;
    await loadYoutubeIframeApi();
    return new Promise<YTPlayer>((resolve) => {
      const player = new window.YT!.Player('wakeup-yt-player', {
        height: '200', width: '100%',
        playerVars: { autoplay: 1, rel: 0 },
        events: {
          onReady: () => { playerRef.current = player; resolve(player); },
          onStateChange: (event: { data: number }) => {
            if (event.data === window.YT!.PlayerState.ENDED) advanceRef.current(true);
          },
        },
      });
    });
  };

  const markPlayed = async (song: any) => {
    if (!song || song.isFiller) return;
    await supabase.from('wakeup_songs').update({ status: 'played', played_at: new Date().toISOString() }).eq('id', song.id);
  };

  const startSession = async () => {
    const today = [...queue.slice(0, SONGS_PER_DAY)];
    while (today.length < SONGS_PER_DAY) today.push(makeFillerSong(today.length));
    setSession(today);
    setSessionIndex(0);
    setPaused(false);
    const player = await ensurePlayer();
    player.loadVideoById(today[0].youtube_video_id);
  };

  const endSession = () => {
    playerRef.current?.stopVideo();
    setSession(null);
    setSessionIndex(0);
    setPaused(false);
  };

  // markCurrentPlayed=true는 노래가 실제로 끝까지 재생됐을 때만(onStateChange
  // ENDED) — 건너뛰기나 정지로는 절대 '재생 완료' 처리하지 않는다. 기숙사에
  // 아무도 없어서 그날 아예 재생을 안 하는 날도 있으니, 재생 안 된 곡은 다음
  // 기회에 다시 대기열 맨 앞에 남아 있어야 한다.
  const advance = async (markCurrentPlayed: boolean) => {
    const current = nowPlaying;
    if (markCurrentPlayed && current) await markPlayed(current);
    const nextIndex = sessionIndex + 1;
    if (session && nextIndex < session.length) {
      setSessionIndex(nextIndex);
      setPaused(false);
      playerRef.current?.loadVideoById(session[nextIndex].youtube_video_id);
    } else {
      endSession();
      if (markCurrentPlayed) showSuccess('오늘 재생을 모두 마쳤어요.');
      fetchAll();
    }
  };
  useEffect(() => { advanceRef.current = advance; });

  const togglePause = () => {
    if (paused) { playerRef.current?.playVideo(); setPaused(false); }
    else { playerRef.current?.pauseVideo(); setPaused(true); }
  };

  // 신청은 즉시 승인 상태로 들어오므로 검토 대기열은 없다 — 담당자는
  // 오늘 재생될 곡 중 부적절한 것만 사후에 거절한다.
  const fetchAll = async () => {
    const { data, error } = await supabase
      .from('wakeup_songs')
      .select('*, profiles:user_id (full_name, student_id)')
      .eq('dorm', dorm)
      .eq('status', 'approved')
      .eq('play_date', todayStr())
      .order('created_at', { ascending: true });
    if (!error) setQueue(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && isWakeupManager) { setLoading(true); fetchAll(); }
    else if (!authLoading) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isWakeupManager, dorm]);

  const reject = async (id: string) => {
    const { error } = await supabase.from('wakeup_songs').update({ status: 'rejected', reject_reason: rejectReason.trim() || null }).eq('id', id);
    if (error) showError('거절 실패: ' + error.message);
    else { showSuccess('거절했어요.'); setRejectingId(null); setRejectReason(''); fetchAll(); }
  };

  if (authLoading || loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoadingSpinner size={48} /></div>;
  }

  if (!isWakeupManager) {
    return (
      <div className="max-w-sm mx-auto mt-16 text-center space-y-4">
        <ShieldAlert className="size-12 mx-auto text-destructive" />
        <p className="font-bold">기상송 담당자만 볼 수 있는 페이지예요.</p>
        <Button onClick={() => router.push('/')}>홈으로</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-black italic tracking-tighter">기상송 관리</h1>
        <SegmentedTabs items={DORMS.map(d => ({ value: d, label: d }))} value={dorm} onChange={changeDorm} />
      </div>

      {/* ── 재생 ─────────────────────────────────────────────────────── */}
      <section className="rounded-[28px] border border-primary/15 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ListMusic className="size-5 text-primary" />
          <h2 className="text-lg font-black">{dorm} 오늘 재생</h2>
          <Badge variant="default">신청곡 {queue.length}곡</Badge>
        </div>

        <div id="wakeup-yt-player" className={nowPlaying ? 'rounded-2xl overflow-hidden' : 'hidden'} />

        {nowPlaying ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
              {nowPlaying.thumbnail_url && (
                <Image src={nowPlaying.thumbnail_url} alt={nowPlaying.title} width={64} height={48} className="rounded-lg object-cover shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">재생 중 · {sessionIndex + 1}/{session?.length}</p>
                <p className="text-sm font-bold truncate">{nowPlaying.title}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={togglePause} className="flex-1">
                {paused ? <><Play className="size-4 mr-1.5" /> 재생</> : <><Pause className="size-4 mr-1.5" /> 일시정지</>}
              </Button>
              <Button variant="secondary" onClick={() => advance(false)} className="flex-1"><SkipForward className="size-4 mr-1.5" /> 건너뛰기</Button>
              <Button variant="secondary" onClick={endSession} className="flex-1"><Square className="size-4 mr-1.5" /> 정지</Button>
            </div>
          </div>
        ) : (
          <Button onClick={startSession} className="w-full py-5 font-black">
            <Play className="size-4 mr-1.5" /> 오늘 재생 시작 ({SONGS_PER_DAY}곡)
          </Button>
        )}

        {queue.length > 0 && !nowPlaying && (
          <ul className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
            {queue.slice(0, SONGS_PER_DAY).map((song, i) => (
              <li key={song.id} className="flex items-center gap-2 text-xs p-2 rounded-lg">
                <span className="text-muted-foreground font-black w-4 shrink-0">{i + 1}</span>
                <span className="truncate flex-1 font-semibold">{song.title}</span>
              </li>
            ))}
            {queue.length < SONGS_PER_DAY && (
              <li className="flex items-center gap-2 text-xs p-2 rounded-lg text-muted-foreground italic">
                <span className="font-black w-4 shrink-0">–</span>
                <span className="truncate flex-1">나머지 {SONGS_PER_DAY - queue.length}곡은 기본 기상송으로 채워져요</span>
              </li>
            )}
          </ul>
        )}

        <p className="text-[11px] text-muted-foreground">광고 없이 재생하려면 재생하는 기기에서 브레이브(Brave) 브라우저를 사용하세요.</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2"><h2 className="text-lg font-black">오늘 신청곡</h2><Badge variant="default">{queue.length}곡</Badge></div>
        {queue.length === 0 && <p className="text-sm text-muted-foreground">오늘로 신청된 곡이 없어요.</p>}
        {queue.map((song) => (
          <div key={song.id} className="rounded-2xl bg-card ring-1 ring-border/60 p-3 space-y-2">
            <div className="flex items-center gap-3">
              {song.thumbnail_url && <Image src={song.thumbnail_url} alt={song.title} width={56} height={42} className="rounded-lg object-cover shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{song.title}</p>
                <p className="text-xs text-muted-foreground truncate">{song.profiles?.full_name} ({song.profiles?.student_id})</p>
              </div>
            </div>
            {rejectingId === song.id ? (
              <div className="flex gap-2">
                <Input placeholder="거절 사유 (선택)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="flex-1" />
                <Button size="sm" variant="destructive" onClick={() => reject(song.id)}>거절 확정</Button>
                <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setRejectReason(''); }}>취소</Button>
              </div>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => setRejectingId(song.id)} className="w-full"><X className="size-3.5 mr-1" /> 거절</Button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

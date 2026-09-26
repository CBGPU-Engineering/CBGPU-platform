'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ShieldAlert, Check, X, Trash2, UserCog, Play, Pause, Square, SkipForward, ListMusic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { PersonSearchSelect } from '@/components/manufacturing/PersonSearchSelect';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import { loadYoutubeIframeApi, type YTPlayer } from '@/lib/youtubePlayer';

const DORMS = ['청운학사', '사름학사'] as const;
type Dorm = typeof DORMS[number];
const DORM_KEY = 'cbgpu.admin.wakeup.dorm';
const SONGS_PER_DAY = 8;

export default function AdminWakeupPage() {
  const { isAdmin, isWakeupManager, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();
  const canManage = isAdmin || isWakeupManager;

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

  const [pending, setPending] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── 재생: 하루 최대 8곡, 실제로 끝까지 재생된 곡만 '재생 완료'로 기록 ──────
  const playerRef = useRef<YTPlayer | null>(null);
  const [session, setSession] = useState<any[] | null>(null);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const nowPlaying = session?.[sessionIndex] ?? null;

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
            if (event.data === window.YT!.PlayerState.ENDED) advance(true);
          },
        },
      });
    });
  };

  const markPlayed = async (song: any) => {
    await supabase.from('wakeup_songs').update({ status: 'played', played_at: new Date().toISOString() }).eq('id', song.id);
  };

  const startSession = async () => {
    if (queue.length === 0) return;
    const today = queue.slice(0, SONGS_PER_DAY);
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

  const togglePause = () => {
    if (paused) { playerRef.current?.playVideo(); setPaused(false); }
    else { playerRef.current?.pauseVideo(); setPaused(true); }
  };

  // ── 기상송 담당자 지정 (진짜 사이트 관리자만) ────────────────────────────
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [newManagerId, setNewManagerId] = useState('');

  const fetchManagers = async () => {
    if (!isAdmin) return;
    const [allRes, managersRes] = await Promise.all([
      supabase.from('profiles').select('id, student_id, full_name').order('student_id'),
      supabase.from('profiles').select('id, student_id, full_name').eq('is_wakeup_manager', true).order('student_id'),
    ]);
    if (!allRes.error) setAllProfiles(allRes.data || []);
    if (!managersRes.error) setManagers(managersRes.data || []);
  };

  const addManager = async () => {
    if (!newManagerId) return;
    const { error } = await supabase.from('profiles').update({ is_wakeup_manager: true }).eq('id', newManagerId);
    if (error) showError('지정 실패: ' + error.message);
    else { showSuccess('기상송 담당자로 지정했어요.'); setNewManagerId(''); fetchManagers(); }
  };

  const removeManager = async (id: string) => {
    const { error } = await supabase.from('profiles').update({ is_wakeup_manager: false }).eq('id', id);
    if (error) showError('해제 실패: ' + error.message);
    else { showSuccess('담당자 지정을 해제했어요.'); fetchManagers(); }
  };

  const fetchAll = async () => {
    const [pendingRes, queueRes] = await Promise.all([
      supabase.from('wakeup_songs').select('*, profiles:user_id (full_name, student_id)').eq('dorm', dorm).eq('status', 'pending').order('created_at', { ascending: true }),
      supabase.from('wakeup_songs').select('*, profiles:user_id (full_name, student_id)').eq('dorm', dorm).eq('status', 'approved').order('created_at', { ascending: true }),
    ]);
    if (!pendingRes.error) setPending(pendingRes.data || []);
    if (!queueRes.error) setQueue(queueRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && canManage) { setLoading(true); fetchAll(); fetchManagers(); }
    else if (!authLoading) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canManage, dorm]);

  const approve = async (id: string) => {
    const { error } = await supabase.from('wakeup_songs').update({ status: 'approved' }).eq('id', id);
    if (error) showError('승인 실패: ' + error.message);
    else { showSuccess('승인했어요.'); fetchAll(); }
  };

  const reject = async (id: string) => {
    const { error } = await supabase.from('wakeup_songs').update({ status: 'rejected', reject_reason: rejectReason.trim() || null }).eq('id', id);
    if (error) showError('거절 실패: ' + error.message);
    else { showSuccess('거절했어요.'); setRejectingId(null); setRejectReason(''); fetchAll(); }
  };

  const removeFromQueue = async (id: string) => {
    const { error } = await supabase.from('wakeup_songs').delete().eq('id', id);
    if (error) showError('삭제 실패: ' + error.message);
    else { showSuccess('대기열에서 뺐어요.'); fetchAll(); }
  };

  if (authLoading || loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoadingSpinner size={48} /></div>;
  }

  if (!canManage) {
    return (
      <div className="max-w-sm mx-auto mt-16 text-center space-y-4">
        <ShieldAlert className="size-12 mx-auto text-destructive" />
        <p className="font-bold">관리자 또는 기상송 담당자만 볼 수 있는 페이지예요.</p>
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

      {isAdmin && (
        <section className="space-y-3 rounded-[28px] border border-border/60 bg-card p-5">
          <div className="flex items-center gap-2"><UserCog className="size-5 text-primary" /><h2 className="text-lg font-black">담당자 지정</h2></div>
          <div className="flex gap-2">
            <PersonSearchSelect candidates={allProfiles.filter(p => !managers.some(m => m.id === p.id))} value={newManagerId} onChange={setNewManagerId} />
            <Button onClick={addManager} disabled={!newManagerId}>추가</Button>
          </div>
          {managers.length > 0 && (
            <ul className="space-y-1.5">
              {managers.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm bg-muted/50 rounded-xl px-3 py-2">
                  <span className="font-bold">{m.full_name || 'Unknown'} <span className="text-muted-foreground opacity-60">({m.student_id || '-'})</span></span>
                  <Button size="icon-sm" variant="ghost" onClick={() => removeManager(m.id)} aria-label="담당자 해제"><X className="size-4 text-destructive" /></Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── 재생 ─────────────────────────────────────────────────────── */}
      <section className="rounded-[28px] border border-primary/15 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ListMusic className="size-5 text-primary" />
          <h2 className="text-lg font-black">{dorm} 재생</h2>
          <Badge variant="default">대기열 {queue.length}곡</Badge>
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
        ) : queue.length > 0 ? (
          <Button onClick={startSession} className="w-full py-5 font-black">
            <Play className="size-4 mr-1.5" /> 오늘 재생 시작 (최대 {SONGS_PER_DAY}곡)
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">대기열이 비어 있어요.</p>
        )}

        {queue.length > 0 && !nowPlaying && (
          <ul className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
            {queue.slice(0, SONGS_PER_DAY).map((song, i) => (
              <li key={song.id} className="flex items-center gap-2 text-xs p-2 rounded-lg">
                <span className="text-muted-foreground font-black w-4 shrink-0">{i + 1}</span>
                <span className="truncate flex-1 font-semibold">{song.title}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-muted-foreground">광고 없이 재생하려면 재생하는 기기에서 브레이브(Brave) 브라우저를 사용하세요.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-black">검토 대기 ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-muted-foreground">검토할 신청이 없어요.</p>}
        {pending.map((song) => (
          <div key={song.id} className="rounded-2xl bg-card ring-1 ring-border/60 p-3 space-y-2">
            <div className="flex items-center gap-3">
              {song.thumbnail_url && <Image src={song.thumbnail_url} alt={song.title} width={72} height={54} className="rounded-lg object-cover shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{song.title}</p>
                <p className="text-xs text-muted-foreground truncate">{song.channel_title} · {song.profiles?.full_name} ({song.profiles?.student_id})</p>
                {song.message && <p className="text-xs italic text-muted-foreground truncate">&quot;{song.message}&quot;</p>}
              </div>
            </div>
            {rejectingId === song.id ? (
              <div className="flex gap-2">
                <Input placeholder="거절 사유 (선택)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="flex-1" />
                <Button size="sm" variant="destructive" onClick={() => reject(song.id)}>거절 확정</Button>
                <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setRejectReason(''); }}>취소</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => approve(song.id)} className="flex-1"><Check className="size-3.5 mr-1" /> 승인</Button>
                <Button size="sm" variant="destructive" onClick={() => setRejectingId(song.id)} className="flex-1"><X className="size-3.5 mr-1" /> 거절</Button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2"><h2 className="text-lg font-black">전체 대기열</h2><Badge variant="default">{queue.length}곡</Badge></div>
        {queue.length === 0 && <p className="text-sm text-muted-foreground">대기열이 비어 있어요.</p>}
        {queue.map((song, i) => (
          <div key={song.id} className="flex items-center gap-3 rounded-2xl bg-card ring-1 ring-border/60 p-3">
            <span className="text-xs font-black text-muted-foreground w-4">{i + 1}</span>
            {song.thumbnail_url && <Image src={song.thumbnail_url} alt={song.title} width={56} height={42} className="rounded-lg object-cover shrink-0" />}
            <p className="text-sm font-bold truncate flex-1">{song.title}</p>
            <Button size="icon-sm" variant="ghost" onClick={() => removeFromQueue(song.id)} aria-label="대기열에서 제거"><Trash2 className="size-4 text-destructive" /></Button>
          </div>
        ))}
      </section>
    </div>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ShieldAlert, X, Play, Pause, Square, SkipForward, ListMusic, ExternalLink, ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import { loadYoutubeIframeApi, type YTPlayer } from '@/lib/youtubePlayer';
import { SONGS_PER_DAY } from '@/lib/wakeupFiller';
import ConfirmDialog from '@/components/ConfirmDialog';

const DORMS = ['청운학사', '사름학사'] as const;
type Dorm = typeof DORMS[number];
const DORM_KEY = 'cbgpu.admin.wakeup.dorm';

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'success' | 'warning' }> = {
  approved: { label: '재생 전', variant: 'default' },
  playing: { label: '재생 중', variant: 'warning' },
  played: { label: '재생 완료', variant: 'success' },
};

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function AdminWakeupPage() {
  const { user, isWakeupManager, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  // 지연 초기화로 첫 렌더에서 곧바로 저장된 기숙사를 읽는다 — 마운트 이펙트로
  // 나중에 고치면 그 사이에 기본값(청운학사)으로 먼저 fetch가 나가버려서
  // 새로고침할 때 잠깐 엉뚱한 기숙사 데이터가 보이는 문제가 있었다.
  const [dorm, setDorm] = useState<Dorm>(() => {
    try {
      const saved = localStorage.getItem(DORM_KEY);
      if (saved && (DORMS as readonly string[]).includes(saved)) return saved as Dorm;
    } catch { /* localStorage unavailable */ }
    return DORMS[0];
  });
  const changeDorm = (value: string) => {
    stopPlayback();
    setDorm(value as Dorm);
    try { localStorage.setItem(DORM_KEY, value); } catch { /* best-effort only */ }
  };

  const [queue, setQueue] = useState<any[]>([]);
  const [todayLineup, setTodayLineup] = useState<any[]>([]);
  const [allApproved, setAllApproved] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [aiFillers, setAiFillers] = useState<any[]>([]);
  const [fillingSongs, setFillingSongs] = useState(false);
  const [fillProgress, setFillProgress] = useState<{ done: number; total: number } | null>(null);
  const [legacyDeleteOpen, setLegacyDeleteOpen] = useState(false);
  const [deletingLegacy, setDeletingLegacy] = useState(false);

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

  // 학생들도 자기 신청곡이 재생 전/재생 중/재생 완료 중 어디쯤인지 볼 수 있게
  // status 자체로 남긴다 — 'playing'은 지금 스피커로 나가고 있는 딱 한 곡,
  // 건너뛰거나 정지하면(끝까지 재생 못 함) 다시 'approved'(재생 전)로 되돌아가
  // 다음 기회에 다시 대기열에 선다.
  const setSongStatus = async (song: any, status: 'playing' | 'approved' | 'played') => {
    if (!song || song.isFiller) return;
    const patch: Record<string, unknown> = { status };
    if (status === 'played') patch.played_at = new Date().toISOString();
    const { error } = await supabase.from('wakeup_songs').update(patch).eq('id', song.id);
    // RLS blocking this silently returns success with 0 rows changed, not an
    // error — so a failure here is worth surfacing loudly rather than eating
    // it, since it means the student-facing status just silently didn't move.
    if (error) showError(`상태 갱신 실패 (${song.title}): ${error.message}`);
  };

  const startSession = async () => {
    const fillers = await generateAiFillers();
    const lineup = [...queue.slice(0, SONGS_PER_DAY), ...fillers].slice(0, SONGS_PER_DAY);
    const today: any[] = [];
    let unresolvedTitle = '';
    for (const song of lineup) {
      if (song.youtube_video_id) { today.push(song); continue; }
      const response = await fetch(`/api/wakeup/youtube-resolve?q=${encodeURIComponent(`${song.title} ${song.channel_title ?? ''}`)}`);
      const data = await response.json().catch(() => null);
      if (!data?.videoId) { unresolvedTitle = song.title; break; }
      today.push({ ...song, youtube_video_id: data.videoId });
    }
    if (today.length !== SONGS_PER_DAY) { showError(`YouTube 재생 영상을 준비하지 못했어요${unresolvedTitle ? `: ${unresolvedTitle}` : ''}.`); return; }
    const playableToday = today;
    setSession(playableToday);
    setSessionIndex(0);
    setPaused(false);
    const player = await ensurePlayer();
    player.loadVideoById(playableToday[0].youtube_video_id);
    await setSongStatus(playableToday[0], 'playing');
  };

  const endSession = () => {
    playerRef.current?.stopVideo();
    setSession(null);
    setSessionIndex(0);
    setPaused(false);
  };

  // 그 자리에서 멈추는 것(정지/기숙사 전환)은 항상 지금 재생 중이던 곡을
  // '재생 전' 상태로 되돌린 다음에 세션을 끝낸다 — endSession 자체는 상태를
  // 건드리지 않는다(advance 끝에서도 재사용되는데, 거긴 이미 처리하고 나서 부름).
  const stopPlayback = async () => {
    if (nowPlaying) await setSongStatus(nowPlaying, 'approved');
    endSession();
  };

  // markCurrentPlayed=true는 노래가 실제로 끝까지 재생됐을 때만(onStateChange
  // ENDED) — 건너뛰기로는 절대 '재생 완료' 처리하지 않는다. 기숙사에 아무도
  // 없어서 그날 아예 재생을 안 하는 날도 있으니, 재생 안 된 곡은 다음 기회에
  // 다시 대기열 맨 앞에 남아 있어야 한다.
  const advance = async (markCurrentPlayed: boolean) => {
    const current = nowPlaying;
    if (current) await setSongStatus(current, markCurrentPlayed ? 'played' : 'approved');
    const nextIndex = sessionIndex + 1;
    if (session && nextIndex < session.length) {
      setSessionIndex(nextIndex);
      setPaused(false);
      playerRef.current?.loadVideoById(session[nextIndex].youtube_video_id);
      await setSongStatus(session[nextIndex], 'playing');
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

  // 신청은 즉시 승인 상태로 들어오므로 검토 대기열은 없다 — 담당자는 부적절한
  // 것만 사후에 거절한다. 거절은 오늘 곡만이 아니라 앞으로 예정된 모든 날짜의
  // 신청곡에 대해서도 가능해야 해서, 재생용(오늘만)과 별도로 날짜 상관없이
  // 전체 승인된 신청곡도 함께 가져온다.
  //
  // queue(재생 아직 안 한 것)와 todayLineup(오늘 신청된 전체, 이미 재생/재생
  // 중인 것 포함)을 분리한다 — "재생 시작"은 queue만 다음 세션에 넣어야 하고,
  // 화면에 보여주는 "오늘 신청곡 N곡"과 목록은 이미 재생을 마쳤어도 사라지면
  // 안 되기 때문.
  const fetchAll = async () => {
    const [approvedRes, todayRes, allRes] = await Promise.all([
      supabase.from('wakeup_songs').select('*, profiles:user_id (full_name, student_id)')
        .eq('dorm', dorm).eq('status', 'approved').eq('play_date', todayStr())
        .order('created_at', { ascending: true }),
      supabase.from('wakeup_songs').select('*, profiles:user_id (full_name, student_id)')
        .eq('dorm', dorm).in('status', ['approved', 'playing', 'played']).eq('play_date', todayStr())
        .order('created_at', { ascending: true }),
      supabase.from('wakeup_songs').select('*, profiles:user_id (full_name, student_id)')
        .eq('dorm', dorm).eq('status', 'approved')
        .order('play_date', { ascending: true }).order('created_at', { ascending: true }),
    ]);
    if (!approvedRes.error) setQueue(approvedRes.data || []);
    if (!todayRes.error) setTodayLineup(todayRes.data || []);
    if (!allRes.error) setAllApproved(allRes.data || []);
    const { data: playlist } = await supabase.from('wakeup_playlists').select('spotify_playlist_url').eq('dorm', dorm).eq('play_date', todayStr()).maybeSingle();
    setPlaylistUrl(playlist?.spotify_playlist_url ?? null);
    setLoading(false);
  };

  const generateAiFillers = async () => {
    const needed = Math.max(0, SONGS_PER_DAY - queue.length);
    if (!needed) { setAiFillers([]); return []; }
    if (aiFillers.length === needed) return aiFillers;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    setFillingSongs(true);
    setFillProgress({ done: 0, total: needed });
    const response = await fetch('/api/wakeup/ai-fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ count: needed, usedUris: todayLineup.map(song => song.spotify_uri).filter((uri): uri is string => typeof uri === 'string') }),
    });
    const data = await response.json().catch(() => null);
    setFillingSongs(false);
    setFillProgress(null);
    if (!response.ok) { showError(data?.message || '추천곡 채우기에 실패했어요.'); return []; }
    const items: any[] = data?.items ?? [];
    setAiFillers(items);
    if (items.length !== needed) showError(`${needed}곡 중 ${items.length}곡만 준비됐어요. 다시 눌러 남은 곡을 채워 주세요.`);
    return items;
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

  const createSpotifyPlaylist = async () => {
    const fillers = await generateAiFillers();
    const tracks = [...todayLineup.slice(0, SONGS_PER_DAY), ...fillers].slice(0, SONGS_PER_DAY).map(song => song.spotify_uri).filter((uri): uri is string => typeof uri === 'string');
    if (tracks.length !== SONGS_PER_DAY) { showError(`플레이리스트는 하루 정확히 ${SONGS_PER_DAY}곡이 준비된 뒤 만들 수 있어요.`); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { showError('로그인이 필요해요.'); return; }
    setCreatingPlaylist(true);
    const response = await fetch('/api/wakeup/spotify/playlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name: `${dorm} 기상송 · ${format(new Date(), 'M월 d일', { locale: ko })}`, tracks }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.url) {
      setCreatingPlaylist(false);
      if (response.status === 401) { window.location.assign('/api/wakeup/spotify/connect'); return; }
      showError(data?.message || 'Spotify 플레이리스트 생성에 실패했어요.');
      return;
    }
    const { error } = await supabase.from('wakeup_playlists').upsert({ dorm, play_date: todayStr(), spotify_playlist_id: data.id, spotify_playlist_url: data.url, created_by: user?.id }, { onConflict: 'dorm,play_date' });
    setCreatingPlaylist(false);
    if (error) { showError(`링크 저장 실패: ${error.message}`); return; }
    setPlaylistUrl(data.url);
    showSuccess('Spotify 플레이리스트 링크를 만들었어요.');
  };

  const deleteLegacyRequests = async () => {
    setDeletingLegacy(true);
    const { error } = await supabase.from('wakeup_songs').delete().is('spotify_uri', null);
    setDeletingLegacy(false);
    setLegacyDeleteOpen(false);
    if (error) { showError(`기존 신청곡 삭제 실패: ${error.message}`); return; }
    showSuccess('기존 YouTube 신청곡을 모두 삭제했어요.');
    fetchAll();
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
          <Badge variant="default">총 {Math.min(SONGS_PER_DAY, todayLineup.length + aiFillers.length)}/{SONGS_PER_DAY}곡</Badge>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={generateAiFillers} disabled={fillingSongs || queue.length >= SONGS_PER_DAY} className="flex-1"><ListPlus className="size-4 mr-1.5" />{fillingSongs ? `추천곡 확인 중 (${fillProgress?.done ?? 0}/${fillProgress?.total ?? 0})` : '나머지 곡들 채우기'}</Button>
          <Button variant="secondary" onClick={createSpotifyPlaylist} disabled={creatingPlaylist} className="flex-1"><ListPlus className="size-4 mr-1.5" />{creatingPlaylist ? 'Spotify 생성 중...' : 'Spotify 플레이리스트 만들기'}</Button>
          {playlistUrl && <Button asChild variant="secondary"><a href={playlistUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4 mr-1.5" />생성된 플레이리스트 열기</a></Button>}
        </div>
        {aiFillers.length > 0 && <p className="text-xs text-[#1DB954] font-medium">지정한 추천곡 목록에서 {aiFillers.length}곡을 자동으로 채웠어요.</p>}
        {fillingSongs && <p className="text-xs text-muted-foreground">지정한 Spotify 추천곡 목록에서 빈자리를 채우고 있어요. 잠시만 기다려 주세요.</p>}

        <ul className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
            {[...todayLineup.slice(0, SONGS_PER_DAY), ...aiFillers].slice(0, SONGS_PER_DAY).map((song, i) => (
              <li key={song.id ?? song._key} className="flex items-center gap-2 text-xs p-2 rounded-lg">
                <span className="text-muted-foreground font-black w-4 shrink-0">{i + 1}</span>
                <span className={`truncate flex-1 font-semibold ${song.isFiller ? 'text-muted-foreground italic' : ''}`}>{song.title}</span>
                {!song.isFiller && <Badge variant={STATUS_LABEL[song.status]?.variant ?? 'default'}>{STATUS_LABEL[song.status]?.label ?? song.status}</Badge>}
              </li>
            ))}
        </ul>

      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2"><h2 className="text-lg font-black">신청곡 관리</h2><Badge variant="default">{allApproved.length}곡</Badge><Button size="sm" variant="destructive" className="ml-auto" onClick={() => setLegacyDeleteOpen(true)}>기존 YouTube 신청곡 삭제</Button></div>
        <p className="text-xs text-muted-foreground">오늘만이 아니라 앞으로 예정된 모든 날짜의 신청곡을 거절할 수 있어요.</p>
        {allApproved.length === 0 && <p className="text-sm text-muted-foreground">신청된 곡이 없어요.</p>}
        {Object.entries(
          allApproved.reduce<Record<string, any[]>>((groups, song) => {
            (groups[song.play_date] ??= []).push(song);
            return groups;
          }, {})
        ).map(([date, songs]) => (
          <div key={date} className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-primary">
              {format(new Date(date + 'T00:00:00'), 'M/d(eee)', { locale: ko })}{date === todayStr() ? ' · 오늘' : ''}
            </p>
            {songs.map((song) => (
              <div key={song.id} className="rounded-2xl bg-card ring-1 ring-border/60 p-3 space-y-2">
                <div className="flex items-center gap-3">
                  {song.thumbnail_url && <Image src={song.thumbnail_url} alt={song.title} width={56} height={42} className="rounded-lg object-cover shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{song.title}</p>
                    {song.spotify_url && <a href={song.spotify_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#1DB954] hover:underline">Spotify에서 열기</a>}
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
          </div>
        ))}
      </section>
      <ConfirmDialog open={legacyDeleteOpen} title="기존 YouTube 신청곡을 모두 삭제할까요?" description="Spotify 정보가 없는 기존 신청곡 전체가 삭제됩니다. 되돌릴 수 없습니다." confirmLabel={deletingLegacy ? '삭제 중...' : '전체 삭제'} onConfirm={deleteLegacyRequests} onCancel={() => setLegacyDeleteOpen(false)} />
    </div>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { addDays, format } from 'date-fns';
import { enUS } from 'date-fns/locale';
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
const DORM_LABELS: Record<Dorm, string> = { [DORMS[0]]: 'Cheongun Hall', [DORMS[1]]: 'Sareum Hall' };

function englishError(value: unknown, fallback: string) {
  const message = value instanceof Error ? value.message : typeof value === 'string' ? value : '';
  return message && !/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u.test(message) ? message : fallback;
}

const DORM_KEY = 'cbgpu.admin.wakeup.dorm';

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}
function tomorrowStr() {
  return format(addDays(new Date(), 1), 'yyyy-MM-dd');
}

export default function AdminWakeupPage() {
  const { user, isAdmin, isWakeupManager, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();
  const canManageWakeup = isAdmin || isWakeupManager;

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
  const [tomorrowLineup, setTomorrowLineup] = useState<any[]>([]);
  const [allApproved, setAllApproved] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  const [tomorrowPlaylistUrl, setTomorrowPlaylistUrl] = useState<string | null>(null);
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
    if (error) showError(`Could not update status (${song.title}): ${englishError(error.message, 'The update failed.')}`);
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
    if (today.length !== SONGS_PER_DAY) { showError(`Could not prepare a YouTube video${unresolvedTitle ? `: ${unresolvedTitle}` : ''}.`); return; }
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
      if (markCurrentPlayed) showSuccess("Today's playback is complete.");
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
    setLoadError('');
    try {
    const [approvedRes, todayRes, tomorrowRes, allRes] = await Promise.all([
      supabase.from('wakeup_songs').select('*, profiles:user_id (full_name, student_id)')
        .eq('dorm', dorm).eq('status', 'approved').eq('play_date', todayStr())
        .order('created_at', { ascending: true }),
      supabase.from('wakeup_songs').select('*, profiles:user_id (full_name, student_id)')
        .eq('dorm', dorm).in('status', ['approved', 'playing', 'played']).eq('play_date', todayStr())
        .order('created_at', { ascending: true }),
      supabase.from('wakeup_songs').select('*')
        .eq('dorm', dorm).in('status', ['approved', 'playing', 'played']).eq('play_date', tomorrowStr())
        .order('created_at', { ascending: true }),
      supabase.from('wakeup_songs').select('*, profiles:user_id (full_name, student_id)')
        .eq('dorm', dorm).eq('status', 'approved')
        .order('play_date', { ascending: true }).order('created_at', { ascending: true }),
    ]);
    if ([approvedRes, todayRes, tomorrowRes, allRes].some(result => result.error)) setLoadError('Some song requests could not be loaded. Retry before making changes.');
    if (!approvedRes.error) setQueue(approvedRes.data || []);
    if (!todayRes.error) setTodayLineup(todayRes.data || []);
    if (!tomorrowRes.error) setTomorrowLineup(tomorrowRes.data || []);
    if (!allRes.error) setAllApproved(allRes.data || []);
    const [{ data: playlist }, { data: tomorrowPlaylist }] = await Promise.all([
      supabase.from('wakeup_playlists').select('spotify_playlist_url').eq('dorm', dorm).eq('play_date', todayStr()).maybeSingle(),
      supabase.from('wakeup_playlists').select('spotify_playlist_url').eq('dorm', dorm).eq('play_date', tomorrowStr()).maybeSingle(),
    ]);
    setPlaylistUrl(playlist?.spotify_playlist_url ?? null);
    setTomorrowPlaylistUrl(tomorrowPlaylist?.spotify_playlist_url ?? null);
    } catch (error) {
      setLoadError(englishError(error, 'Could not load wake-up music. Please try again.'));
    } finally {
      setLoading(false);
    }
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
    if (!response.ok) { showError(englishError(data?.message, 'Could not fill recommended tracks.')); return []; }
    const items: any[] = data?.items ?? [];
    setAiFillers(items);
    if (items.length !== needed) showError(`Only ${items.length} of ${needed} tracks are ready. Try again to fill the remaining slots.`);
    return items;
  };

  useEffect(() => {
    if (!authLoading && canManageWakeup) { setLoading(true); fetchAll(); }
    else if (!authLoading) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canManageWakeup, dorm]);

  const reject = async (id: string) => {
    const { error } = await supabase.from('wakeup_songs').update({ status: 'rejected', reject_reason: rejectReason.trim() || null }).eq('id', id);
    if (error) showError('Could not reject the request: ' + englishError(error.message, 'The update failed.'));
    else { showSuccess('Request rejected.'); setRejectingId(null); setRejectReason(''); fetchAll(); }
  };

  const createSpotifyPlaylist = async () => {
    const fillers = await generateAiFillers();
    const tracks = [...todayLineup.slice(0, SONGS_PER_DAY), ...fillers].slice(0, SONGS_PER_DAY).map(song => song.spotify_uri).filter((uri): uri is string => typeof uri === 'string');
    if (tracks.length !== SONGS_PER_DAY) { showError(`Prepare exactly ${SONGS_PER_DAY} tracks before creating a playlist.`); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { showError('Please sign in.'); return; }
    setCreatingPlaylist(true);
    const response = await fetch('/api/wakeup/spotify/playlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name: `${dorm} 기상송 · ${format(new Date(), 'M월 d일', { locale: enUS })}`, tracks }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.url) {
      setCreatingPlaylist(false);
      if (response.status === 401) { window.location.assign('/api/wakeup/spotify/connect'); return; }
      showError(englishError(data?.message, 'Could not create the Spotify playlist.'));
      return;
    }
    const { error } = await supabase.from('wakeup_playlists').upsert({ dorm, play_date: todayStr(), spotify_playlist_id: data.id, spotify_playlist_url: data.url, created_by: user?.id }, { onConflict: 'dorm,play_date' });
    setCreatingPlaylist(false);
    if (error) { showError(`Could not save the playlist link: ${englishError(error.message, 'The update failed.')}`); return; }
    setPlaylistUrl(data.url);
    showSuccess('Spotify playlist link created.');
  };

  const createTomorrowPlaylist = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { showError('Please sign in.'); return; }
    let fillers: any[] = [];
    const needed = Math.max(0, SONGS_PER_DAY - tomorrowLineup.length);
    if (needed) {
      const fillResponse = await fetch('/api/wakeup/ai-fill', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ count: needed, usedUris: tomorrowLineup.map(song => song.spotify_uri).filter((uri): uri is string => typeof uri === 'string') }) });
      const fillData = await fillResponse.json().catch(() => null);
      if (!fillResponse.ok) { showError(englishError(fillData?.message, 'Could not fill tomorrow’s recommended tracks.')); return; }
      fillers = fillData?.items ?? [];
    }
    const tracks = [...tomorrowLineup, ...fillers].slice(0, SONGS_PER_DAY).map(song => song.spotify_uri).filter((uri): uri is string => typeof uri === 'string');
    if (tracks.length !== SONGS_PER_DAY) { showError(`Tomorrow's playlist also needs exactly ${SONGS_PER_DAY} tracks.`); return; }
    setCreatingPlaylist(true);
    const response = await fetch('/api/wakeup/spotify/playlist', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ name: `${dorm} 기상송 · ${format(addDays(new Date(), 1), 'M월 d일', { locale: enUS })}`, tracks }) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.url) { setCreatingPlaylist(false); if (response.status === 401) { window.location.assign('/api/wakeup/spotify/connect'); return; } showError(englishError(data?.message, 'Could not create tomorrow’s playlist.')); return; }
    const { error } = await supabase.from('wakeup_playlists').upsert({ dorm, play_date: tomorrowStr(), spotify_playlist_id: data.id, spotify_playlist_url: data.url, created_by: user?.id }, { onConflict: 'dorm,play_date' });
    setCreatingPlaylist(false);
    if (error) { showError(`Could not save tomorrow's playlist link: ${englishError(error.message, 'The update failed.')}`); return; }
    setTomorrowPlaylistUrl(data.url);
    showSuccess("Tomorrow's Spotify playlist link created.");
  };

  const deleteLegacyRequests = async () => {
    setDeletingLegacy(true);
    const { error } = await supabase.from('wakeup_songs').delete().is('spotify_uri', null);
    setDeletingLegacy(false);
    setLegacyDeleteOpen(false);
    if (error) { showError(`Could not delete legacy requests: ${englishError(error.message, 'The delete request failed.')}`); return; }
    showSuccess('All legacy YouTube requests were deleted.');
    fetchAll();
  };

  if (authLoading || loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoadingSpinner size={48} /></div>;
  }

  if (!canManageWakeup) {
    return (
      <div className="max-w-sm mx-auto mt-16 text-center space-y-4">
        <ShieldAlert className="size-12 mx-auto text-destructive" />
        <p className="font-bold">This page is restricted to administrators and wake-up music managers.</p>
        <Button onClick={() => router.push('/')}>Return home</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-black italic tracking-tighter">Wake-up music</h1>
        <SegmentedTabs label="Dormitory" items={DORMS.map(d => ({ value: d, label: DORM_LABELS[d] }))} value={dorm} onChange={changeDorm} />
      </div>

      {loadError && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>{loadError}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { setLoading(true); void fetchAll(); }}>Retry loading</Button></div>}

      {/* ── 재생 ─────────────────────────────────────────────────────── */}
      <section className="rounded-[28px] border border-primary/15 bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ListMusic className="size-5 text-primary" />
          <h2 className="text-lg font-black">{DORM_LABELS[dorm]} · Today&apos;s playback</h2>
          <Badge variant="default">{Math.min(SONGS_PER_DAY, todayLineup.length + aiFillers.length)}/{SONGS_PER_DAY} tracks</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={generateAiFillers} disabled={fillingSongs || queue.length >= SONGS_PER_DAY} className="min-w-[160px] flex-1 whitespace-normal"><ListPlus className="size-4 mr-1.5" />{fillingSongs ? `Checking recommendations (${fillProgress?.done ?? 0}/${fillProgress?.total ?? 0})` : 'Fill remaining tracks'}</Button>
          <Button variant="secondary" onClick={createSpotifyPlaylist} disabled={creatingPlaylist} className="min-w-[160px] flex-1 whitespace-normal"><ListPlus className="size-4 mr-1.5" />{creatingPlaylist ? 'Creating Spotify playlist…' : 'Create Spotify playlist'}</Button>
          {playlistUrl && <Button asChild variant="secondary"><a href={playlistUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4 mr-1.5" />Open playlist</a></Button>}
        </div>
        {aiFillers.length > 0 && <p className="text-xs text-[#1DB954] font-medium">Added {aiFillers.length} tracks from the configured recommendations.</p>}
        {fillingSongs && <p className="text-xs text-muted-foreground">Filling empty slots from the configured Spotify recommendations. Please wait.</p>}

        <ul className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
            {[...todayLineup.slice(0, SONGS_PER_DAY), ...aiFillers].slice(0, SONGS_PER_DAY).map((song, i) => (
              <li key={song.id ?? song._key} className="flex items-center gap-2 text-xs p-2 rounded-lg">
                <span className="text-muted-foreground font-black w-4 shrink-0">{i + 1}</span>
                <span className={`truncate flex-1 font-semibold ${song.isFiller ? 'text-muted-foreground italic' : ''}`}>{song.title}</span>
              </li>
            ))}
        </ul>

      </section>

      <section className="rounded-[28px] border border-primary/15 bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ListMusic className="size-5 text-primary" />
          <h2 className="text-lg font-black">{DORM_LABELS[dorm]} · Tomorrow&apos;s playback</h2>
          <Badge variant="default">{Math.min(SONGS_PER_DAY, tomorrowLineup.length)}/{SONGS_PER_DAY} tracks</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Prepare tomorrow&apos;s morning playlist in advance.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={createTomorrowPlaylist} disabled={creatingPlaylist} className="min-w-[160px] flex-1 whitespace-normal"><ListPlus className="size-4 mr-1.5" />{creatingPlaylist ? 'Creating Spotify playlist…' : "Create tomorrow's playlist"}</Button>
          {tomorrowPlaylistUrl && <Button asChild variant="secondary"><a href={tomorrowPlaylistUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4 mr-1.5" />Open playlist</a></Button>}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">Song requests</h2><Badge variant="default">{allApproved.length} tracks</Badge><Button size="sm" variant="destructive" className="ml-auto" onClick={() => setLegacyDeleteOpen(true)}>Delete legacy YouTube requests</Button></div>
        <p className="text-xs text-muted-foreground">Review and reject requests scheduled for today or any future date.</p>
        {allApproved.length === 0 && <p className="text-sm text-muted-foreground">No song requests.</p>}
        {Object.entries(
          allApproved.reduce<Record<string, any[]>>((groups, song) => {
            (groups[song.play_date] ??= []).push(song);
            return groups;
          }, {})
        ).map(([date, songs]) => (
          <div key={date} className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-primary">
              {format(new Date(date + 'T00:00:00'), 'MMM d (EEE)', { locale: enUS })}{date === todayStr() ? ' · Today' : ''}
            </p>
            {songs.map((song) => (
              <div key={song.id} className="rounded-2xl bg-card ring-1 ring-border/60 p-3 space-y-2">
                <div className="flex items-center gap-3">
                  {song.thumbnail_url && <Image src={song.thumbnail_url} alt={song.title} width={56} height={42} className="rounded-lg object-cover shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{song.title}</p>
                    {song.spotify_url && <a href={song.spotify_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#1DB954] hover:underline">Open in Spotify</a>}
                    <p className="text-xs text-muted-foreground truncate">{song.profiles?.full_name} ({song.profiles?.student_id})</p>
                  </div>
                </div>
                {rejectingId === song.id ? (
                  <div className="flex flex-wrap gap-2">
                    <Input placeholder="Rejection reason (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="flex-1" />
                    <Button size="sm" variant="destructive" onClick={() => reject(song.id)}>Confirm rejection</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Cancel</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="destructive" onClick={() => setRejectingId(song.id)} className="w-full"><X className="size-3.5 mr-1" /> Reject</Button>
                )}
              </div>
            ))}
          </div>
        ))}
      </section>
      <ConfirmDialog open={legacyDeleteOpen} title="Delete all legacy YouTube requests?" description="All legacy requests without Spotify information will be deleted. This cannot be undone." confirmLabel={deletingLegacy ? 'Deleting…' : 'Delete all'} onConfirm={deleteLegacyRequests} onCancel={() => setLegacyDeleteOpen(false)} />
    </div>
  );
}

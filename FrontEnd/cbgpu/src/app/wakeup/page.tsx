'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import { extractYoutubeId } from '@/lib/youtube';
import { loadYoutubeIframeApi, type YTPlayer } from '@/lib/youtubePlayer';
import { Music, Play, Square, SkipForward, Send, ListMusic, History } from 'lucide-react';

interface WakeupSong {
  id: string;
  user_id: string;
  youtube_video_id: string;
  title: string;
  channel_title: string | null;
  thumbnail_url: string | null;
  message: string;
  status: 'pending' | 'approved' | 'rejected' | 'played';
  reject_reason: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<WakeupSong['status'], { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  pending: { label: '검토 중', variant: 'warning' },
  approved: { label: '대기열', variant: 'default' },
  played: { label: '재생 완료', variant: 'success' },
  rejected: { label: '거절됨', variant: 'danger' },
};

export default function WakeupSongPage() {
  const { user, isApproved } = useAuth();
  const { showError, showSuccess } = useAlert();

  const [urlInput, setUrlInput] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{ videoId: string; title: string; channelTitle: string; thumbnailUrl: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [myRequests, setMyRequests] = useState<WakeupSong[]>([]);
  const [queue, setQueue] = useState<WakeupSong[]>([]);
  const [loading, setLoading] = useState(true);

  const playerRef = useRef<YTPlayer | null>(null);
  const [nowPlaying, setNowPlaying] = useState<WakeupSong | null>(null);
  const queueRef = useRef<WakeupSong[]>([]);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  const fetchAll = async () => {
    if (!user) return;
    const [mineRes, queueRes] = await Promise.all([
      supabase.from('wakeup_songs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('wakeup_songs').select('*').eq('status', 'approved').order('created_at', { ascending: true }),
    ]);
    if (!mineRes.error) setMyRequests(mineRes.data || []);
    if (!queueRes.error) setQueue(queueRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('wakeup-songs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wakeup_songs' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // 링크를 붙여넣으면 잠깐 뒤에 자동으로 제목/채널/썸네일을 미리 보여준다 — 잘못된
  // 링크를 신청하고 나서야 알게 되는 일이 없게.
  useEffect(() => {
    const videoId = extractYoutubeId(urlInput);
    if (!videoId) { setPreview(null); return; }
    setPreviewLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/wakeup/oembed?videoId=${videoId}`)
        .then(res => res.json())
        .then(data => {
          if (data?.title) setPreview({ videoId, title: data.title, channelTitle: data.channelTitle, thumbnailUrl: data.thumbnailUrl });
          else setPreview(null);
        })
        .catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [urlInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApproved) { showError('학번 또는 이름 확인이 필요해 신청할 수 없습니다. 프로필에서 정보를 확인해 주세요.'); return; }
    if (!preview) { showError('유효한 유튜브 링크를 입력해 주세요.'); return; }
    if (!user) return;

    setSubmitting(true);
    const { error } = await supabase.from('wakeup_songs').insert({
      user_id: user.id,
      youtube_video_id: preview.videoId,
      title: preview.title,
      channel_title: preview.channelTitle,
      thumbnail_url: preview.thumbnailUrl,
      message: message.trim(),
    });
    setSubmitting(false);
    if (error) { showError('신청 실패: ' + error.message); return; }
    showSuccess('기상송 신청이 완료됐어요! 관리자 승인 후 대기열에 올라가요.');
    setUrlInput('');
    setMessage('');
    setPreview(null);
    fetchAll();
  };

  // ── 재생 ──────────────────────────────────────────────────────────────
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

  const markPlayed = async (song: WakeupSong) => {
    await supabase.from('wakeup_songs').update({ status: 'played', played_at: new Date().toISOString() }).eq('id', song.id);
  };

  const advance = async (currentFinished: boolean) => {
    const current = nowPlaying;
    const remaining = queueRef.current.filter(s => s.id !== current?.id);
    if (currentFinished && current) await markPlayed(current);
    const next = remaining[0] ?? null;
    setNowPlaying(next);
    if (next) {
      const player = await ensurePlayer();
      player.loadVideoById(next.youtube_video_id);
    } else {
      playerRef.current?.stopVideo();
    }
  };

  const startPlaying = async () => {
    if (queue.length === 0) return;
    const first = queue[0];
    setNowPlaying(first);
    const player = await ensurePlayer();
    player.loadVideoById(first.youtube_video_id);
  };

  const stopPlaying = () => {
    playerRef.current?.stopVideo();
    setNowPlaying(null);
  };

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoadingSpinner size={48} /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-10">
      <div className="space-y-1">
        <h1 className="text-3xl font-black italic tracking-tighter">기상송 신청</h1>
        <p className="text-sm text-muted-foreground font-medium">듣고 싶은 노래를 신청하면, 승인 후 아침 대기열에 올라가요.</p>
      </div>

      {/* ── 재생 ─────────────────────────────────────────────────────── */}
      <div className="rounded-[28px] border border-primary/15 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Music className="size-5 text-primary" />
          <h2 className="text-lg font-black">오늘의 대기열</h2>
          <Badge variant="default">{queue.length}곡</Badge>
        </div>

        <div id="wakeup-yt-player" className={nowPlaying ? 'rounded-2xl overflow-hidden' : 'hidden'} />

        {nowPlaying ? (
          <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
            {nowPlaying.thumbnail_url && (
              <Image src={nowPlaying.thumbnail_url} alt={nowPlaying.title} width={64} height={48} className="rounded-lg object-cover shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">재생 중</p>
              <p className="text-sm font-bold truncate">{nowPlaying.title}</p>
            </div>
            <Button size="icon" variant="secondary" onClick={() => advance(false)} aria-label="다음 곡"><SkipForward className="size-4" /></Button>
            <Button size="icon" variant="secondary" onClick={stopPlaying} aria-label="정지"><Square className="size-4" /></Button>
          </div>
        ) : queue.length > 0 ? (
          <Button onClick={startPlaying} className="w-full py-5 font-black">
            <Play className="size-4 mr-1.5" /> 지금 재생하기
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">대기열이 비어 있어요. 신청곡이 승인되면 여기 쌓여요.</p>
        )}

        {queue.length > 0 && (
          <ul className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
            {queue.map((song, i) => (
              <li key={song.id} className={`flex items-center gap-2 text-xs p-2 rounded-lg ${nowPlaying?.id === song.id ? 'bg-primary/10' : ''}`}>
                <span className="text-muted-foreground font-black w-4 shrink-0">{i + 1}</span>
                <span className="truncate flex-1 font-semibold">{song.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 신청 폼 ──────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="rounded-[28px] border border-border/60 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2"><Send className="size-5 text-primary" /><h2 className="text-lg font-black">신청하기</h2></div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">유튜브 링크</label>
          <Input
            placeholder="https://www.youtube.com/watch?v=..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
        </div>
        {previewLoading && <p className="text-xs text-muted-foreground">확인 중...</p>}
        {preview && (
          <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
            {preview.thumbnailUrl && <Image src={preview.thumbnailUrl} alt={preview.title} width={80} height={60} className="rounded-lg object-cover shrink-0" />}
            <div className="min-w-0">
              <p className="text-sm font-bold line-clamp-2">{preview.title}</p>
              <p className="text-xs text-muted-foreground">{preview.channelTitle}</p>
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">한마디 (선택)</label>
          <Input placeholder="누구에게, 어떤 마음으로 신청하는지 적어보세요" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={80} />
        </div>
        <Button type="submit" disabled={!preview || submitting} className="w-full py-5 font-black">
          {submitting ? '신청 중...' : '신청하기'}
        </Button>
      </form>

      {/* ── 내 신청 내역 ─────────────────────────────────────────────── */}
      {myRequests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2"><History className="size-5 text-muted-foreground" /><h2 className="text-lg font-black">내 신청 내역</h2></div>
          <ul className="space-y-2">
            {myRequests.map((song) => (
              <li key={song.id} className="flex items-center gap-3 rounded-2xl bg-card ring-1 ring-border/60 p-3">
                {song.thumbnail_url && <Image src={song.thumbnail_url} alt={song.title} width={64} height={48} className="rounded-lg object-cover shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{song.title}</p>
                  {song.message && <p className="text-xs text-muted-foreground truncate">&quot;{song.message}&quot;</p>}
                  {song.status === 'rejected' && song.reject_reason && (
                    <p className="text-xs text-destructive">{song.reject_reason}</p>
                  )}
                </div>
                <Badge variant={STATUS_BADGE[song.status].variant}>{STATUS_BADGE[song.status].label}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground justify-center">
        <ListMusic className="size-3" /> 저작권이 있는 음원이라 유튜브 광고가 함께 재생될 수 있어요.
      </p>
    </div>
  );
}

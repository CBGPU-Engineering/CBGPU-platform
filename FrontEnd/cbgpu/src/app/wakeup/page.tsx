'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Music, Send, History, Search } from 'lucide-react';

const DORMS = ['청운학사', '사름학사'] as const;
type Dorm = typeof DORMS[number];
const DORM_KEY = 'cbgpu.wakeup.dorm';

interface SearchResult { videoId: string; title: string; channelTitle: string; thumbnailUrl: string }

interface WakeupSong {
  id: string;
  youtube_video_id: string;
  title: string;
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

  const [dorm, setDorm] = useState<Dorm>(DORMS[0]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DORM_KEY);
      if (saved && (DORMS as readonly string[]).includes(saved)) setDorm(saved as Dorm);
    } catch { /* localStorage unavailable */ }
  }, []);
  const changeDorm = (value: string) => {
    setDorm(value as Dorm);
    try { localStorage.setItem(DORM_KEY, value); } catch { /* best-effort only */ }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<SearchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [myRequests, setMyRequests] = useState<WakeupSong[]>([]);
  const [queue, setQueue] = useState<WakeupSong[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    if (!user) return;
    const [mineRes, queueRes] = await Promise.all([
      supabase.from('wakeup_songs').select('*').eq('user_id', user.id).eq('dorm', dorm).order('created_at', { ascending: false }).limit(20),
      supabase.from('wakeup_songs').select('*').eq('dorm', dorm).eq('status', 'approved').order('created_at', { ascending: true }),
    ]);
    if (!mineRes.error) setMyRequests(mineRes.data || []);
    if (!queueRes.error) setQueue(queueRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchAll();
    const channel = supabase
      .channel(`wakeup-songs-${dorm}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wakeup_songs', filter: `dorm=eq.${dorm}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, dorm]);

  // 검색어를 입력하면 잠깐 뒤에 유튜브에서 찾아 목록으로 보여준다 — 링크를 직접
  // 찾아 붙여넣을 필요 없이 바로 골라서 신청할 수 있게.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); setSearchError(''); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/wakeup/search?q=${encodeURIComponent(q)}`)
        .then(res => res.json())
        .then(data => {
          if (data?.items) { setSearchResults(data.items); setSearchError(''); }
          else { setSearchResults([]); setSearchError(data?.message || '검색에 실패했어요.'); }
        })
        .catch(() => { setSearchResults([]); setSearchError('검색 중 오류가 발생했어요.'); })
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectResult = (result: SearchResult) => {
    setPreview(result);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApproved) { showError('학번 또는 이름 확인이 필요해 신청할 수 없습니다. 프로필에서 정보를 확인해 주세요.'); return; }
    if (!preview) { showError('신청할 곡을 먼저 검색해서 골라주세요.'); return; }
    if (!user) return;

    setSubmitting(true);
    const { error } = await supabase.from('wakeup_songs').insert({
      user_id: user.id,
      dorm,
      youtube_video_id: preview.videoId,
      title: preview.title,
      channel_title: preview.channelTitle,
      thumbnail_url: preview.thumbnailUrl,
      message: message.trim(),
    });
    setSubmitting(false);
    if (error) { showError('신청 실패: ' + error.message); return; }
    showSuccess('기상송 신청이 완료됐어요! 관리자 승인 후 대기열에 올라가요.');
    setMessage('');
    setPreview(null);
    fetchAll();
  };

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoadingSpinner size={48} /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-10">
      <div className="space-y-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-black italic tracking-tighter">기상송 신청</h1>
          <p className="text-sm text-muted-foreground font-medium">듣고 싶은 노래를 신청하면, 승인 후 아침 대기열에 올라가요.</p>
        </div>
        <SegmentedTabs items={DORMS.map(d => ({ value: d, label: d }))} value={dorm} onChange={changeDorm} />
      </div>

      {/* ── 대기열 (읽기 전용 — 재생은 담당자가 /admin/wakeup에서 처리) ──── */}
      <div className="rounded-[28px] border border-primary/15 bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Music className="size-5 text-primary" />
          <h2 className="text-lg font-black">{dorm} 대기열</h2>
          <Badge variant="default">{queue.length}곡</Badge>
        </div>
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">대기열이 비어 있어요. 신청곡이 승인되면 여기 쌓여요.</p>
        ) : (
          <ul className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
            {queue.map((song, i) => (
              <li key={song.id} className="flex items-center gap-2 text-xs p-2 rounded-lg">
                <span className="text-muted-foreground font-black w-4 shrink-0">{i + 1}</span>
                <span className="truncate flex-1 font-semibold">{song.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 신청 폼 ──────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="rounded-[28px] border border-border/60 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2"><Send className="size-5 text-primary" /><h2 className="text-lg font-black">{dorm}에 신청하기</h2></div>

        {preview ? (
          <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
            {preview.thumbnailUrl && <Image src={preview.thumbnailUrl} alt={preview.title} width={80} height={60} className="rounded-lg object-cover shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold line-clamp-2">{preview.title}</p>
              <p className="text-xs text-muted-foreground">{preview.channelTitle}</p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPreview(null)}>다시 고르기</Button>
          </div>
        ) : (
          <div className="space-y-1.5 relative">
            <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">노래 검색</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="노래 제목이나 가수 이름으로 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {searching && <p className="text-xs text-muted-foreground">검색 중...</p>}
            {searchError && <p className="text-xs text-destructive">{searchError}</p>}
            {searchResults.length > 0 && (
              <ul className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                {searchResults.map((result) => (
                  <li key={result.videoId}>
                    <button
                      type="button"
                      onClick={() => selectResult(result)}
                      className="flex items-center gap-3 w-full text-left rounded-2xl bg-muted/50 hover:bg-muted p-2 transition-colors"
                    >
                      {result.thumbnailUrl && <Image src={result.thumbnailUrl} alt={result.title} width={64} height={48} className="rounded-lg object-cover shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-bold line-clamp-2">{result.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{result.channelTitle}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
          <div className="flex items-center gap-2"><History className="size-5 text-muted-foreground" /><h2 className="text-lg font-black">내 신청 내역 ({dorm})</h2></div>
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
    </div>
  );
}

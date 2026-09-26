'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Music, Send, History, Search, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { withFiller } from '@/lib/wakeupFiller';

const DORMS = ['청운학사', '사름학사'] as const;
type Dorm = typeof DORMS[number];
const DORM_KEY = 'cbgpu.wakeup.dorm';
const NEXT_14_DAYS = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i));
const todayStr = () => format(new Date(), 'yyyy-MM-dd');

interface SearchResult { videoId: string; title: string; channelTitle: string; thumbnailUrl: string }

interface WakeupSong {
  isFiller?: false;
  id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  message: string;
  status: 'pending' | 'approved' | 'playing' | 'rejected' | 'played';
  reject_reason: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<WakeupSong['status'], { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  pending: { label: '검토 중', variant: 'warning' },
  approved: { label: '재생 전', variant: 'default' },
  playing: { label: '재생 중', variant: 'warning' },
  played: { label: '재생 완료', variant: 'success' },
  rejected: { label: '거절됨', variant: 'danger' },
};

export default function WakeupSongPage() {
  const { user, isApproved } = useAuth();
  const { showError, showSuccess } = useAlert();

  // 지연 초기화(useState(() => ...))로 첫 렌더에서 곧바로 저장된 기숙사를 읽는다 —
  // 마운트 이펙트로 나중에 고치면 그 사이에 기본값(청운학사)으로 한 번 먼저
  // fetch가 나가버려서, 새로고침할 때마다 잠깐(또는 어떤 순서에선 계속) 엉뚱한
  // 기숙사 데이터가 보이는 문제가 있었다.
  const [dorm, setDorm] = useState<Dorm>(() => {
    try {
      const saved = localStorage.getItem(DORM_KEY);
      if (saved && (DORMS as readonly string[]).includes(saved)) return saved as Dorm;
    } catch { /* localStorage unavailable */ }
    return DORMS[0];
  });
  const changeDorm = (value: string) => {
    setDorm(value as Dorm);
    try { localStorage.setItem(DORM_KEY, value); } catch { /* best-effort only */ }
  };

  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

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
      supabase.from('wakeup_songs').select('*').eq('dorm', dorm).in('status', ['approved', 'playing', 'played']).eq('play_date', selectedDateStr).order('created_at', { ascending: true }),
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
  }, [user?.id, dorm, selectedDateStr]);

  // 지금 몇 번째 자리가 재생 중인지는 자동 채움 곡엔 DB 행이 없어 status로
  // 알 수 없다 — /admin/wakeup이 같은 기숙사 채널에 브로드캐스트로 알려주는
  // 위치를 받아서, 오늘 줄에서 그 자리만 '재생 중'으로 덮어써서 보여준다.
  const [livePosition, setLivePosition] = useState<number | null>(null);
  useEffect(() => {
    setLivePosition(null);
    const channel = supabase
      .channel(`wakeup-live-${dorm}`)
      .on('broadcast', { event: 'now-playing' }, ({ payload }) => setLivePosition(payload?.position ?? null))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dorm]);

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

  const [deleteTarget, setDeleteTarget] = useState<WakeupSong | null>(null);
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('wakeup_songs').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    if (error) { showError('삭제 실패: ' + error.message); return; }
    showSuccess('신청을 삭제했어요.');
    fetchAll();
  };

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
      play_date: selectedDateStr,
      youtube_video_id: preview.videoId,
      title: preview.title,
      channel_title: preview.channelTitle,
      thumbnail_url: preview.thumbnailUrl,
      message: message.trim(),
    });
    setSubmitting(false);
    if (error) { showError('신청 실패: ' + error.message); return; }
    showSuccess(`${format(selectedDate, 'M/d(eee)', { locale: ko })} 대기열에 바로 올라갔어요!`);
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
          <p className="text-sm text-muted-foreground font-medium">듣고 싶은 노래를 신청하면 바로 그날 아침 대기열에 올라가요.</p>
        </div>
        <SegmentedTabs items={DORMS.map(d => ({ value: d, label: d }))} value={dorm} onChange={changeDorm} />
      </div>

      {/* ── 대기열 (읽기 전용 — 재생은 담당자가 /admin/wakeup에서 처리) ────
          오늘 나올 8곡 전체를 재생 여부와 상관없이 보여준다 — 신청곡이
          모자란 자리는 자동 채움 곡으로 채워서, 실제로 그날 나갈 순서
          그대로 미리 볼 수 있게. */}
      <div className="rounded-[28px] border border-primary/15 bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Music className="size-5 text-primary" />
          <h2 className="text-lg font-black">{dorm} · {format(selectedDate, 'M/d(eee)', { locale: ko })} 대기열</h2>
          <Badge variant="default">{queue.length}곡 신청</Badge>
        </div>
        <ul className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
          {withFiller(queue).map((song, i) => {
            // 자동 채움 곡은 DB 행이 없어 status로 '재생 중'을 알 수 없다 —
            // 오늘 날짜에서만, 담당자가 브로드캐스트로 알려준 지금 재생 위치와
            // 일치하면 상태 대신 그걸로 보여준다.
            const isLiveNow = selectedDateStr === todayStr() && i === livePosition;
            const badge = isLiveNow ? { label: '재생 중', variant: 'warning' as const } : STATUS_BADGE[song.status];
            return (
              <li key={song.id ?? song._key} className="flex items-center gap-2 text-xs p-2 rounded-lg">
                <span className="text-muted-foreground font-black w-4 shrink-0">{i + 1}</span>
                <span className={`truncate flex-1 font-semibold ${song.isFiller ? 'text-muted-foreground italic' : ''}`}>{song.title}</span>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── 신청 폼 ──────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="rounded-[28px] border border-border/60 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2"><Send className="size-5 text-primary" /><h2 className="text-lg font-black">{dorm}에 신청하기</h2></div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">틀어줄 날짜</label>
          <div className="flex gap-1.5 overflow-x-auto py-1 -mx-1 px-1">
            {NEXT_14_DAYS.map((day, i) => {
              const isSelected = isSameDay(day, selectedDate);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center gap-0.5 shrink-0 px-2.5 py-1.5 rounded-xl border text-center transition-all active:scale-95 ${
                    isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border/50 hover:bg-muted/30'
                  }`}
                >
                  <span className="text-[9px] font-bold opacity-70">{i === 0 ? '오늘' : i === 1 ? '내일' : format(day, 'eee', { locale: ko })}</span>
                  <span className="text-xs font-black">{format(day, 'M/d')}</span>
                </button>
              );
            })}
          </div>
        </div>

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
                <Button size="icon-sm" variant="ghost" onClick={() => setDeleteTarget(song)} aria-label="신청 삭제"><Trash2 className="size-4 text-destructive" /></Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="신청을 삭제할까요?"
        description={deleteTarget ? `"${deleteTarget.title}" 신청을 삭제합니다. 이 작업은 되돌릴 수 없어요.` : ''}
        confirmLabel="삭제"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

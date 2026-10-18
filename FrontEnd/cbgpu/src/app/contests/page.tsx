'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Trophy, ArrowRight, CalendarDays, Layers3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Contest, contestClosed, contestError, formatContestDate } from '@/lib/contests';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/spinner';
import { useContestClock } from '@/components/contests/ContestClock';
import { ContestLogo } from '@/components/contests/ContestLogo';

export default function ContestsPage() {
  const { user } = useAuth();
  const [contests, setContests] = useState<Contest[]>([]);
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { now } = useContestClock();
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.from('contests').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setContests(data || []);
    } catch (error) { setError(contestError(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const visible = mine ? contests.filter(c => c.host_id === user?.id) : contests.filter(c => c.lifecycle_status !== 'archived' && (c.visibility !== 'unlisted' || c.host_id === user?.id));

  return (
    <div className="contest-page mx-auto max-w-6xl space-y-9">
      <header className="contest-hero flex flex-wrap items-center justify-between gap-8">
        <div className="relative max-w-lg"><p className="contest-eyebrow mb-6 flex items-center gap-2"><Trophy className="size-3.5" />CBGPU CHALLENGES</p><h1 className="text-4xl font-bold tracking-tight sm:text-5xl">아이디어가 만나는 무대,<br /><span className="mt-2 block text-[#cde2b9]">교내 대회</span></h1><p className="mt-5 max-w-sm text-sm leading-relaxed text-white/65">참가 신청부터 행사 일정, 체크인과 작품 제출까지.<br />우리의 가능성을 한곳에 모아요.</p></div>
        <div className="flex flex-col items-start gap-4 sm:pr-8"><Button asChild className="contest-hero-button" size="lg"><Link href="/contests/new"><Plus />교내 대회 만들기<ArrowRight className="ml-3" /></Link></Button><p className="text-xs text-white/50">행사를 열고 참가 신청부터 작품 제출까지 관리하세요.</p></div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-xl font-bold tracking-tight">{mine ? '내가 만든 도전' : '지금, 새로운 도전'}</h2><p className="mt-1 text-xs text-muted-foreground">{loading ? '대회를 불러오고 있어요.' : `${visible.length}개의 대회를 만나보세요.`}</p></div>
        <div className="contest-tabs" aria-label="대회 필터"><button type="button" aria-pressed={!mine} onClick={() => setMine(false)}>전체 대회</button><button type="button" aria-pressed={mine} onClick={() => setMine(true)}>내가 연 대회</button></div>
      </div>
      {loading ? <div className="flex justify-center py-16"><LoadingSpinner /></div> : error ? <div role="alert" className="rounded-2xl border p-6"><p className="mb-4 text-sm text-destructive">{error}</p><Button onClick={() => void load()} variant="outline">다시 불러오기</Button></div> : !visible.length ? <div className="rounded-3xl border border-dashed p-12 text-center text-muted-foreground">{mine ? '아직 개설한 대회가 없어요.' : '아직 등록된 대회가 없어요.'}</div> : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visible.map(contest => (
          <Link key={contest.id} href={`/contests/${contest.id}`} className="contest-card group">
            <div className="mb-6 flex items-start justify-between gap-3"><ContestLogo path={contest.logo_path} title={contest.title} /><span className="contest-status" data-closed={now !== null && contestClosed(contest, now)}><span className="contest-status-dot" />{now === null ? '확인 중' : contestClosed(contest, now) ? '접수 마감' : '접수 중'}</span></div>
            <h3 className="break-words text-xl font-bold tracking-tight">{contest.title}</h3><p className="mt-3 line-clamp-2 min-h-12 text-sm leading-relaxed text-muted-foreground">{contest.description || '제출 항목을 확인하고 새로운 도전에 참여해 보세요.'}</p>
            <div className="mt-6 space-y-2 text-xs text-muted-foreground"><p className="flex items-start gap-2"><CalendarDays className="size-3.5 shrink-0" />{contest.event_start_at ? `행사 ${formatContestDate(contest.event_start_at)}` : `제출 마감 ${formatContestDate(contest.ends_at)}`}</p><p className="flex items-center gap-2"><Layers3 className="size-3.5" />작품 제출 항목 {contest.fields.length}개{contest.host_id === user?.id && <span className="ml-auto font-semibold text-primary">내가 연 대회</span>}</p></div>
            <span className="mt-6 flex items-center justify-between border-t pt-4 text-sm font-semibold text-primary">{contest.host_id === user?.id ? '제출물 관리' : '대회 살펴보기'}<ArrowRight className="size-4" /></span>
          </Link>
        ))}</div>
      )}
    </div>
  );
}

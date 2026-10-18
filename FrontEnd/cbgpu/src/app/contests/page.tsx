'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Trophy, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Contest, contestClosed, contestError, formatContestDate } from '@/lib/contests';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/spinner';
import { useContestClock } from '@/components/contests/ContestClock';

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
  const visible = mine ? contests.filter(c => c.host_id === user?.id) : contests;

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-500"><Trophy /></div><h1 className="text-3xl font-black tracking-tight">대회 제출</h1><p className="mt-2 text-sm text-muted-foreground">대회를 열고, 필요한 제출물을 한곳에서 받아보세요.</p></div>
        <Button asChild><Link href="/contests/new"><Plus />대회 만들기</Link></Button>
      </header>
      <div className="flex gap-2" aria-label="대회 필터">
        <Button variant={!mine ? 'default' : 'outline'} onClick={() => setMine(false)}>전체 대회</Button>
        <Button variant={mine ? 'default' : 'outline'} onClick={() => setMine(true)}>내가 연 대회</Button>
      </div>
      {loading ? <div className="flex justify-center py-16"><LoadingSpinner /></div> : error ? <div role="alert" className="rounded-2xl border p-6"><p className="mb-4 text-sm text-destructive">{error}</p><Button onClick={() => void load()} variant="outline">다시 불러오기</Button></div> : !visible.length ? <div className="rounded-3xl border border-dashed p-12 text-center text-muted-foreground">{mine ? '아직 개설한 대회가 없어요.' : '아직 등록된 대회가 없어요.'}</div> : (
        <div className="grid gap-4 sm:grid-cols-2">{visible.map(contest => (
          <Link key={contest.id} href={`/contests/${contest.id}`} className="group flex flex-col rounded-3xl border bg-card p-6 transition-colors hover:border-primary/40">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold"><span className="rounded-full bg-muted px-3 py-1">{now === null ? '접수 상태 확인 중' : contestClosed(contest, now) ? '마감' : '접수 중'}</span>{contest.host_id === user?.id && <span className="text-primary">내가 연 대회</span>}</div>
            <h2 className="text-lg font-bold break-words">{contest.title}</h2><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{contest.description || '제출 항목을 확인하고 참가해 보세요.'}</p>
            <p className="mt-5 text-xs text-muted-foreground">{formatContestDate(contest.ends_at)}</p>
            <span className="mt-4 flex items-center gap-2 text-sm font-bold text-primary">{contest.host_id === user?.id ? '제출물 관리' : '제출하러 가기'}<ArrowRight className="size-4" /></span>
          </Link>
        ))}</div>
      )}
    </div>
  );
}

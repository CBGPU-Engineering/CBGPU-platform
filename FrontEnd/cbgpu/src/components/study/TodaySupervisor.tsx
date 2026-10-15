'use client';

import { useEffect, useState } from 'react';
import { koreaDate, SUPERVISOR_SOURCE } from '@/lib/studySupervisor';

type Assignment = { date: string; teachers: string[]; checkedAt: string };

export default function TodaySupervisor() {
  const [data, setData] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [date, setDate] = useState(koreaDate);

  useEffect(() => {
    const timer = setInterval(() => setDate(koreaDate()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch('/api/study/supervisor', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('조회 실패');
        const result: Assignment = await response.json();
        if (result.date !== koreaDate() || !Array.isArray(result.teachers) || !result.teachers.length) throw new Error('날짜 불일치');
        if (!controller.signal.aborted) setData(result);
      } catch {
        if (!controller.signal.aborted) { setData(null); setFailed(true); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    const timer = setInterval(load, 15 * 60_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [date, retry]);

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 space-y-2" aria-label="오늘의 자습감독">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black">오늘의 자습감독 선생님</h2>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>
      <div aria-live="polite">
        {loading ? <p className="text-sm text-muted-foreground">담당 선생님 확인 중…</p>
          : failed ? <p className="text-sm text-muted-foreground">감독 정보를 불러오지 못했습니다. <button className="underline" onClick={() => setRetry(n => n + 1)}>다시 시도</button></p>
          : data?.date === date && <p className="font-bold text-primary">{data.teachers.map(name => `${name} 선생님`).join(' · ')}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>감독 일정은 학교 사정에 따라 변경될 수 있습니다.</span>
        <a href={SUPERVISOR_SOURCE} target="_blank" rel="noopener noreferrer" className="underline">원본 확인</a>
      </div>
    </section>
  );
}

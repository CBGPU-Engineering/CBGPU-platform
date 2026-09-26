'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowUpRight } from 'lucide-react';
import { useCachedAi } from '@/lib/useCachedAi';

function localYmd() {
  const date = new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

export default function DailyBriefing() {
  const [date] = useState(localYmd);
  const [lunch, setLunch] = useState<string[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      fetch(`/api/meal?date=${date}`, { signal: controller.signal }).then(response => response.json()),
      fetch('/api/school-news?type=notice', { signal: controller.signal }).then(response => response.json()),
    ]).then(([mealResult, newsResult]) => {
      if (controller.signal.aborted) return;
      if (mealResult.status === 'fulfilled') {
        const meal = mealResult.value?.meals?.find((item: { type: string }) => item.type === '중식');
        setLunch(Array.isArray(meal?.items) ? meal.items.slice(0, 5) : []);
      }
      if (newsResult.status === 'fulfilled') {
        setNotices((newsResult.value?.items ?? []).slice(0, 3).map((item: { title: string }) => item.title));
      }
      setLoaded(true);
    });
    return () => controller.abort();
  }, [date]);

  const input = loaded && (lunch.length || notices.length)
    ? `날짜: ${date}\n오늘 중식: ${lunch.join(', ') || '정보 없음'}\n최근 공지 제목: ${notices.join(' / ') || '정보 없음'}`
    : '';
  const insight = useCachedAi('daily', input, `home:${date}`, !!input);
  if (!loaded || !input) return null;

  return (
    <section className="rounded-[28px] border border-primary/15 bg-card p-5 shadow-sm sm:p-6" aria-label="오늘 한눈에">
      <div className="mb-4 flex items-center gap-2"><Sparkles className="size-5 text-primary" /><h2 className="text-lg font-black">오늘 한눈에</h2></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/meal" className="rounded-2xl bg-muted/50 p-4 transition-colors hover:bg-muted"><span className="flex items-center justify-between text-xs font-bold text-muted-foreground">오늘 중식<ArrowUpRight className="size-4" /></span><span className="mt-2 block line-clamp-2 text-sm font-semibold">{lunch.length ? lunch.join(' · ') : '급식 정보가 없어요'}</span></Link>
        <Link href="/feed" className="rounded-2xl bg-muted/50 p-4 transition-colors hover:bg-muted"><span className="flex items-center justify-between text-xs font-bold text-muted-foreground">최근 학교 공지<ArrowUpRight className="size-4" /></span><span className="mt-2 block line-clamp-2 text-sm font-semibold">{notices[0] || '최근 공지가 없어요'}</span></Link>
      </div>
      {insight && <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed"><span className="mr-1.5 text-xs font-black text-primary">AI</span>{insight}</p>}
      <p className="mt-3 text-[11px] text-muted-foreground">AI 문장은 메뉴와 공지 제목만 참고합니다. 자세한 내용은 원문을 확인하세요.</p>
    </section>
  );
}

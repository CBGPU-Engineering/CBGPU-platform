'use client';

import { Sparkles } from 'lucide-react';
import { useCachedAi } from '@/lib/useCachedAi';

export default function HeadlineTrend({ titles, scope }: { titles: string[]; scope: string }) {
  const input = titles.slice(0, 8).map((title, index) => `${index + 1}. ${title}`).join('\n');
  const trend = useCachedAi('news', input, `headlines:${scope}`, titles.length >= 3);
  if (!trend) return null;
  return <p className="flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-relaxed text-foreground"><Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" /><span><span className="font-black text-primary">제목으로 본 흐름 · </span>{trend}<span className="ml-1 text-muted-foreground">기사 본문은 분석하지 않았어요.</span></span></p>;
}

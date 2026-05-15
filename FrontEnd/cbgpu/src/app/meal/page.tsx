'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MealItem {
  type: string;
  items: string[];
  calories: string;
}

interface MealData {
  meals: MealItem[];
  date: string;
  today: string;
  source?: string;
  note?: string;
  error?: string;
}

const TYPE_CARD: Record<string, string> = {
  '조식': 'border-amber-500/30 bg-amber-500/5',
  '중식': 'border-green-500/30 bg-green-500/5',
  '석식': 'border-indigo-500/30 bg-indigo-500/5',
};
const TYPE_BADGE: Record<string, string> = {
  '조식': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  '중식': 'bg-green-500/10 text-green-600 dark:text-green-400',
  '석식': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
};

function fmtDate(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function parseYmd(ymd: string): Date {
  return new Date(+ymd.slice(0,4), +ymd.slice(4,6) - 1, +ymd.slice(6,8));
}

function displayDate(ymd: string) {
  const d = parseYmd(ymd);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

function shiftDate(ymd: string, delta: number) {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + delta);
  return fmtDate(d);
}

export default function MealPage() {
  const [date, setDate] = useState(() => fmtDate(new Date()));
  const [data, setData] = useState<MealData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meal?date=${d}`);
      setData(await res.json());
    } catch {
      setData({ meals: [], date: d, today: fmtDate(new Date()), error: '불러오기 실패' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const today = fmtDate(new Date());

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic">급식 메뉴</h1>
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">충북과학고등학교 학교급식</p>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="size-9" onClick={() => setDate(d => shiftDate(d, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <p className="flex-1 text-center font-black text-sm tracking-tight">{displayDate(date)}</p>
        <Button variant="outline" size="icon" className="size-9" onClick={() => setDate(d => shiftDate(d, +1))}>
          <ChevronRight className="size-4" />
        </Button>
        {date !== today && (
          <Button variant="outline" size="sm" onClick={() => setDate(today)} className="font-black text-[11px] uppercase tracking-widest h-9 px-3">
            오늘
          </Button>
        )}
        <Button variant="ghost" size="icon" className="size-9" onClick={() => load(date)}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-36 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : data?.error ? (
        <Empty icon={<UtensilsCrossed className="size-10 mx-auto mb-3 opacity-30" />} title={data.error} />
      ) : !data?.meals?.length ? (
        <Empty
          icon={<UtensilsCrossed className="size-10 mx-auto mb-3 opacity-30" />}
          title="급식 정보가 없습니다"
          sub={data?.note ?? '주말이나 방학일 수 있습니다'}
        />
      ) : (
        <div className="space-y-4">
          {data.meals.map((meal) => (
            <div key={meal.type} className={`border rounded-2xl p-5 ${TYPE_CARD[meal.type] ?? 'border-border/50 bg-card'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wide ${TYPE_BADGE[meal.type] ?? 'bg-primary/10 text-primary'}`}>
                  {meal.type}
                </span>
                {meal.calories && (
                  <span className="text-[11px] font-bold text-muted-foreground">{meal.calories}</span>
                )}
              </div>
              <ul className="space-y-1.5">
                {meal.items.map((item, i) => (
                  <li key={i} className="text-sm font-medium text-foreground/90 flex items-start gap-1.5">
                    <span className="opacity-30 mt-0.5 shrink-0">·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function Empty({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="py-20 text-center border-2 border-dashed rounded-3xl text-muted-foreground">
      {icon}
      <p className="font-black text-base">{title}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

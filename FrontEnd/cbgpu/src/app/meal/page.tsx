'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Sunrise, Sun, Moon, UtensilsCrossed } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/spinner';

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

const TYPE_ICON: Record<string, typeof Sunrise> = {
  '조식': Sunrise,
  '중식': Sun,
  '석식': Moon,
};
const TYPE_COLOR: Record<string, string> = {
  '조식': 'text-amber-400 bg-amber-400/10',
  '중식': 'text-orange-400 bg-orange-400/10',
  '석식': 'text-indigo-400 bg-indigo-400/10',
};

function fmtDate(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function parseYmd(ymd: string): Date {
  return new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8));
}

function displayDate(ymd: string) {
  const d = parseYmd(ymd);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return { full: `${d.getMonth() + 1}월 ${d.getDate()}일`, dow: `${days[d.getDay()]}요일`, year: d.getFullYear() };
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
  const [justLoaded, setJustLoaded] = useState(false);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right');

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setJustLoaded(false);
    try {
      const res = await fetch(`/api/meal?date=${d}`);
      setData(await res.json());
    } catch {
      setData({ meals: [], date: d, today: fmtDate(new Date()), error: '불러오기 실패' });
    } finally {
      setLoading(false);
      setJustLoaded(true);
      setTimeout(() => setJustLoaded(false), 600);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const today = fmtDate(new Date());
  const { full, dow, year } = displayDate(date);

  function navigate(delta: number) {
    setSlideDir(delta > 0 ? 'left' : 'right');
    setDate(d => shiftDate(d, delta));
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-1">
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">충북과학고 학교급식</p>
        <h1 className="text-3xl font-black tracking-tight">오늘 뭐 나와요?</h1>
      </div>

      {/* 날짜 네비게이션 — 큰 날짜 카드, 좌우로 물리적으로 밀어내는 느낌 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-12 rounded-full bg-card ring-1 ring-foreground/5 shadow-sm shrink-0 active:scale-90 transition-transform"
        >
          <ChevronLeft className="size-5" />
        </button>

        <div key={date} className={`flex-1 text-center overflow-hidden ${slideDir === 'left' ? 'animate-in slide-in-from-right-8' : 'animate-in slide-in-from-left-8'} fade-in duration-300 ease-[var(--ease-spring)]`}>
          <p className="text-2xl font-black tracking-tight">{full} <span className="text-muted-foreground font-bold">{dow}</span></p>
          <p className="text-[11px] font-bold text-muted-foreground/70">{year}</p>
        </div>

        <button
          onClick={() => navigate(1)}
          className="flex items-center justify-center size-12 rounded-full bg-card ring-1 ring-foreground/5 shadow-sm shrink-0 active:scale-90 transition-transform"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {date !== today && (
        <button
          onClick={() => { setSlideDir(date > today ? 'right' : 'left'); setDate(today); }}
          className="block mx-auto text-[11px] font-black uppercase tracking-widest text-primary active:scale-95 transition-transform"
        >
          ← 오늘로 돌아가기
        </button>
      )}

      {/* Content */}
      {loading ? (
        <div className="py-16 flex items-center justify-center">
          <LoadingSpinner done={justLoaded} size={64} label="급식 정보 불러오는 중" />
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
        <div className="grid gap-4">
          {data.meals.map((meal, i) => {
            const Icon = TYPE_ICON[meal.type] ?? UtensilsCrossed;
            return (
              <div
                key={meal.type}
                style={{ animationDelay: `${i * 70}ms` }}
                className="tilt-3d flex flex-col gap-4 p-6 rounded-[28px] bg-card ring-1 ring-foreground/5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-400 fill-mode-backwards"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center justify-center size-11 rounded-2xl ${TYPE_COLOR[meal.type] ?? 'bg-primary/10 text-primary'}`}>
                      <Icon className="size-5" strokeWidth={2} />
                    </span>
                    <p className="font-black text-lg tracking-tight">{meal.type}</p>
                  </div>
                  {meal.calories && (
                    <span className="text-[11px] font-bold text-muted-foreground">{meal.calories}</span>
                  )}
                </div>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {meal.items.map((item, j) => (
                    <li key={j} className="text-sm font-medium text-foreground/90 flex items-start gap-1.5">
                      <span className="opacity-30 mt-0.5 shrink-0">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
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

'use client';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function fmt(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}
function display(d: Date) {
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
}

const MEAL_COLOR: Record<string, string> = {
  '조식': 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  '중식': 'bg-green-500/15 text-green-700 dark:text-green-300',
  '석식': 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
};

export default function MealMenu() {
  const [date,   setDate]   = useState(new Date());
  const [meals,  setMeals]  = useState<any[]>([]);
  const [loading,setLoading]= useState(false);
  const [error,  setError]  = useState('');

  const load = async (d: Date) => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/api/meal?date=${fmt(d)}`);
      const json = await res.json();
      if (json.error && !json.meals?.length) throw new Error(json.error);
      setMeals(json.meals ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(date); }, []);

  const move = (n: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    setDate(d);
    load(d);
  };

  return (
    <div className="w-full space-y-4">
      {/* date nav */}
      <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-2">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => move(-1)}><ChevronLeft className="size-4" /></Button>
        <div className="text-center">
          <p className="font-black text-sm">{display(date)}</p>
          {fmt(date) === fmt(new Date()) && <p className="text-[10px] text-primary font-bold">오늘</p>}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => move(1)}><ChevronRight className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => load(date)} disabled={loading}>
            <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl font-medium">{error}</p>}

      {loading && (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-32 bg-muted/40 animate-pulse rounded-2xl" />)}</div>
      )}

      {!loading && meals.length === 0 && !error && (
        <div className="py-16 text-center text-muted-foreground">
          <Utensils className="size-8 mx-auto mb-2 opacity-30" />
          <p className="font-medium text-sm">이 날의 급식 정보가 없습니다.</p>
        </div>
      )}

      <div className="space-y-3">
        {meals.map((meal, i) => (
          <div
            key={i}
            style={{ animationDelay: `${i * 60}ms` }}
            className="p-4 rounded-2xl border border-border/40 bg-card space-y-2 tilt-3d transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
          >
            <div className="flex items-center gap-2">
              <Badge className={MEAL_COLOR[meal.type] ?? 'bg-muted text-muted-foreground'}>{meal.type}</Badge>
              {meal.calories && (
                <span className="text-[10px] text-muted-foreground font-medium">{meal.calories}</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {meal.menu?.split('\n').filter(Boolean).map((item: string, j: number) => (
                <span key={j} className="text-xs font-medium bg-muted/40 px-2.5 py-1 rounded-lg text-foreground/80 text-center">
                  {item.trim()}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {meals.length > 0 && (
        <p className="text-[10px] text-muted-foreground text-center">출처: 나이스 교육정보 개방 포털</p>
      )}
    </div>
  );
}

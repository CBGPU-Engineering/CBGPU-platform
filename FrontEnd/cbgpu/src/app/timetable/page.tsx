'use client';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DAYS = ['월', '화', '수', '목', '금'];
const MAX_PERIODS = 7;

// 과목명 → 색상 (해시 기반)
function subjectColor(name: string): string {
  if (!name) return 'bg-muted/30 text-muted-foreground';
  const COLORS = [
    'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20',
    'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/20',
    'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20',
    'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/20',
    'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/20',
    'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
    'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/20',
    'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/20',
    'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
    'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/20',
  ];
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}

interface Cell { subject?: string; teacher?: string }
type TimetableData = Record<string, Record<string, Cell>>; // weekday → period → cell

export default function TimetablePage() {
  const [grade, setGrade]   = useState(1);
  const [cls, setCls]       = useState(1);
  const [grades, setGrades] = useState<number[]>([1, 2, 3]);
  const [classes, setClasses] = useState<number[]>([1]);
  const [data, setData]     = useState<TimetableData>({});
  const [times, setTimes]   = useState<{hour:number;min:number}[]>([]);
  const [school, setSchool] = useState('충북과학고등학교');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [updated, setUpdated] = useState<Date|null>(null);
  const todayIdx = new Date().getDay(); // 0=Sun, 1=Mon...

  const load = useCallback(async (g: number, c: number) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/timetable?grade=${g}&class=${c}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.timetable ?? {});
      setTimes(json.times ?? []);
      if (json.grades?.length) setGrades(json.grades);
      if (json.classes?.length) setClasses(json.classes);
      if (json.school?.name) setSchool(json.school.name);
      setUpdated(new Date());
    } catch (e: any) {
      setError(e.message ?? '시간표를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(grade, cls); }, []);

  const handleGrade = (g: number) => { setGrade(g); load(g, cls); };
  const handleCls   = (c: number) => { setCls(c);   load(grade, c); };

  // 각 교시별 최대 period 파악
  const maxPeriod = Math.max(
    MAX_PERIODS,
    ...Object.values(data).flatMap(d => Object.keys(d).map(Number))
  );
  const periods = Array.from({length: maxPeriod}, (_, i) => i + 1);

  return (
    <main className="px-4 py-8 space-y-6 max-w-4xl mx-auto">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">시간표</h1>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
            {school} · 컴시간알리미
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* grade selector */}
          <div className="flex gap-1">
            {grades.map(g => (
              <button key={g} onClick={() => handleGrade(g)}
                className={`px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${
                  grade === g ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}>{g}학년</button>
            ))}
          </div>
          {/* class selector */}
          <div className="flex gap-1">
            {classes.map(c => (
              <button key={c} onClick={() => handleCls(c)}
                className={`px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${
                  cls === c ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}>{c}반</button>
            ))}
          </div>
          {updated && <span className="text-[10px] text-muted-foreground">{updated.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span>}
          <Button variant="ghost" size="icon" className="size-7" onClick={() => load(grade, cls)} disabled={loading}>
            <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <a href="http://xn--s39aj90b0nb2xw6xh.kr/" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="size-7"><ExternalLink className="size-3" /></Button>
          </a>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{error}</p>
            <p className="text-xs text-muted-foreground mt-0.5">컴시간 서버가 응답하지 않을 수 있습니다. 잠시 후 다시 시도하세요.</p>
          </div>
        </div>
      )}

      {loading && !Object.keys(data).length && (
        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({length: 6 * 7}).map((_, i) => (
            <div key={i} className="h-14 bg-muted/40 animate-pulse rounded-lg" style={{opacity: 1 - (i % 7) * 0.08}} />
          ))}
        </div>
      )}

      {/* timetable grid */}
      {Object.keys(data).length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-12 p-2 text-[10px] font-black text-muted-foreground uppercase" />
                {DAYS.map((day, i) => (
                  <th key={day}
                    className={`p-2 text-[11px] font-black uppercase tracking-widest text-center rounded-t-lg ${
                      todayIdx === i + 1 ? 'text-primary bg-primary/5' : 'text-muted-foreground'
                    }`}
                  >
                    {day}
                    {todayIdx === i + 1 && <span className="ml-1 text-[8px] text-primary">오늘</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map(p => (
                <tr key={p} className="group">
                  <td className="p-1 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[10px] font-black text-muted-foreground">{p}</span>
                      {times[p - 1] && (
                        <span className="text-[8px] text-muted-foreground/50">
                          {String(times[p-1].hour).padStart(2,'0')}:{String(times[p-1].min).padStart(2,'0')}
                        </span>
                      )}
                    </div>
                  </td>
                  {DAYS.map((_, di) => {
                    const weekday = di + 1;
                    const cell: Cell = data[weekday]?.[p] ?? {};
                    const isToday = todayIdx === weekday;
                    return (
                      <td key={di} className={`p-0.5 ${isToday ? 'bg-primary/3' : ''}`}>
                        {cell.subject ? (
                          <div className={`h-14 px-1.5 py-1 rounded-lg border text-center flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-105 ${subjectColor(cell.subject)} ${isToday ? 'shadow-sm' : ''}`}>
                            <span className="text-[11px] font-black leading-tight line-clamp-1">{cell.subject}</span>
                            {cell.teacher && <span className="text-[9px] opacity-60 leading-tight">{cell.teacher}</span>}
                          </div>
                        ) : (
                          <div className="h-14 rounded-lg bg-muted/10 border border-transparent" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        데이터 출처: 컴시간알리미 · 매 1시간 캐시
      </p>
    </main>
  );
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DAYS  = ['월', '화', '수', '목', '금'];
const MAX_P = 7;

function subjectColor(name: string): string {
  if (!name?.trim()) return '';
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
  const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return COLORS[h % COLORS.length];
}

function fmtWeek(mondayTs: number) {
  const d = new Date(mondayTs);
  const e = new Date(mondayTs + 4 * 86400000);
  return `${d.getMonth()+1}/${d.getDate()} – ${e.getMonth()+1}/${e.getDate()}`;
}

type Grid = Record<number, Record<number, string>>; // weekday → period → subject

export default function TimetablePage() {
  const [grade,   setGrade]   = useState(1);
  const [cls,     setCls]     = useState(1);
  const [weekOff, setWeekOff] = useState(0);
  const [grades,  setGrades]  = useState([1,2,3]);
  const [classes, setClasses] = useState([1,2,3,4]);
  const [grid,    setGrid]    = useState<Grid>({});
  const [school,  setSchool]  = useState('충북과학고등학교');
  const [weekLabel, setWeekLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const todayWd = (() => { const d = new Date().getDay(); return d === 0 ? -1 : d - 1; })();

  const load = useCallback(async (g: number, c: number, w: number) => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/api/timetable?grade=${g}&class=${c}&week=${w}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setGrid(json.grid ?? {});
      if (json.school)  setSchool(json.school);
      if (json.grades)  setGrades(json.grades);
      if (json.classes) setClasses(json.classes);
      if (json.mondayTs) setWeekLabel(fmtWeek(json.mondayTs));
    } catch (e: any) {
      setError(e.message ?? '시간표를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(grade, cls, weekOff); }, []);

  const handleGrade = (g: number) => { setGrade(g); load(g, cls, weekOff); };
  const handleCls   = (c: number) => { setCls(c);   load(grade, c, weekOff); };
  const handleWeek  = (delta: number) => {
    const nw = weekOff + delta;
    setWeekOff(nw);
    load(grade, cls, nw);
  };

  const maxPeriod = Math.max(MAX_P, ...Object.values(grid).flatMap(d => Object.keys(d).map(Number)));
  const periods   = Array.from({ length: maxPeriod }, (_, i) => i + 1);
  const hasData   = Object.keys(grid).length > 0;

  return (
    <main className="px-4 py-8 space-y-6 max-w-4xl mx-auto">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">시간표</h1>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
            {school} · 나이스 교육정보 개방 포털
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* grade */}
          <div className="flex gap-1">
            {grades.map(g => (
              <button key={g} onClick={() => handleGrade(g)}
                className={`px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${grade===g?'bg-primary text-primary-foreground shadow-md':'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                {g}학년
              </button>
            ))}
          </div>
          {/* class */}
          <div className="flex gap-1">
            {classes.map(c => (
              <button key={c} onClick={() => handleCls(c)}
                className={`px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${cls===c?'bg-primary text-primary-foreground shadow-md':'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                {c}반
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => load(grade, cls, weekOff)} disabled={loading}>
            <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <a href="https://open.neis.go.kr" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="size-7"><ExternalLink className="size-3" /></Button>
          </a>
        </div>
      </div>

      {/* week navigator */}
      <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-2">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => handleWeek(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-center">
          <p className="font-black text-sm">{weekLabel}</p>
          {weekOff !== 0 && (
            <button onClick={() => handleWeek(-weekOff)}
              className="text-[10px] text-primary font-bold hover:underline">
              이번 주로
            </button>
          )}
          {weekOff === 0 && <p className="text-[10px] text-muted-foreground font-medium">이번 주</p>}
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => handleWeek(1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{error}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              NEIS SAMPLE 키는 하루 1,000회 제한입니다.{' '}
              <a href="https://open.neis.go.kr" target="_blank" rel="noopener noreferrer" className="underline">
                open.neis.go.kr
              </a>에서 무료 API 키를 발급받아 <code className="bg-muted px-1 rounded text-xs">NEIS_API_KEY</code> 환경변수로 설정하세요.
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({ length: 6*7 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted/40 animate-pulse rounded-lg" style={{opacity: 1-(i%7)*0.08}} />
          ))}
        </div>
      )}

      {!loading && hasData && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-10 p-1" />
                {DAYS.map((day, i) => (
                  <th key={day} className={`p-2 text-[11px] font-black uppercase tracking-widest text-center ${
                    weekOff === 0 && todayWd === i
                      ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {day}
                    {weekOff === 0 && todayWd === i && (
                      <span className="block text-[8px] text-primary/70">오늘</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map(p => (
                <tr key={p}>
                  <td className="p-1 text-center">
                    <span className="text-[10px] font-black text-muted-foreground">{p}</span>
                  </td>
                  {DAYS.map((_, di) => {
                    const subj: string = grid[di]?.[p] ?? '';
                    const isToday = weekOff === 0 && todayWd === di;
                    return (
                      <td key={di} className={`p-0.5 ${isToday ? 'bg-primary/3' : ''}`}>
                        {subj ? (
                          <div className={`h-12 px-1.5 rounded-lg border text-center flex items-center justify-center transition-all hover:scale-105 ${subjectColor(subj)} ${isToday ? 'shadow-sm' : ''}`}>
                            <span className="text-[11px] font-black leading-tight line-clamp-2">{subj}</span>
                          </div>
                        ) : (
                          <div className="h-12 rounded-lg bg-muted/10 border border-transparent" />
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

      {!loading && !hasData && !error && (
        <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-3xl font-medium">
          이번 주 시간표 데이터가 없습니다.
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        데이터: 나이스 교육정보 개방 포털 · 1시간 캐시 ·{' '}
        <a href="https://open.neis.go.kr" target="_blank" rel="noopener noreferrer" className="hover:underline">
          API 키 발급
        </a>
      </p>
    </main>
  );
}

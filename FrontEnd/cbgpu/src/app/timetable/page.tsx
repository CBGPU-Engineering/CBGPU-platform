'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Edit3, Save, X, RotateCcw, RefreshCw, AlertTriangle } from 'lucide-react';
import { getComciganTimetable, extractGrid, type ComciGrid } from '@/lib/comcigan';

// ─── constants ────────────────────────────────────────────────────────────────
const DAYS    = ['월', '화', '수', '목', '금'];
const MAX_P   = 7;
const PERIODS = Array.from({ length: MAX_P }, (_, i) => i + 1);

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
const cc: Record<string, string> = {};
function subjectColor(name: string) {
  if (!name) return '';
  if (!cc[name]) { const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0); cc[name] = COLORS[h % COLORS.length]; }
  return cc[name];
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default function TimetablePage() {
  const { isAdmin } = useAuth();
  const [grade,   setGrade]   = useState(1);
  const [cls,     setCls]     = useState(1);
  const [grades,  setGrades]  = useState([1, 2, 3]);
  const [classes, setClasses] = useState([1, 2, 3, 4]);
  const [grid,    setGrid]    = useState<ComciGrid>({});
  // draft: grade/class/wd/period → subject string (manual edit)
  const [draft,   setDraft]   = useState<Record<number, Record<number, string>>>({});
  const [rawData, setRawData] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [source,  setSource]  = useState<'comcigan' | 'manual'>('comcigan');
  const [dbMissing, setDbMissing] = useState(false);

  const todayWd = (() => { const d = new Date().getDay(); return d === 0 ? -1 : d - 1; })();

  // ── apply grade/class to already-fetched rawData ──────────────────────────
  const applyGrid = useCallback((raw: any, g: number, c: number) => {
    const { grid: g2, classes: cls2 } = extractGrid(raw, g, c);
    setGrid(g2);
    if (cls2.length) setClasses(cls2);
  }, []);

  // ── 컴시간 fetch (browser → allorigins → comci.kr) ───────────────────────
  const loadComcigan = useCallback(async (g: number, c: number) => {
    setLoading(true); setError('');
    try {
      const { grades: g2, rawData: raw } = await getComciganTimetable();
      setRawData(raw);
      if (g2.length) setGrades(g2);
      applyGrid(raw, g, c);
      setSource('comcigan');
    } catch (e: any) {
      const msg = e.message ?? String(e);
      setError(msg);
      await loadManual(g, c);
    } finally {
      setLoading(false);
    }
  }, [applyGrid]); // eslint-disable-line

  // ── Supabase fallback ─────────────────────────────────────────────────────
  const loadManual = useCallback(async (g: number, c: number) => {
    const { data, error: dbErr } = await supabase
      .from('timetable')
      .select('weekday, period, subject')
      .eq('grade', g)
      .eq('class_num', c);
    if (dbErr?.message?.includes('does not exist')) { setDbMissing(true); return; }
    const g2: ComciGrid = {};
    for (const row of (data ?? [])) {
      if (!g2[row.weekday]) g2[row.weekday] = {};
      g2[row.weekday][row.period] = { subject: row.subject, teacher: '' };
    }
    setGrid(g2);
    setSource('manual');
  }, []);

  useEffect(() => { loadComcigan(1, 1); }, []); // eslint-disable-line

  const switchGrade = (g: number) => {
    if (editing) { toast('편집 중에는 변경할 수 없습니다.'); return; }
    setGrade(g);
    if (rawData) applyGrid(rawData, g, cls);
    else loadComcigan(g, cls);
  };
  const switchClass = (c: number) => {
    if (editing) { toast('편집 중에는 변경할 수 없습니다.'); return; }
    setCls(c);
    if (rawData) applyGrid(rawData, grade, c);
    else loadComcigan(grade, c);
  };

  // ── 편집 저장 (Supabase) ────────────────────────────────────────────────────
  const startEdit = () => {
    const d: typeof draft = {};
    for (const wd in grid) {
      d[+wd] = {};
      for (const p in grid[+wd]) d[+wd][+p] = grid[+wd][+p].subject;
    }
    setDraft(d); setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    const rows: object[] = [];
    for (let wd = 0; wd < 5; wd++)
      for (const p of PERIODS)
        rows.push({ grade, class_num: cls, weekday: wd, period: p, subject: draft[wd]?.[p] ?? '' });
    const { error: dbErr } = await supabase.from('timetable')
      .upsert(rows, { onConflict: 'grade,class_num,weekday,period' });
    setSaving(false);
    if (dbErr) { toast.error(dbErr.message); return; }
    const g2: ComciGrid = {};
    for (let wd = 0; wd < 5; wd++) {
      g2[wd] = {};
      for (const p of PERIODS) {
        const s = draft[wd]?.[p] ?? '';
        if (s) g2[wd][p] = { subject: s, teacher: '' };
      }
    }
    setGrid(g2); setEditing(false);
    toast.success('저장됐습니다.');
  };

  if (dbMissing) return (
    <main className="px-4 py-16 flex flex-col items-center gap-5 text-center max-w-lg mx-auto">
      <p className="text-4xl">⚠️</p>
      <h2 className="font-black text-xl uppercase tracking-tight">DB 설정 필요</h2>
      <p className="text-sm text-muted-foreground">
        <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">supabase_timetable_migration.sql</code>을
        Supabase SQL Editor에서 실행해 주세요.
      </p>
    </main>
  );

  return (
    <main className="px-4 py-8 space-y-5 max-w-4xl mx-auto">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">시간표</h1>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
            충북과학고등학교 ·{' '}
            <span className={source === 'comcigan' ? 'text-green-500' : 'text-amber-500'}>
              {source === 'comcigan' ? '컴시간 알리미' : '수동 데이터'}
            </span>
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {!editing && (
            <Button variant="ghost" size="icon" className="size-8"
              onClick={() => loadComcigan(grade, cls)} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {isAdmin && !editing && (
            <Button onClick={startEdit} variant="outline" size="sm" className="font-black text-xs uppercase gap-1.5">
              <Edit3 className="size-3.5" /> 직접 편집
            </Button>
          )}
          {isAdmin && editing && (
            <div className="flex gap-2">
              <Button onClick={() => setDraft({})} variant="ghost" size="sm" className="font-black text-xs gap-1.5 text-muted-foreground">
                <RotateCcw className="size-3" /> 지우기
              </Button>
              <Button onClick={() => setEditing(false)} variant="outline" size="sm" className="font-black text-xs uppercase gap-1.5">
                <X className="size-3" /> 취소
              </Button>
              <Button onClick={save} size="sm" disabled={saving} className="font-black text-xs uppercase gap-1.5">
                <Save className="size-3" /> {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* selectors */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {grades.map(g => (
            <button key={g} onClick={() => switchGrade(g)}
              className={`px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${grade===g?'bg-primary text-primary-foreground shadow-md':'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
              {g}학년
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {classes.map(c => (
            <button key={c} onClick={() => switchClass(c)}
              className={`px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${cls===c?'bg-primary text-primary-foreground shadow-md':'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
              {c}반
            </button>
          ))}
        </div>
        {editing && (
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
            <Edit3 className="size-3" /> 편집 모드
          </span>
        )}
      </div>

      {/* 에러 배너 */}
      {error && source === 'manual' && (
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertTriangle className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            컴시간 연결 실패 — 수동 입력 데이터를 표시합니다.
            <span className="block text-muted-foreground/60 mt-0.5 font-normal">{error}</span>
          </p>
        </div>
      )}

      {/* skeleton */}
      {loading && (
        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({ length: 6 * MAX_P }).map((_, i) => (
            <div key={i} className="h-14 bg-muted/40 animate-pulse rounded-lg" style={{ opacity: 1 - (i % MAX_P) * 0.09 }} />
          ))}
        </div>
      )}

      {/* timetable */}
      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-10 p-1" />
                {DAYS.map((day, i) => (
                  <th key={day} className={`p-2 text-[11px] font-black uppercase tracking-widest text-center min-w-[72px] ${todayWd===i?'text-primary':'text-muted-foreground'}`}>
                    {day}
                    {todayWd === i && <span className="block text-[8px] text-primary/70">오늘</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(p => (
                <tr key={p}>
                  <td className="p-1 text-center">
                    <span className="text-[10px] font-black text-muted-foreground">{p}</span>
                  </td>
                  {DAYS.map((_, di) => {
                    const cell    = editing ? undefined : grid[di]?.[p];
                    const subject = editing ? (draft[di]?.[p] ?? '') : (cell?.subject ?? '');
                    const teacher = editing ? '' : (cell?.teacher ?? '');
                    const isToday = todayWd === di;
                    return (
                      <td key={di} className={`p-0.5 ${isToday?'bg-primary/[0.03]':''}`}>
                        {editing ? (
                          <input
                            value={subject}
                            onChange={e => setDraft(prev => ({ ...prev, [di]: { ...prev[di], [p]: e.target.value } }))}
                            placeholder="과목"
                            className={`w-full h-14 px-1.5 text-center text-[11px] font-black rounded-lg border outline-none focus:border-primary ${
                              subject ? subjectColor(subject) : 'bg-muted/20 border-border/30 placeholder:text-muted-foreground/30'
                            }`}
                          />
                        ) : subject ? (
                          <div className={`h-14 px-1.5 rounded-lg border text-center flex flex-col items-center justify-center gap-0.5 hover:scale-105 transition-all ${subjectColor(subject)} ${isToday?'shadow-sm':''}`}>
                            <span className="text-[11px] font-black leading-tight line-clamp-1">{subject}</span>
                            {teacher && <span className="text-[9px] opacity-55 leading-tight">{teacher}</span>}
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
        컴시간 알리미 자동 연동 (브라우저 직접 요청) · 실패 시 수동 데이터 표시
      </p>
    </main>
  );
}

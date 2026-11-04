'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Button } from '@/components/ui/button';
import { useAlert } from '@/lib/alert';
import { Edit3, Save, X, RotateCcw, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { LoadingSpinner } from '@/components/ui/spinner';
import { useCachedAi } from '@/lib/useCachedAi';

const DAYS    = ['월', '화', '수', '목', '금'];
const MAX_P   = 7;
const PERIODS = Array.from({ length: MAX_P }, (_, i) => i + 1);

/** 과목마다 셀 전체를 파스텔로 칠하는 대신, 좌측 얇은 띠 + 텍스트 색으로만 구분한다 */
const COLORS = [
  { bar: 'bg-blue-500',    text: 'text-blue-700 dark:text-blue-300' },
  { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
  { bar: 'bg-violet-500',  text: 'text-violet-700 dark:text-violet-300' },
  { bar: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-300' },
  { bar: 'bg-rose-500',    text: 'text-rose-700 dark:text-rose-300' },
  { bar: 'bg-sky-500',     text: 'text-sky-700 dark:text-sky-300' },
];
const cc: Record<string, typeof COLORS[number]> = {};
function subjectColor(n: string) {
  if (!n) return COLORS[0];
  if (!cc[n]) { const h = [...n].reduce((a, c) => a + c.charCodeAt(0), 0); cc[n] = COLORS[h % COLORS.length]; }
  return cc[n];
}

/** 학번은 학년(1자리)+반(1자리)+번호(2자리) 형식. 선생님은 이 필드를 학번이 아니라
 * 로그인용 아이디처럼 쓰기 때문에, 4자리 숫자이고 학년이 1~3인 경우에만 학생으로 간주한다. */
function parseStudentGradeClass(studentId?: string | null): { grade: number; cls: number } | null {
  if (!studentId || !/^\d{4}$/.test(studentId)) return null;
  const grade = +studentId[0];
  const cls = +studentId[1];
  if (grade < 1 || grade > 3 || cls < 1) return null;
  return { grade, cls };
}

type Cell = { subject: string; teacher: string; changed?: boolean };
type Grid = Record<number, Record<number, Cell>>;

export default function TimetablePage() {
  const { isAdmin, user, profile, isLoading: authLoading } = useAuth();
  const { showAlert, showError, showSuccess } = useAlert();
  const [grade,   setGrade]   = useState(1);
  const [cls,     setCls]     = useState(1);
  const [grades,  setGrades]  = useState([1, 2, 3]);
  const [classes, setClasses] = useState([1, 2, 3, 4]);
  const [grid,    setGrid]    = useState<Grid>({});
  const [draft,   setDraft]   = useState<Record<number, Record<number, string>>>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [source,  setSource]  = useState<'comcigan' | 'manual'>('comcigan');
  const [dbMissing, setDbMissing] = useState(false);
  const todayWd = (() => { const d = new Date().getDay(); return d === 0 ? -1 : d - 1; })();
  const todaySubjects = todayWd >= 0 && todayWd < 5
    ? PERIODS.map(period => grid[todayWd]?.[period]?.subject).filter(Boolean)
    : [];
  const todayDate = new Date().toLocaleDateString('sv-SE');
  const prepInput = todaySubjects.length >= 2 ? `${todayDate} ${grade}학년 ${cls}반 시간표: ${todaySubjects.join(', ')}` : '';
  const prepTip = useCachedAi('timetable', prepInput, `timetable:${grade}:${cls}:${todayDate}`, !!prepInput && !loading && !editing);

  const loadComcigan = useCallback(async (g: number, c: number, refresh = false) => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/api/timetable?grade=${g}&class=${c}${refresh ? '&refresh=1' : ''}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setGrid(json.grid ?? {});
      if (json.grades?.length)  setGrades(json.grades);
      if (json.classes?.length) setClasses(json.classes);
      setSource('comcigan');
    } catch (e: any) {
      setError(e.message ?? String(e));
      await loadManual(g, c);
    } finally {
      setLoading(false);
      setJustFinished(true);
      setTimeout(() => setJustFinished(false), 600);
    }
  }, []); // eslint-disable-line

  const loadManual = useCallback(async (g: number, c: number) => {
    const { data, error: dbErr } = await supabase
      .from('timetable').select('weekday,period,subject')
      .eq('grade', g).eq('class_num', c);
    if (dbErr?.message?.includes('does not exist')) { setDbMissing(true); return; }
    const g2: Grid = {};
    for (const r of (data ?? [])) {
      if (!g2[r.weekday]) g2[r.weekday] = {};
      g2[r.weekday][r.period] = { subject: r.subject, teacher: '' };
    }
    setGrid(g2); setSource('manual');
  }, []);

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    if (authLoading) return;
    if (user && !profile) return; // 로그인은 됐는데 프로필이 아직 백그라운드에서 로딩 중 — 기다린다
    didInitRef.current = true;
    const own = parseStudentGradeClass(profile?.student_id);
    if (own) { setGrade(own.grade); setCls(own.cls); loadComcigan(own.grade, own.cls); }
    else loadComcigan(1, 1);
  }, [authLoading, user, profile]); // eslint-disable-line

  const switchTo = (g: number, c: number) => {
    if (editing) { showAlert('편집 중에는 변경할 수 없습니다.', 'info'); return; }
    setGrade(g); setCls(c); loadComcigan(g, c);
  };

  const startEdit = () => {
    const d: typeof draft = {};
    for (const wd in grid) { d[+wd] = {}; for (const p in grid[+wd]) d[+wd][+p] = grid[+wd][+p].subject; }
    setDraft(d); setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    const rows = [];
    for (let wd = 0; wd < 5; wd++)
      for (const p of PERIODS)
        rows.push({ grade, class_num: cls, weekday: wd, period: p, subject: draft[wd]?.[p] ?? '' });
    const { error: dbErr } = await supabase.from('timetable')
      .upsert(rows, { onConflict: 'grade,class_num,weekday,period' });
    setSaving(false);
    if (dbErr) { showError(dbErr.message); return; }
    const g2: Grid = {};
    for (let wd = 0; wd < 5; wd++) { g2[wd] = {}; for (const p of PERIODS) { const s = draft[wd]?.[p] ?? ''; if (s) g2[wd][p] = { subject: s, teacher: '' }; } }
    setGrid(g2); setEditing(false); showSuccess('저장됐습니다.');
  };

  if (dbMissing) return (
    <section className="cb-page-content px-4 py-16 flex flex-col items-center gap-5 text-center max-w-lg mx-auto">
      <p className="text-4xl">⚠️</p>
      <h2 className="font-black text-xl uppercase tracking-tight">DB 설정 필요</h2>
      <p className="text-sm text-muted-foreground">
        <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">supabase_timetable_migration.sql</code>을
        Supabase SQL Editor에서 실행해 주세요.
      </p>
    </section>
  );

  return (
    <section className="cb-page-content px-4 py-8 space-y-5 max-w-4xl mx-auto">
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
            <Button variant="ghost" size="icon" className="size-8" onClick={() => loadComcigan(grade, cls, true)} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {isAdmin && !editing && (
            <Button onClick={startEdit} variant="outline" size="sm" className="font-black text-xs uppercase gap-1.5 active:scale-95 transition-transform">
              <Edit3 className="size-3.5" /> 직접 편집
            </Button>
          )}
          {isAdmin && editing && (
            <div className="flex gap-2">
              <Button onClick={() => setDraft({})} variant="ghost" size="sm" className="font-black text-xs gap-1.5 text-muted-foreground active:scale-95 transition-transform">
                <RotateCcw className="size-3" />
              </Button>
              <Button onClick={() => setEditing(false)} variant="outline" size="sm" className="font-black text-xs gap-1.5 active:scale-95 transition-transform">
                <X className="size-3" /> 취소
              </Button>
              <Button onClick={save} size="sm" disabled={saving} className="font-black text-xs uppercase gap-1.5 active:scale-95 transition-transform">
                <Save className="size-3" /> {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <SegmentedTabs
          items={grades.map(g => ({ value: String(g), label: `${g}학년` }))}
          value={String(grade)}
          onChange={(v) => switchTo(Number(v), cls)}
        />
        <SegmentedTabs
          items={classes.map(c => ({ value: String(c), label: `${c}반` }))}
          value={String(cls)}
          onChange={(v) => switchTo(grade, Number(v))}
        />
        {editing && <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1"><Edit3 className="size-3" /> 편집 모드</span>}
      </div>

      {error && source === 'manual' && (
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertTriangle className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            컴시간 연결 실패 — 수동 데이터를 표시합니다.
            <span className="block text-muted-foreground/60 mt-0.5 font-normal">{error}</span>
          </p>
        </div>
      )}

      {prepTip && !editing && <p className="flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-relaxed"><Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" /><span><span className="font-black text-primary">오늘의 복습 힌트 · </span>{prepTip}<span className="ml-1 text-muted-foreground">과목명만 참고한 제안이에요.</span></span></p>}

      {loading || justFinished ? (
        <div className="py-16 flex items-center justify-center">
          <LoadingSpinner done={justFinished} size={56} label="시간표 불러오는 중" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-10 p-1" />
                {DAYS.map((day, i) => (
                  <th key={day} className={`p-2 text-[11px] font-black uppercase tracking-widest text-center min-w-[72px] ${todayWd===i?'text-primary':'text-muted-foreground'}`}>
                    {day}{todayWd===i&&<span className="block text-[8px] text-primary/70">오늘</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(p => (
                <tr key={p}>
                  <td className="p-1 text-center"><span className="text-[10px] font-black text-muted-foreground">{p}</span></td>
                  {DAYS.map((_, di) => {
                    const cell    = editing ? undefined : grid[di]?.[p];
                    const subject = editing ? (draft[di]?.[p] ?? '') : (cell?.subject ?? '');
                    const teacher = editing ? '' : (cell?.teacher ?? '');
                    const changed = !editing && !!cell?.changed;
                    const isToday = todayWd === di;
                    return (
                      <td key={di} className={`p-0.5 ${isToday?'bg-primary/[0.03]':''}`}>
                        {editing ? (
                          <input value={subject}
                            onChange={e => setDraft(prev => ({ ...prev, [di]: { ...prev[di], [p]: e.target.value } }))}
                            placeholder="과목"
                            className="w-full h-14 px-1.5 text-center text-[11px] font-bold rounded-lg border border-border/40 bg-muted/20 outline-none focus:border-primary focus:bg-background placeholder:text-muted-foreground/30 transition-colors"
                          />
                        ) : subject ? (
                          <div title={changed ? '컴시간 실시간 변경' : undefined}
                            className={`relative h-14 pl-2.5 pr-1.5 rounded-lg border border-border/40 bg-card text-center flex flex-col items-center justify-center gap-0.5 overflow-hidden tilt-3d transition-all ${isToday?'ring-1 ring-primary/15':''} ${changed?'ring-2 ring-amber-500/60':''}`}>
                            <span className={`absolute inset-y-0 left-0 w-1 ${subjectColor(subject).bar}`} />
                            {changed && <span className="absolute -top-1 -right-1 size-2 rounded-full bg-amber-500" />}
                            <span className={`text-[11px] font-black leading-tight line-clamp-1 ${subjectColor(subject).text}`}>{subject}</span>
                            {teacher && <span className="text-[9px] text-muted-foreground leading-tight">{teacher}</span>}
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

      <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1.5 flex-wrap">
        <span>컴시간 알리미 자동 연동 · 실패 시 수동 데이터 표시{isAdmin && ' · 직접 편집 가능'}</span>
        {source === 'comcigan' && (
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500" />실시간 보강/결강 변경</span>
        )}
      </p>
    </section>
  );
}

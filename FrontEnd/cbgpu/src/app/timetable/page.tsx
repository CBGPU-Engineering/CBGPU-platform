'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Edit3, Save, X, RotateCcw } from 'lucide-react';

// ─── config ───────────────────────────────────────────────────────────────────
const DAYS    = ['월', '화', '수', '목', '금'];
const MAX_P   = 7;
const PERIODS = Array.from({ length: MAX_P }, (_, i) => i + 1);
const GRADES  = [1, 2, 3];
const CLASSES = [1, 2, 3, 4];

// ─── subject → color ──────────────────────────────────────────────────────────
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
const colorCache: Record<string, string> = {};
function subjectColor(name: string) {
  if (!name?.trim()) return '';
  if (!colorCache[name]) {
    const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
    colorCache[name] = COLORS[h % COLORS.length];
  }
  return colorCache[name];
}

// ─── types ────────────────────────────────────────────────────────────────────
type Grid = Record<number, Record<number, string>>; // weekday → period → subject

// ─── main page ────────────────────────────────────────────────────────────────
export default function TimetablePage() {
  const { isAdmin } = useAuth();
  const [grade,   setGrade]   = useState(1);
  const [cls,     setCls]     = useState(1);
  const [grid,    setGrid]    = useState<Grid>({});
  const [draft,   setDraft]   = useState<Grid>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [dbMissing, setDbMissing] = useState(false);

  const todayWd = (() => { const d = new Date().getDay(); return d === 0 ? -1 : d - 1; })();

  // ── load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async (g: number, c: number) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('timetable')
      .select('weekday, period, subject')
      .eq('grade', g)
      .eq('class_num', c);

    if (error?.message?.includes('does not exist')) { setDbMissing(true); setLoading(false); return; }

    const g2: Grid = {};
    for (const row of (data ?? [])) {
      if (!g2[row.weekday]) g2[row.weekday] = {};
      g2[row.weekday][row.period] = row.subject;
    }
    setGrid(g2);
    setDraft(JSON.parse(JSON.stringify(g2)));
    setLoading(false);
  }, []);

  useEffect(() => { load(grade, cls); }, [grade, cls, load]);

  // ── save ────────────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    const upserts: object[] = [];
    for (let wd = 0; wd < 5; wd++) {
      for (const p of PERIODS) {
        upserts.push({ grade, class_num: cls, weekday: wd, period: p, subject: draft[wd]?.[p] ?? '' });
      }
    }
    const { error } = await supabase.from('timetable').upsert(upserts, { onConflict: 'grade,class_num,weekday,period' });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setGrid(JSON.parse(JSON.stringify(draft)));
    setEditing(false);
    toast.success('시간표가 저장됐습니다.');
  };

  const cancelEdit = () => {
    setDraft(JSON.parse(JSON.stringify(grid)));
    setEditing(false);
  };

  const setCell = (wd: number, p: number, val: string) => {
    setDraft(prev => {
      const n = { ...prev };
      if (!n[wd]) n[wd] = {};
      n[wd] = { ...n[wd], [p]: val };
      return n;
    });
  };

  const clearAll = () => setDraft({});

  const activeGrid = editing ? draft : grid;

  // ── DB missing notice ───────────────────────────────────────────────────────
  if (dbMissing) return (
    <main className="px-4 py-16 flex flex-col items-center gap-5 text-center max-w-lg mx-auto">
      <p className="text-4xl">⚠️</p>
      <h2 className="font-black text-xl uppercase tracking-tight">DB 설정 필요</h2>
      <p className="text-sm text-muted-foreground">
        프로젝트 루트의 <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">supabase_timetable_migration.sql</code> 파일을
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
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">충북과학고등학교</p>
        </div>
        {isAdmin && !editing && (
          <Button onClick={() => setEditing(true)} variant="outline" className="font-black text-xs uppercase gap-2">
            <Edit3 className="size-3.5" /> 시간표 편집
          </Button>
        )}
        {isAdmin && editing && (
          <div className="flex gap-2">
            <Button onClick={clearAll} variant="ghost" size="sm" className="font-black text-xs uppercase gap-1.5 text-muted-foreground">
              <RotateCcw className="size-3" /> 전체 지우기
            </Button>
            <Button onClick={cancelEdit} variant="outline" size="sm" className="font-black text-xs uppercase gap-1.5">
              <X className="size-3" /> 취소
            </Button>
            <Button onClick={save} size="sm" disabled={saving} className="font-black text-xs uppercase gap-1.5">
              <Save className="size-3" /> {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        )}
      </div>

      {/* selectors */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {GRADES.map(g => (
            <button key={g} onClick={() => { if (!editing) { setGrade(g); } else { toast('편집 중에는 학년을 변경할 수 없습니다.'); } }}
              className={`px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${grade===g?'bg-primary text-primary-foreground shadow-md':'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
              {g}학년
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {CLASSES.map(c => (
            <button key={c} onClick={() => { if (!editing) { setCls(c); } else { toast('편집 중에는 반을 변경할 수 없습니다.'); } }}
              className={`px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${cls===c?'bg-primary text-primary-foreground shadow-md':'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
              {c}반
            </button>
          ))}
        </div>
        {editing && (
          <span className="text-[11px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
            <Edit3 className="size-3" /> 편집 모드 — 셀을 클릭해서 과목을 입력하세요
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({ length: 6*MAX_P }).map((_, i) => (
            <div key={i} className="h-12 bg-muted/40 animate-pulse rounded-lg" style={{opacity: 1-(i%MAX_P)*0.09}} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-10 p-1" />
                {DAYS.map((day, i) => (
                  <th key={day} className={`p-2 text-[11px] font-black uppercase tracking-widest text-center min-w-[80px] ${
                    todayWd === i ? 'text-primary' : 'text-muted-foreground'
                  }`}>
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
                    const subj = activeGrid[di]?.[p] ?? '';
                    const isToday = todayWd === di;
                    return (
                      <td key={di} className={`p-0.5 ${isToday ? 'bg-primary/[0.03]' : ''}`}>
                        {editing ? (
                          <input
                            value={subj}
                            onChange={e => setCell(di, p, e.target.value)}
                            placeholder="과목"
                            className={`w-full h-12 px-1.5 text-center text-[11px] font-black rounded-lg border outline-none focus:border-primary transition-all ${
                              subj ? subjectColor(subj) : 'bg-muted/20 border-border/30 text-muted-foreground placeholder:text-muted-foreground/40'
                            }`}
                          />
                        ) : subj ? (
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

      <p className="text-[10px] text-muted-foreground text-center">
        {isAdmin ? '어드민 계정으로 "시간표 편집" 버튼을 눌러 직접 입력할 수 있습니다.' : '시간표 수정은 어드민에게 문의하세요.'}
      </p>
    </main>
  );
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Plus, Trash2, X, Edit3, BarChart3, ArrowLeft, ChevronUp, ChevronDown,
  CheckSquare, Circle, Type, AlignLeft, Star, List, Lock, CheckCircle2,
} from 'lucide-react';

// ─── types ────────────────────────────────────────────────────────────────────
type QType = 'choice' | 'checkbox' | 'text' | 'paragraph' | 'scale' | 'dropdown';
type AnswerValue = string | string[] | number | null;

interface QOption { id: string; text: string }
interface QConfig { min?: number; max?: number; minLabel?: string; maxLabel?: string; showIf?: { questionId: string; value: string } }

interface Question {
  id: string; poll_id: string; order_num: number; type: QType;
  title: string; description: string; required: boolean;
  options: QOption[]; config: QConfig;
}
interface Poll {
  id: string; created_at: string; title: string; description: string;
  ends_at: string | null; is_active: boolean; show_results: boolean;
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
const isClosed = (p: Poll) => !p.is_active || (!!p.ends_at && new Date(p.ends_at) < new Date());
const isVisible = (q: Question, ans: Record<string, AnswerValue>) => {
  const si = q.config.showIf;
  if (!si) return true;
  const v = ans[si.questionId];
  return Array.isArray(v) ? v.includes(si.value) : String(v ?? '') === si.value;
};

const Q_TYPES: { id: QType; label: string; icon: any }[] = [
  { id: 'choice',    label: '객관식 (단일)',   icon: Circle },
  { id: 'checkbox',  label: '체크박스 (복수)', icon: CheckSquare },
  { id: 'dropdown',  label: '드롭다운',        icon: List },
  { id: 'text',      label: '단답형',          icon: Type },
  { id: 'paragraph', label: '장문형',          icon: AlignLeft },
  { id: 'scale',     label: '선형 배율',       icon: Star },
];

// ─── QuestionInput ─────────────────────────────────────────────────────────
function QuestionInput({ q, value, onChange }: { q: Question; value: AnswerValue; onChange: (v: AnswerValue) => void }) {
  const sel = Array.isArray(value) ? value : [];
  switch (q.type) {
    case 'choice':
    case 'dropdown':
      return (
        <div className="space-y-2">
          {q.options.map(o => (
            <label key={o.id} onClick={() => onChange(o.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${value === o.id ? 'border-primary bg-primary/5' : 'border-border/40 hover:bg-muted/30'}`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${value === o.id ? 'border-primary' : 'border-muted-foreground/30'}`}>
                {value === o.id && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <span className="text-sm font-medium">{o.text}</span>
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <div className="space-y-2">
          {q.options.map(o => {
            const chk = sel.includes(o.id);
            return (
              <label key={o.id} onClick={() => onChange(chk ? sel.filter(v => v !== o.id) : [...sel, o.id])}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${chk ? 'border-primary bg-primary/5' : 'border-border/40 hover:bg-muted/30'}`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${chk ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
                  {chk && <span className="text-white text-[10px] font-black">✓</span>}
                </div>
                <span className="text-sm font-medium">{o.text}</span>
              </label>
            );
          })}
        </div>
      );
    case 'text':
      return <Input value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)} placeholder="답변을 입력하세요" className="font-medium" />;
    case 'paragraph':
      return <textarea value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)} rows={4} placeholder="답변을 입력하세요"
        className="w-full px-3 py-2 text-sm bg-muted/30 border border-border/50 rounded-xl outline-none focus:border-primary resize-none font-medium" />;
    case 'scale': {
      const { min = 1, max = 5, minLabel, maxLabel } = q.config;
      return (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(n => (
              <button key={n} onClick={() => onChange(n)}
                className={`w-10 h-10 rounded-xl border font-black text-sm transition-all ${value === n ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-muted/30 border-border/40 hover:bg-muted/60 text-muted-foreground'}`}>{n}</button>
            ))}
          </div>
          {(minLabel || maxLabel) && (
            <div className="flex justify-between text-[10px] text-muted-foreground font-medium px-1">
              <span>{minLabel}</span><span>{maxLabel}</span>
            </div>
          )}
        </div>
      );
    }
    default: return null;
  }
}

// ─── ResultChart ──────────────────────────────────────────────────────────────
function ResultChart({ q, allAnswers }: { q: Question; allAnswers: { question_id: string; value: any }[] }) {
  const qAnswers = allAnswers.filter(a => a.question_id === q.id).map(a => a.value);
  const total = qAnswers.length;

  if (q.type === 'text' || q.type === 'paragraph') {
    const texts = qAnswers.filter(Boolean).map(v => typeof v === 'string' ? v : JSON.stringify(v));
    return (
      <div className="space-y-1.5">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{total}개 응답</p>
        {texts.slice(0, 20).map((t, i) => (
          <p key={i} className="text-sm bg-muted/30 border border-border/30 rounded-xl px-3 py-2 font-medium">{t}</p>
        ))}
        {texts.length > 20 && <p className="text-xs text-muted-foreground">+{texts.length - 20}개 더...</p>}
      </div>
    );
  }

  if (q.type === 'scale') {
    const nums = qAnswers.map(Number).filter(n => !isNaN(n));
    const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '-';
    const { min = 1, max = 5 } = q.config;
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{total}개 응답 · 평균 <span className="text-primary">{avg}</span></p>
        <div className="flex gap-2">
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(n => {
            const cnt = nums.filter(v => v === n).length;
            const pct = total ? Math.round(cnt / total * 100) : 0;
            return (
              <div key={n} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-muted rounded-full h-20 flex items-end overflow-hidden">
                  <div className="w-full bg-primary rounded-full transition-all duration-700" style={{ height: `${pct}%` }} />
                </div>
                <span className="text-[10px] font-black text-muted-foreground">{n}</span>
                <span className="text-[9px] text-muted-foreground/60">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // choice / checkbox / dropdown
  const countMap: Record<string, number> = {};
  qAnswers.forEach(v => {
    const ids = Array.isArray(v) ? v : [v];
    ids.forEach(id => { if (id) countMap[String(id)] = (countMap[String(id)] ?? 0) + 1; });
  });
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{total}개 응답</p>
      {q.options.map(o => {
        const cnt = countMap[o.id] ?? 0;
        const pct = total ? Math.round(cnt / total * 100) : 0;
        return (
          <div key={o.id} className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span>{o.text}</span>
              <span className="text-muted-foreground">{cnt}명 ({pct}%)</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── QuestionBuilder ──────────────────────────────────────────────────────────
function QuestionBuilder({ q, idx, total, prevQs, onChange, onDelete, onMove }: {
  q: Question; idx: number; total: number; prevQs: Question[];
  onChange: (q: Question) => void; onDelete: () => void; onMove: (dir: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(true);
  const addOption  = () => onChange({ ...q, options: [...q.options, { id: uid(), text: '' }] });
  const delOption  = (id: string) => onChange({ ...q, options: q.options.filter(o => o.id !== id) });
  const setOptText = (id: string, text: string) => onChange({ ...q, options: q.options.map(o => o.id === id ? { ...o, text } : o) });
  const hasOptions = ['choice', 'checkbox', 'dropdown'].includes(q.type);
  const isScale    = q.type === 'scale';

  const Icon = Q_TYPES.find(t => t.id === q.type)?.icon ?? Circle;

  return (
    <div className="border border-border/50 rounded-2xl overflow-hidden bg-card">
      <div className="flex items-center gap-2 p-3 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={e => { e.stopPropagation(); onMove(-1); }} disabled={idx === 0} className="text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20"><ChevronUp className="size-3" /></button>
          <button onClick={e => { e.stopPropagation(); onMove(1); }} disabled={idx === total - 1} className="text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20"><ChevronDown className="size-3" /></button>
        </div>
        <Icon className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest shrink-0">{idx + 1}.</span>
        <span className="text-sm font-bold flex-1 truncate">{q.title || '(제목 없음)'}</span>
        {q.required && <span className="text-[9px] text-destructive font-black">필수</span>}
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="text-muted-foreground/40 hover:text-destructive transition-colors"><Trash2 className="size-3.5" /></button>
      </div>

      {open && (
        <div className="border-t border-border/30 p-4 space-y-3">
          {/* type selector */}
          <div className="flex gap-1 flex-wrap">
            {Q_TYPES.map(t => (
              <button key={t.id} onClick={() => onChange({ ...q, type: t.id, config: t.id === 'scale' ? { min: 1, max: 5, minLabel: '매우 낮음', maxLabel: '매우 높음' } : {} })}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1 ${q.type === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                <t.icon className="size-2.5" />{t.label}
              </button>
            ))}
          </div>

          <Input value={q.title} onChange={e => onChange({ ...q, title: e.target.value })} placeholder="질문 제목 *" className="font-bold" />
          <Input value={q.description} onChange={e => onChange({ ...q, description: e.target.value })} placeholder="질문 설명 (선택)" className="text-sm text-muted-foreground" />

          {/* options */}
          {hasOptions && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">선택지</p>
              {q.options.map((o, i) => (
                <div key={o.id} className="flex gap-2">
                  <Input value={o.text} onChange={e => setOptText(o.id, e.target.value)} placeholder={`선택지 ${i + 1}`} className="text-sm" />
                  {q.options.length > 1 && <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => delOption(o.id)}><X className="size-3" /></Button>}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addOption} className="w-full font-black text-xs gap-1.5"><Plus className="size-3" />선택지 추가</Button>
            </div>
          )}

          {/* scale config */}
          {isScale && (
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-[9px] font-black text-muted-foreground uppercase mb-1">최솟값</p><Input type="number" value={q.config.min ?? 1} onChange={e => onChange({ ...q, config: { ...q.config, min: +e.target.value } })} className="text-sm" /></div>
              <div><p className="text-[9px] font-black text-muted-foreground uppercase mb-1">최댓값</p><Input type="number" value={q.config.max ?? 5} onChange={e => onChange({ ...q, config: { ...q.config, max: +e.target.value } })} className="text-sm" /></div>
              <div><p className="text-[9px] font-black text-muted-foreground uppercase mb-1">최솟값 라벨</p><Input value={q.config.minLabel ?? ''} onChange={e => onChange({ ...q, config: { ...q.config, minLabel: e.target.value } })} className="text-sm" /></div>
              <div><p className="text-[9px] font-black text-muted-foreground uppercase mb-1">최댓값 라벨</p><Input value={q.config.maxLabel ?? ''} onChange={e => onChange({ ...q, config: { ...q.config, maxLabel: e.target.value } })} className="text-sm" /></div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {/* conditional show */}
            {prevQs.filter(p => ['choice','checkbox','dropdown'].includes(p.type) && p.options.length).length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">표시 조건:</span>
                <select className="text-[10px] bg-muted border border-border/50 rounded-lg px-2 py-1 font-medium"
                  value={q.config.showIf?.questionId ?? ''}
                  onChange={e => onChange({ ...q, config: { ...q.config, showIf: e.target.value ? { questionId: e.target.value, value: '' } : undefined } })}>
                  <option value="">항상 표시</option>
                  {prevQs.filter(p => ['choice','checkbox','dropdown'].includes(p.type)).map(p => (
                    <option key={p.id} value={p.id}>{p.title || '(제목 없음)'}</option>
                  ))}
                </select>
                {q.config.showIf?.questionId && (
                  <select className="text-[10px] bg-muted border border-border/50 rounded-lg px-2 py-1 font-medium"
                    value={q.config.showIf.value}
                    onChange={e => onChange({ ...q, config: { ...q.config, showIf: { ...q.config.showIf!, value: e.target.value } } })}>
                    <option value="">선택지 선택</option>
                    {prevQs.find(p => p.id === q.config.showIf?.questionId)?.options.map(o => (
                      <option key={o.id} value={o.id}>{o.text}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer ml-auto">
              <div onClick={() => onChange({ ...q, required: !q.required })}
                className={`w-8 h-4 rounded-full relative transition-all ${q.required ? 'bg-primary' : 'bg-muted'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${q.required ? 'left-4' : 'left-0.5'}`} />
              </div>
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">필수</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PollBuilder ──────────────────────────────────────────────────────────────
function PollBuilder({ poll, onSaved, onBack }: { poll?: Poll; onSaved: () => void; onBack: () => void }) {
  const { user } = useAuth();
  const [title, setTitle]   = useState(poll?.title ?? '');
  const [desc, setDesc]     = useState(poll?.description ?? '');
  const [endsAt, setEndsAt] = useState(poll?.ends_at?.slice(0, 16) ?? '');
  const [showRes, setShowRes] = useState(poll?.show_results ?? true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!poll) return;
    supabase.from('poll_questions').select('*').eq('poll_id', poll.id).order('order_num')
      .then(({ data }) => setQuestions((data ?? []).map(q => ({ ...q, options: q.options ?? [], config: q.config ?? {} }))));
  }, [poll]);

  const addQ = (type: QType) => {
    const opts = ['choice','checkbox','dropdown'].includes(type) ? [{ id: uid(), text: '' }, { id: uid(), text: '' }] : [];
    const cfg: QConfig = type === 'scale' ? { min: 1, max: 5, minLabel: '매우 낮음', maxLabel: '매우 높음' } : {};
    setQuestions(qs => [...qs, { id: uid(), poll_id: poll?.id ?? '', order_num: qs.length, type, title: '', description: '', required: false, options: opts, config: cfg }]);
  };

  const moveQ = (idx: number, dir: -1 | 1) => {
    setQuestions(qs => {
      const next = [...qs];
      const tmp = next[idx]; next[idx] = next[idx + dir]; next[idx + dir] = tmp;
      return next.map((q, i) => ({ ...q, order_num: i }));
    });
  };

  const save = async () => {
    if (!title.trim()) { toast.error('제목을 입력하세요'); return; }
    setSaving(true);
    try {
      let pollId = poll?.id;
      if (!pollId) {
        const { data, error } = await supabase.from('polls').insert({ title, description: desc, ends_at: endsAt || null, is_active: true, show_results: showRes, created_by: user?.id }).select().single();
        if (error) throw error;
        pollId = data.id;
      } else {
        const { error } = await supabase.from('polls').update({ title, description: desc, ends_at: endsAt || null, show_results: showRes }).eq('id', pollId);
        if (error) throw error;
        await supabase.from('poll_questions').delete().eq('poll_id', pollId);
      }
      if (questions.length) {
        const rows = questions.map((q, i) => ({ poll_id: pollId, order_num: i, type: q.type, title: q.title, description: q.description, required: q.required, options: q.options, config: q.config }));
        const { error } = await supabase.from('poll_questions').insert(rows);
        if (error) throw error;
      }
      toast.success('저장됐습니다!');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-4" /></Button>
        <h2 className="font-black text-xl uppercase tracking-tighter">{poll ? '투표 편집' : '새 투표 만들기'}</h2>
      </div>
      <div className="space-y-3 p-5 border border-border/50 rounded-2xl bg-card">
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="투표 제목 *" className="text-lg font-black" />
        <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="설명 (선택)" className="font-medium text-muted-foreground" />
        <div className="flex gap-3 flex-wrap">
          <div><p className="text-[9px] font-black text-muted-foreground uppercase mb-1">마감일</p><Input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} className="text-xs" /></div>
          <label className="flex items-center gap-2 mt-5 cursor-pointer">
            <div onClick={() => setShowRes(v => !v)} className={`w-8 h-4 rounded-full relative transition-all ${showRes ? 'bg-primary' : 'bg-muted'}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${showRes ? 'left-4' : 'left-0.5'}`} />
            </div>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">결과 공개</span>
          </label>
        </div>
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <QuestionBuilder key={q.id} q={q} idx={i} total={questions.length}
            prevQs={questions.slice(0, i)}
            onChange={nq => setQuestions(qs => qs.map(x => x.id === nq.id ? nq : x))}
            onDelete={() => setQuestions(qs => qs.filter(x => x.id !== q.id))}
            onMove={dir => moveQ(i, dir)} />
        ))}
      </div>

      <div className="p-4 border-2 border-dashed border-border/40 rounded-2xl">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 text-center">질문 추가</p>
        <div className="flex gap-1.5 flex-wrap justify-center">
          {Q_TYPES.map(t => (
            <button key={t.id} onClick={() => addQ(t.id)}
              className="px-3 py-1.5 bg-muted hover:bg-muted/70 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-all flex items-center gap-1.5">
              <t.icon className="size-3" />{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onBack} className="font-black uppercase text-xs">취소</Button>
        <Button onClick={save} disabled={saving} className="font-black uppercase text-xs">{saving ? '저장 중...' : '저장하기'}</Button>
      </div>
    </div>
  );
}

// ─── PollForm ─────────────────────────────────────────────────────────────────
function PollForm({ poll, questions, onSubmitted, onBack }: { poll: Poll; questions: Question[]; onSubmitted: () => void; onBack: () => void }) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const closed = isClosed(poll);

  const visibleQs = questions.filter(q => isVisible(q, answers));

  const submit = async () => {
    for (const q of visibleQs) {
      if (!q.required) continue;
      const v = answers[q.id];
      const empty = v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);
      if (empty) { toast.error(`"${q.title || '질문'}" 은(는) 필수 항목입니다`); return; }
    }
    setSubmitting(true);
    try {
      const { data: resp, error: re } = await supabase.from('poll_responses').insert({ poll_id: poll.id, user_id: user!.id }).select().single();
      if (re) throw re;
      const rows = visibleQs.map(q => ({ response_id: resp.id, question_id: q.id, value: answers[q.id] ?? null }));
      const { error: ae } = await supabase.from('poll_answers').insert(rows);
      if (ae) throw ae;
      toast.success('제출됐습니다!');
      onSubmitted();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-4" /></Button>
        <div>
          <h2 className="font-black text-xl tracking-tighter">{poll.title}</h2>
          {poll.description && <p className="text-sm text-muted-foreground mt-0.5">{poll.description}</p>}
          {poll.ends_at && <p className="text-[10px] text-muted-foreground font-medium mt-0.5">마감: {fmtDate(poll.ends_at)}</p>}
        </div>
      </div>

      <div className="space-y-4">
        {visibleQs.map((q, i) => (
          <div key={q.id} className="p-5 border border-border/50 rounded-2xl bg-card space-y-3">
            <div>
              <p className="font-black text-sm leading-snug">
                {i + 1}. {q.title}
                {q.required && <span className="text-destructive ml-1">*</span>}
              </p>
              {q.description && <p className="text-xs text-muted-foreground mt-0.5">{q.description}</p>}
            </div>
            {!closed && <QuestionInput q={q} value={answers[q.id] ?? null} onChange={v => setAnswers(a => ({ ...a, [q.id]: v }))} />}
            {closed && <p className="text-sm text-muted-foreground italic">마감된 투표입니다.</p>}
          </div>
        ))}
      </div>

      {!closed && (
        <Button onClick={submit} disabled={submitting} className="w-full font-black uppercase tracking-widest h-12">
          {submitting ? '제출 중...' : '제출하기'}
        </Button>
      )}
    </div>
  );
}

// ─── PollResults ──────────────────────────────────────────────────────────────
function PollResults({ poll, questions, onBack }: { poll: Poll; questions: Question[]; onBack: () => void }) {
  const [allAnswers, setAllAnswers] = useState<any[]>([]);
  const [resCount,   setResCount]   = useState(0);

  useEffect(() => {
    (async () => {
      const { data: responses } = await supabase.from('poll_responses').select('id').eq('poll_id', poll.id);
      setResCount(responses?.length ?? 0);
      if (!responses?.length) return;
      const ids = responses.map(r => r.id);
      const { data: answers } = await supabase.from('poll_answers').select('question_id, value').in('response_id', ids);
      setAllAnswers(answers ?? []);
    })();
  }, [poll.id]);

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-4" /></Button>
        <div>
          <h2 className="font-black text-xl tracking-tighter">{poll.title} — 결과</h2>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">총 {resCount}명 응답</p>
        </div>
      </div>
      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="p-5 border border-border/50 rounded-2xl bg-card space-y-3">
            <p className="font-black text-sm">{i + 1}. {q.title}</p>
            <ResultChart q={q} allAnswers={allAnswers} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────
type View = { type: 'list' } | { type: 'form'; poll: Poll; questions: Question[] } | { type: 'results'; poll: Poll; questions: Question[] } | { type: 'builder'; poll?: Poll };

export default function PollsPage() {
  const { user, isAdmin } = useAuth();
  const [polls,  setPolls]  = useState<Poll[]>([]);
  const [myResponses, setMyResponses] = useState<string[]>([]); // poll_ids I've answered
  const [view,   setView]   = useState<View>({ type: 'list' });
  const [loading, setLoading] = useState(true);
  const [tab,    setTab]    = useState<'active' | 'closed'>('active');
  const [dbMissing, setDbMissing] = useState(false);

  const loadPolls = useCallback(async () => {
    const { data, error } = await supabase.from('polls').select('*').order('created_at', { ascending: false });
    if (error?.message?.includes('does not exist')) { setDbMissing(true); setLoading(false); return; }
    setPolls((data ?? []) as Poll[]);
    if (user) {
      const { data: resps } = await supabase.from('poll_responses').select('poll_id').eq('user_id', user.id);
      setMyResponses((resps ?? []).map(r => r.poll_id));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadPolls(); }, [loadPolls]);

  const openPoll = async (poll: Poll) => {
    const { data: qs } = await supabase.from('poll_questions').select('*').eq('poll_id', poll.id).order('order_num');
    const questions = (qs ?? []).map(q => ({ ...q, options: q.options ?? [], config: q.config ?? {} })) as Question[];
    if (myResponses.includes(poll.id) || isClosed(poll)) {
      setView({ type: 'results', poll, questions });
    } else {
      setView({ type: 'form', poll, questions });
    }
  };

  const closePoll = async (pollId: string) => {
    await supabase.from('polls').update({ is_active: false }).eq('id', pollId);
    toast.success('마감됐습니다.'); loadPolls();
  };

  const deletePoll = async (pollId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await supabase.from('polls').delete().eq('id', pollId);
    toast.success('삭제됐습니다.'); loadPolls();
  };

  if (dbMissing) return (
    <main className="px-4 py-16 flex flex-col items-center gap-5 text-center max-w-lg mx-auto">
      <p className="text-4xl">⚠️</p>
      <h2 className="font-black text-xl uppercase tracking-tight">DB 설정 필요</h2>
      <p className="text-sm text-muted-foreground">
        <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">supabase_polls_migration.sql</code>을
        Supabase SQL Editor에서 실행해 주세요.
      </p>
    </main>
  );

  // ── sub-views ──
  if (view.type === 'builder') return (
    <main className="px-4 py-8">
      <PollBuilder poll={view.poll} onSaved={() => { loadPolls(); setView({ type: 'list' }); }} onBack={() => setView({ type: 'list' })} />
    </main>
  );
  if (view.type === 'form') return (
    <main className="px-4 py-8">
      <PollForm poll={view.poll} questions={view.questions}
        onSubmitted={() => { loadPolls(); setView({ type: 'results', poll: view.poll, questions: view.questions }); }}
        onBack={() => setView({ type: 'list' })} />
    </main>
  );
  if (view.type === 'results') return (
    <main className="px-4 py-8">
      <PollResults poll={view.poll} questions={view.questions} onBack={() => setView({ type: 'list' })} />
    </main>
  );

  // ── list ──
  const shown = polls.filter(p => tab === 'active' ? (p.is_active && (!p.ends_at || new Date(p.ends_at) >= new Date())) : isClosed(p));

  return (
    <main className="px-4 py-8 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">투표</h1>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">학교 행사 · 대회 · 설문</p>
        </div>
        {isAdmin && <Button onClick={() => setView({ type: 'builder' })} className="font-black uppercase tracking-widest gap-2"><Plus className="size-4" />투표 만들기</Button>}
      </div>

      <div className="flex gap-1.5">
        {(['active', 'closed'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all ${tab === t ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
            {t === 'active' ? '진행 중' : '마감'} ({polls.filter(p => t === 'active' ? (p.is_active && (!p.ends_at || new Date(p.ends_at) >= new Date())) : isClosed(p)).length})
          </button>
        ))}
      </div>

      {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted/50 animate-pulse rounded-2xl" />)}</div>
      : shown.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed rounded-3xl text-muted-foreground font-medium">
          {tab === 'active' ? '진행 중인 투표가 없습니다.' : '마감된 투표가 없습니다.'}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(poll => {
            const voted   = myResponses.includes(poll.id);
            const closed  = isClosed(poll);
            return (
              <div key={poll.id} className="p-4 border border-border/50 rounded-2xl bg-card hover:bg-muted/20 transition-all cursor-pointer" onClick={() => openPoll(poll)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-sm leading-tight">{poll.title}</h3>
                      {voted  && <span className="text-[9px] font-black text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="size-2.5" />참여완료</span>}
                      {closed && <span className="text-[9px] font-black text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1"><Lock className="size-2.5" />마감</span>}
                    </div>
                    {poll.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{poll.description}</p>}
                    {poll.ends_at && <p className="text-[10px] text-muted-foreground mt-1">~{fmtDate(poll.ends_at)}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {(voted || closed) && poll.show_results && (
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openPoll(poll)}><BarChart3 className="size-3.5" /></Button>
                    )}
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" className="size-7" onClick={async () => {
                          const { data: qs } = await supabase.from('poll_questions').select('*').eq('poll_id', poll.id).order('order_num');
                          setView({ type: 'builder', poll });
                        }}><Edit3 className="size-3.5" /></Button>
                        {poll.is_active && !closed && <Button variant="ghost" size="icon" className="size-7 text-amber-500" onClick={() => closePoll(poll.id)}><Lock className="size-3.5" /></Button>}
                        <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => deletePoll(poll.id)}><Trash2 className="size-3.5" /></Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import {
  Plus, Trash2, X, Edit3, BarChart3, ArrowLeft, ChevronUp, ChevronDown,
  CheckSquare, Circle, Type, AlignLeft, Star, List, Lock, CheckCircle2, Sparkles,
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import { requestAi } from '@/lib/requestAi';

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
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
const isClosed = (p: Poll) => !p.is_active || (!!p.ends_at && new Date(p.ends_at) < new Date());
const isVisible = (q: Question, ans: Record<string, AnswerValue>) => {
  const si = q.config.showIf;
  if (!si) return true;
  const v = ans[si.questionId];
  return Array.isArray(v) ? v.includes(si.value) : String(v ?? '') === si.value;
};

const Q_TYPES: { id: QType; label: string; icon: any }[] = [
  { id: 'choice',    label: "Multiple choice",   icon: Circle },
  { id: 'checkbox',  label: "Checkboxes", icon: CheckSquare },
  { id: 'dropdown',  label: "Dropdown",        icon: List },
  { id: 'text',      label: "Short answer",          icon: Type },
  { id: 'paragraph', label: "Paragraph",          icon: AlignLeft },
  { id: 'scale',     label: "Linear scale",       icon: Star },
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
      return <Input value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)} placeholder="Enter your answer" className="font-medium" />;
    case 'paragraph':
      return <textarea value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)} rows={4} placeholder="Enter your answer"
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
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{total} responses</p>
        {texts.slice(0, 20).map((t, i) => (
          <p key={i} className="text-sm bg-muted/30 border border-border/30 rounded-xl px-3 py-2 font-medium">{t}</p>
        ))}
        {texts.length > 20 && <p className="text-xs text-muted-foreground">+{texts.length - 20} more…</p>}
      </div>
    );
  }

  if (q.type === 'scale') {
    const nums = qAnswers.map(Number).filter(n => !isNaN(n));
    const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '-';
    const { min = 1, max = 5 } = q.config;
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{total} responses · Average <span className="text-primary">{avg}</span></p>
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
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{total} responses</p>
      {q.options.map(o => {
        const cnt = countMap[o.id] ?? 0;
        const pct = total ? Math.round(cnt / total * 100) : 0;
        return (
          <div key={o.id} className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span>{o.text}</span>
              <span className="text-muted-foreground">{cnt} responses ({pct}%)</span>
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
        <span className="text-sm font-bold flex-1 truncate">{q.title || "(Untitled)"}</span>
        {q.required && <span className="text-[9px] text-destructive font-black">Required</span>}
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="text-muted-foreground/40 hover:text-destructive transition-colors"><Trash2 className="size-3.5" /></button>
      </div>

      {open && (
        <div className="border-t border-border/30 p-4 space-y-3">
          {/* type selector */}
          <div className="flex gap-1 flex-wrap">
            {Q_TYPES.map(t => (
              <button key={t.id} onClick={() => onChange({ ...q, type: t.id, config: t.id === 'scale' ? { min: 1, max: 5, minLabel: "Very low", maxLabel: "Very high" } : {} })}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1 ${q.type === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                <t.icon className="size-2.5" />{t.label}
              </button>
            ))}
          </div>

          <Input value={q.title} onChange={e => onChange({ ...q, title: e.target.value })} placeholder="Question title *" className="font-bold" />
          <Input value={q.description} onChange={e => onChange({ ...q, description: e.target.value })} placeholder="Question description (optional)" className="md:text-sm text-muted-foreground" />

          {/* options */}
          {hasOptions && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Option</p>
              {q.options.map((o, i) => (
                <div key={o.id} className="flex gap-2">
                  <Input value={o.text} onChange={e => setOptText(o.id, e.target.value)} placeholder={`Option ${i + 1}`} className="md:text-sm" />
                  {q.options.length > 1 && <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => delOption(o.id)}><X className="size-3" /></Button>}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addOption} className="w-full font-black text-xs gap-1.5"><Plus className="size-3" />Add option</Button>
            </div>
          )}

          {/* scale config */}
          {isScale && (
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Minimum</p><Input type="number" value={q.config.min ?? 1} onChange={e => onChange({ ...q, config: { ...q.config, min: +e.target.value } })} className="md:text-sm" /></div>
              <div><p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Maximum</p><Input type="number" value={q.config.max ?? 5} onChange={e => onChange({ ...q, config: { ...q.config, max: +e.target.value } })} className="md:text-sm" /></div>
              <div><p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Minimum label</p><Input value={q.config.minLabel ?? ''} onChange={e => onChange({ ...q, config: { ...q.config, minLabel: e.target.value } })} className="md:text-sm" /></div>
              <div><p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Maximum label</p><Input value={q.config.maxLabel ?? ''} onChange={e => onChange({ ...q, config: { ...q.config, maxLabel: e.target.value } })} className="md:text-sm" /></div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {/* conditional show */}
            {prevQs.filter(p => ['choice','checkbox','dropdown'].includes(p.type) && p.options.length).length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Show when:</span>
                <select className="text-[10px] bg-muted border border-border/50 rounded-lg px-2 py-1 font-medium"
                  value={q.config.showIf?.questionId ?? ''}
                  onChange={e => onChange({ ...q, config: { ...q.config, showIf: e.target.value ? { questionId: e.target.value, value: '' } : undefined } })}>
                  <option value="">Always visible</option>
                  {prevQs.filter(p => ['choice','checkbox','dropdown'].includes(p.type)).map(p => (
                    <option key={p.id} value={p.id}>{p.title || "(Untitled)"}</option>
                  ))}
                </select>
                {q.config.showIf?.questionId && (
                  <select className="text-[10px] bg-muted border border-border/50 rounded-lg px-2 py-1 font-medium"
                    value={q.config.showIf.value}
                    onChange={e => onChange({ ...q, config: { ...q.config, showIf: { ...q.config.showIf!, value: e.target.value } } })}>
                    <option value="">Select an option</option>
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
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Required</span>
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
  const { showError, showSuccess } = useAlert();
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
    const cfg: QConfig = type === 'scale' ? { min: 1, max: 5, minLabel: "Very low", maxLabel: "Very high" } : {};
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
    if (!title.trim()) { showError("Enter a title"); return; }
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
      showSuccess("Saved.");
      onSaved();
    } catch (e: any) { showError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-4" /></Button>
        <h2 className="font-black text-xl uppercase tracking-tighter">{poll ? "Edit poll" : "Create poll"}</h2>
      </div>
      <div className="space-y-3 p-5 border border-border/50 rounded-2xl bg-card">
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Poll title *" className="text-lg font-black" />
        <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" className="font-medium text-muted-foreground" />
        <div className="flex gap-3 flex-wrap">
          <div><p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Closing date</p><Input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} className="md:text-xs" /></div>
          <label className="flex items-center gap-2 mt-5 cursor-pointer">
            <div onClick={() => setShowRes(v => !v)} className={`w-8 h-4 rounded-full relative transition-all ${showRes ? 'bg-primary' : 'bg-muted'}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${showRes ? 'left-4' : 'left-0.5'}`} />
            </div>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Show results</span>
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
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 text-center">Add question</p>
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
        <Button variant="outline" onClick={onBack} className="font-black uppercase text-xs">Cancel</Button>
        <Button onClick={save} disabled={saving} className="font-black uppercase text-xs">{saving ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}

// ─── PollForm ─────────────────────────────────────────────────────────────────
function PollForm({ poll, questions, onSubmitted, onBack }: { poll: Poll; questions: Question[]; onSubmitted: () => void; onBack: () => void }) {
  const { user } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const closed = isClosed(poll);

  const visibleQs = questions.filter(q => isVisible(q, answers));

  const submit = async () => {
    for (const q of visibleQs) {
      if (!q.required) continue;
      const v = answers[q.id];
      const empty = v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);
      if (empty) { showError(`"${q.title || "Question"}" is required`); return; }
    }
    setSubmitting(true);
    try {
      const { data: resp, error: re } = await supabase.from('poll_responses').insert({ poll_id: poll.id, user_id: user!.id }).select().single();
      if (re) throw re;
      const rows = visibleQs.map(q => ({ response_id: resp.id, question_id: q.id, value: answers[q.id] ?? null }));
      const { error: ae } = await supabase.from('poll_answers').insert(rows);
      if (ae) throw ae;
      showSuccess("Response submitted.");
      onSubmitted();
    } catch (e: any) { showError(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-4" /></Button>
        <div>
          <h2 className="font-black text-xl tracking-tighter">{poll.title}</h2>
          {poll.description && <p className="text-sm text-muted-foreground mt-0.5">{poll.description}</p>}
          {poll.ends_at && <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Closes: {fmtDate(poll.ends_at)}</p>}
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
            {closed && <p className="text-sm text-muted-foreground italic">This poll is closed.</p>}
          </div>
        ))}
      </div>

      {!closed && (
        <Button onClick={submit} disabled={submitting} className="w-full font-black uppercase tracking-widest h-12">
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      )}
    </div>
  );
}

// ─── PollResults ──────────────────────────────────────────────────────────────
function PollResults({ poll, questions, onBack }: { poll: Poll; questions: Question[]; onBack: () => void }) {
  const [allAnswers, setAllAnswers] = useState<any[]>([]);
  const [resCount,   setResCount]   = useState(0);
  const [insight, setInsight] = useState('');
  const insightKeyRef = useRef('');

  useEffect(() => {
    setInsight('');
    (async () => {
      const { data: responses } = await supabase.from('poll_responses').select('id').eq('poll_id', poll.id);
      setResCount(responses?.length ?? 0);
      if (!responses?.length) return;
      const ids = responses.map(r => r.id);
      const { data: answers } = await supabase.from('poll_answers').select('question_id, value').in('response_id', ids);
      setAllAnswers(answers ?? []);
    })();
  }, [poll.id]);

  useEffect(() => {
    if (resCount < 3 || allAnswers.length === 0) return;
    const key = `admin-en-poll-insight:${poll.id}:${resCount}:${allAnswers.length}`;
    if (insightKeyRef.current === key) return;
    insightKeyRef.current = key;
    const cached = sessionStorage.getItem(key);
    if (cached) { setInsight(cached); return; }
    const lines = questions.map(q => {
      const values = allAnswers.filter(answer => answer.question_id === q.id).map(answer => answer.value);
      if (q.type === 'text' || q.type === 'paragraph') return `${q.title}: text responses ${values.length} responses`;
      if (q.type === 'scale') {
        const nums = values.map(Number).filter(Number.isFinite);
        const average = nums.length ? (nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(1) : "No responses";
        return `${q.title}: average ${average}, responses ${nums.length} responses`;
      }
      return `${q.title}: ${q.options.map(option => {
        const count = values.filter(value => Array.isArray(value) ? value.includes(option.id) : value === option.id).length;
        return `${option.text} ${count} responses`;
      }).join(', ')}`;
    });
    let cancelled = false;
    requestAi('poll_insight', `Total respondents ${resCount} responses
${lines.join('\n')}`).then(text => {
      if (cancelled) return;
      setInsight(text);
      sessionStorage.setItem(key, text);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [allAnswers, poll.id, questions, resCount]);

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-4" /></Button>
        <div>
          <h2 className="font-black text-xl tracking-tighter">{poll.title}  — Results</h2>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">Total {resCount} responses</p>
        </div>
      </div>
      {insight && <p className="flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed" aria-label="AI summary"><Sparkles className="mt-0.5 size-4 shrink-0 text-primary" /><span>{insight} <span className="text-xs text-muted-foreground">Generated from aggregate results. Refer to the exact figures below.</span></span></p>}
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
  const { showSuccess } = useAlert();
  const [polls,  setPolls]  = useState<Poll[]>([]);
  const [myResponses, setMyResponses] = useState<string[]>([]); // poll_ids I've answered
  const [view,   setView]   = useState<View>({ type: 'list' });
  const [loading, setLoading] = useState(true);
  const [justFinished, setJustFinished] = useState(false);
  const [tab,    setTab]    = useState<'active' | 'closed'>('active');
  const [dbMissing, setDbMissing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadPolls = useCallback(async () => {
    const { data, error } = await supabase.from('polls').select('*').order('created_at', { ascending: false }).limit(500);
    if (error?.message?.includes('does not exist')) { setDbMissing(true); setLoading(false); return; }
    setPolls((data ?? []) as Poll[]);
    if (user) {
      const { data: resps } = await supabase.from('poll_responses').select('poll_id').eq('user_id', user.id);
      setMyResponses((resps ?? []).map(r => r.poll_id));
    }
    setLoading(false);
    setJustFinished(true);
    setTimeout(() => setJustFinished(false), 600);
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
    showSuccess("Poll closed."); loadPolls();
  };

  const deletePoll = async (pollId: string) => {
    await supabase.from('polls').delete().eq('id', pollId);
    showSuccess("Deleted."); loadPolls();
  };

  if (dbMissing) return (
    <main className="px-4 py-16 flex flex-col items-center gap-5 text-center max-w-lg mx-auto">
      <p className="text-4xl">⚠️</p>
      <h2 className="font-black text-xl uppercase tracking-tight">Database setup required</h2>
      <p className="text-sm text-muted-foreground">
        <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">supabase_polls_migration.sql</code>in the SQL editor.
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
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete this poll?"
        description="This will permanently delete the poll and all responses."
        onConfirm={() => { deletePoll(confirmDeleteId!); setConfirmDeleteId(null); }}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">Polls</h1>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">School events, competitions and surveys</p>
        </div>
        {isAdmin && <Button onClick={() => setView({ type: 'builder' })} className="font-black uppercase tracking-widest gap-2"><Plus className="size-4" />Create poll</Button>}
      </div>

      <SegmentedTabs
        items={(['active', 'closed'] as const).map(t => ({
          value: t,
          label: `${t === 'active' ? "Active" : "Closed"} (${polls.filter(p => t === 'active' ? (p.is_active && (!p.ends_at || new Date(p.ends_at) >= new Date())) : isClosed(p)).length})`,
        }))}
        value={tab}
        onChange={(v) => setTab(v as 'active' | 'closed')}
      />

      {loading || justFinished ? <div className="py-16 flex items-center justify-center"><LoadingSpinner done={justFinished} size={56} label="Loading polls" /></div>
      : shown.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed rounded-3xl text-muted-foreground font-medium">
          {tab === 'active' ? "No active polls." : "No closed polls."}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((poll, i) => {
            const voted   = myResponses.includes(poll.id);
            const closed  = isClosed(poll);
            return (
              <div
                key={poll.id}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                className="p-4 border border-border/50 rounded-2xl bg-card hover:bg-muted/20 tilt-3d transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                onClick={() => openPoll(poll)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-sm leading-tight">{poll.title}</h3>
                      {voted  && <Badge variant="success" icon={<CheckCircle2 className="size-2.5" />}>Responded</Badge>}
                      {closed && <Badge variant="muted" icon={<Lock className="size-2.5" />}>Closed</Badge>}
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
                        <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => setConfirmDeleteId(poll.id)}><Trash2 className="size-3.5" /></Button>
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

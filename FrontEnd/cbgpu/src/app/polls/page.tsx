'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Trash2, X, ChevronDown, ChevronUp, Lock, CheckCircle2 } from 'lucide-react';

// ─── types ───────────────────────────────────────────────────────────────────
interface PollOption { id: string; text: string }
interface Poll {
  id: string; created_at: string; title: string; description: string;
  options: PollOption[]; ends_at: string | null; is_active: boolean;
  created_by: string; allow_multiple: boolean;
}
interface Vote { poll_id: string; user_id: string; option_ids: string[] }

// ─── helpers ─────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }
function fmtDate(s: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString('ko-KR', { month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

// ─── PollCard ─────────────────────────────────────────────────────────────────
function PollCard({
  poll, myVote, allVotes, onVote, onClose, isAdmin,
}: {
  poll: Poll; myVote: Vote | null; allVotes: Vote[];
  onVote: (pollId: string, optIds: string[]) => void;
  onClose: (pollId: string) => void;
  isAdmin: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string[]>(myVote?.option_ids ?? []);
  const hasVoted = !!myVote;
  const expired  = poll.ends_at ? new Date(poll.ends_at) < new Date() : false;
  const closed   = !poll.is_active || expired;

  const totalVotes = allVotes.length;
  const countFor = (optId: string) =>
    allVotes.filter(v => v.option_ids.includes(optId)).length;

  const toggle = (id: string) => {
    if (closed || hasVoted) return;
    if (poll.allow_multiple) {
      setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    } else {
      setSelected([id]);
    }
  };

  return (
    <div className={`rounded-2xl border transition-all ${poll.is_active && !expired ? 'border-border/50' : 'border-border/20 opacity-70'}`}>
      {/* header */}
      <div className="p-4 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-sm leading-tight">{poll.title}</h3>
              {closed && <span className="text-[9px] font-black text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1"><Lock className="size-2.5" />마감</span>}
              {hasVoted && <span className="text-[9px] font-black text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1"><CheckCircle2 className="size-2.5" />투표완료</span>}
            </div>
            {poll.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{poll.description}</p>}
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
              <span>{totalVotes}명 참여</span>
              {poll.ends_at && <span>~{fmtDate(poll.ends_at)}</span>}
              {poll.allow_multiple && <span>복수 선택 가능</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && poll.is_active && !expired && (
              <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive"
                onClick={e => { e.stopPropagation(); onClose(poll.id); }}>
                <X className="size-3" />
              </Button>
            )}
            {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
          </div>
        </div>
      </div>

      {/* expanded body */}
      {expanded && (
        <div className="px-4 pb-5 border-t border-border/30 pt-4 space-y-2">
          {poll.description && <p className="text-sm text-muted-foreground mb-3">{poll.description}</p>}
          {poll.options.map(opt => {
            const cnt = countFor(opt.id);
            const pct = totalVotes > 0 ? Math.round((cnt / totalVotes) * 100) : 0;
            const isMine = myVote?.option_ids.includes(opt.id);
            const isSel  = selected.includes(opt.id);
            return (
              <div key={opt.id}
                onClick={() => toggle(opt.id)}
                className={`relative rounded-xl border p-3 transition-all overflow-hidden ${
                  closed || hasVoted ? 'cursor-default' : 'cursor-pointer hover:border-primary/50'
                } ${isMine ? 'border-primary/40 bg-primary/5' : isSel ? 'border-primary/60 bg-primary/10' : 'border-border/40'}`}
              >
                {/* progress bar */}
                {(hasVoted || closed) && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="h-full bg-primary/5 transition-all duration-700 rounded-xl"
                      style={{ width: `${pct}%` }} />
                  </div>
                )}
                <div className="relative flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                      isMine || isSel ? 'border-primary bg-primary' : 'border-border/60'
                    }`}>
                      {(isMine || isSel) && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm font-bold">{opt.text}</span>
                  </div>
                  {(hasVoted || closed) && (
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-muted-foreground shrink-0">
                      <span>{cnt}명</span>
                      <span className="text-primary/70">{pct}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {!closed && !hasVoted && (
            <Button
              className="w-full font-black uppercase tracking-widest mt-2"
              disabled={!selected.length}
              onClick={() => onVote(poll.id, selected)}
            >
              투표하기
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CreatePollModal ──────────────────────────────────────────────────────────
function CreatePollModal({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [desc, setDesc]   = useState('');
  const [opts, setOpts]   = useState(['', '']);
  const [endsAt, setEndsAt] = useState('');
  const [multi, setMulti] = useState(false);
  const [saving, setSaving] = useState(false);

  const addOpt   = () => setOpts(o => [...o, '']);
  const removeOpt = (i: number) => setOpts(o => o.filter((_, j) => j !== i));
  const setOpt   = (i: number, v: string) => setOpts(o => o.map((x, j) => j === i ? v : x));

  const save = async () => {
    if (!title.trim()) { toast.error('제목을 입력하세요'); return; }
    const validOpts = opts.filter(o => o.trim());
    if (validOpts.length < 2) { toast.error('선택지를 2개 이상 입력하세요'); return; }
    setSaving(true);
    const options: PollOption[] = validOpts.map(text => ({ id: uid(), text }));
    const { error } = await supabase.from('polls').insert({
      title: title.trim(), description: desc.trim(),
      options, ends_at: endsAt || null,
      is_active: true, allow_multiple: multi,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('투표가 생성됐습니다!');
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-lg uppercase tracking-tighter">새 투표 만들기</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">제목 *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="통계 대회 선호 분야" className="mt-1 font-medium" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">설명 (선택)</label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="부연 설명" className="mt-1 font-medium" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">선택지 *</label>
            <div className="space-y-1.5 mt-1">
              {opts.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={o} onChange={e => setOpt(i, e.target.value)}
                    placeholder={`선택지 ${i + 1}`} className="font-medium" />
                  {opts.length > 2 && (
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeOpt(i)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {opts.length < 8 && (
                <Button variant="outline" size="sm" onClick={addOpt} className="w-full font-black text-xs gap-1.5">
                  <Plus className="size-3" /> 선택지 추가
                </Button>
              )}
            </div>
          </div>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">마감일 (선택)</label>
              <Input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} className="mt-1 font-medium text-xs" />
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div onClick={() => setMulti(m => !m)}
                  className={`w-10 h-5 rounded-full transition-all relative ${multi ? 'bg-primary' : 'bg-muted'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${multi ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">복수 선택</span>
              </label>
            </div>
          </div>
        </div>

        <Button className="w-full font-black uppercase tracking-widest" onClick={save} disabled={saving}>
          {saving ? '저장 중...' : '투표 생성'}
        </Button>
      </div>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────
export default function PollsPage() {
  const { user, isAdmin } = useAuth();
  const [polls, setPolls]       = useState<Poll[]>([]);
  const [myVotes, setMyVotes]   = useState<Vote[]>([]);
  const [allVotes, setAllVotes] = useState<Vote[]>([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [tab, setTab]           = useState<'active'|'closed'>('active');
  const [dbMissing, setDbMissing] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: pollData, error: pollErr }, { data: voteData }] = await Promise.all([
      supabase.from('polls').select('*').order('created_at', { ascending: false }),
      user ? supabase.from('poll_votes').select('*') : { data: [] },
    ]);
    if (pollErr?.message?.includes('does not exist')) { setDbMissing(true); setLoading(false); return; }
    setPolls((pollData ?? []) as Poll[]);
    const allV = (voteData ?? []) as Vote[];
    setAllVotes(allV);
    setMyVotes(user ? allV.filter(v => v.user_id === user.id) : []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('polls-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const vote = async (pollId: string, optIds: string[]) => {
    if (!user) { toast.error('로그인이 필요합니다'); return; }
    const { error } = await supabase.from('poll_votes').insert({ poll_id: pollId, user_id: user.id, option_ids: optIds });
    if (error) { toast.error(error.message); return; }
    toast.success('투표가 완료됐습니다!');
    fetchAll();
  };

  const closePoll = async (pollId: string) => {
    const { error } = await supabase.from('polls').update({ is_active: false }).eq('id', pollId);
    if (error) { toast.error(error.message); return; }
    toast.success('투표가 마감됐습니다.');
    fetchAll();
  };

  const activePolls = polls.filter(p => p.is_active && (!p.ends_at || new Date(p.ends_at) >= new Date()));
  const closedPolls = polls.filter(p => !p.is_active || (p.ends_at && new Date(p.ends_at) < new Date()));
  const shown = tab === 'active' ? activePolls : closedPolls;

  if (dbMissing) return (
    <main className="px-4 py-16 flex flex-col items-center gap-5 text-center max-w-lg mx-auto">
      <p className="text-4xl">⚠️</p>
      <h2 className="font-black text-xl uppercase tracking-tight">DB 설정 필요</h2>
      <p className="text-sm text-muted-foreground">
        프로젝트 루트의 <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">supabase_polls_migration.sql</code> 파일을<br />
        Supabase SQL Editor에서 실행해 주세요.
      </p>
    </main>
  );

  return (
    <main className="px-4 py-8 space-y-6 max-w-2xl mx-auto">
      {creating && <CreatePollModal onCreated={() => { setCreating(false); fetchAll(); }} onClose={() => setCreating(false)} />}

      {/* header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">투표</h1>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
            학교 통계·대회·행사 투표
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreating(true)} className="font-black uppercase tracking-widest gap-2">
            <Plus className="size-4" /> 투표 만들기
          </Button>
        )}
      </div>

      {/* tab */}
      <div className="flex gap-1.5">
        {([['active','진행 중'], ['closed','마감']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all ${
              tab === id ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}>
            {label} ({id === 'active' ? activePolls.length : closedPolls.length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted/50 animate-pulse rounded-2xl" />)}</div>
      ) : shown.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed rounded-3xl text-muted-foreground font-medium">
          {tab === 'active' ? '진행 중인 투표가 없습니다.' : '마감된 투표가 없습니다.'}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(poll => (
            <PollCard
              key={poll.id} poll={poll}
              myVote={myVotes.find(v => v.poll_id === poll.id) ?? null}
              allVotes={allVotes.filter(v => v.poll_id === poll.id)}
              onVote={vote} onClose={closePoll}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {!user && (
        <p className="text-center text-xs text-muted-foreground font-medium">로그인하면 투표에 참여할 수 있습니다.</p>
      )}
    </main>
  );
}

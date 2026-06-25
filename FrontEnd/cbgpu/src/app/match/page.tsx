'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import { Plus, Users, X, Trash2, Lock } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';

interface StudyPost {
  id: string; created_at: string; user_id: string;
  subject: string; title: string; description: string;
  tags: string[]; max_members: number; is_open: boolean;
}
interface Member { post_id: string; user_id: string; joined_at: string }

const SUBJECTS = ['수학', '물리', '화학', '생물', '지구과학', '정보', 'AI/ML', '프로그래밍', '영어', '국어', '기타'];

function PostCard({
  post, members, myUserId, onJoin, onLeave, onDelete, onClose,
}: {
  post: StudyPost; members: Member[]; myUserId: string;
  onJoin: () => void; onLeave: () => void;
  onDelete: () => void; onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const cnt    = members.filter(m => m.post_id === post.id).length;
  const joined = members.some(m => m.post_id === post.id && m.user_id === myUserId);
  const isOwner = post.user_id === myUserId;
  const full   = cnt >= post.max_members;

  return (
    <div className="border border-border/50 rounded-2xl bg-card transition-all hover:bg-muted/10 tilt-3d">
      <div className="p-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge>{post.subject}</Badge>
              {!post.is_open && <Badge variant="muted" icon={<Lock className="size-2.5" />}>마감</Badge>}
              {joined && <Badge variant="success">참여 중</Badge>}
            </div>
            <h3 className="font-black text-sm">{post.title}</h3>
            {post.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{post.description}</p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 text-[11px] font-black text-muted-foreground">
              <Users className="size-3" />{cnt}/{post.max_members}
            </div>
            {isOwner && (
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                {post.is_open && <Button variant="ghost" size="icon" className="size-6" onClick={onClose}><Lock className="size-3" /></Button>}
                <Button variant="ghost" size="icon" className="size-6 text-destructive" onClick={onDelete}><Trash2 className="size-3" /></Button>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {post.tags.map(t => <Badge key={t} variant="muted">{t}</Badge>)}
        </div>
      </div>

      {open && (
        <div className="border-t border-border/20 p-4 space-y-3">
          {post.description && <p className="text-sm text-muted-foreground">{post.description}</p>}
          <p className="text-xs text-muted-foreground">최대 {post.max_members}명 · 현재 {cnt}명 참여 중</p>
          {post.is_open && !isOwner && (
            joined
              ? <Button variant="outline" size="sm" onClick={onLeave} className="font-black text-xs uppercase gap-1.5"><X className="size-3" />탈퇴</Button>
              : <Button size="sm" onClick={onJoin} disabled={full} className="font-black text-xs uppercase gap-1.5">
                  <Plus className="size-3" />{full ? '정원 초과' : '참여하기'}
                </Button>
          )}
        </div>
      )}
    </div>
  );
}

function CreateForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { user } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [subject,  setSubject]  = useState('수학');
  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags,     setTags]     = useState<string[]>([]);
  const [max,      setMax]      = useState(4);
  const [saving,   setSaving]   = useState(false);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t) && tags.length < 5) setTags(tg => [...tg, t]);
    setTagInput('');
  };

  const submit = async () => {
    if (!title.trim()) { showError('제목을 입력하세요'); return; }
    setSaving(true);
    const { error } = await supabase.from('study_posts').insert({ user_id: user!.id, subject, title, description: desc, tags, max_members: max, is_open: true });
    setSaving(false);
    if (error) { showError(error.message); return; }
    showSuccess('스터디 그룹이 만들어졌습니다!');
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-lg uppercase tracking-tighter">새 스터디 만들기</h2>
          <Button variant="ghost" size="icon" onClick={onCancel}><X className="size-4" /></Button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {SUBJECTS.map(s => (
            <button key={s} onClick={() => setSubject(s)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${subject===s?'bg-primary text-primary-foreground':'bg-muted text-muted-foreground'}`}>{s}</button>
          ))}
        </div>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="스터디 제목 *" className="font-bold" />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="설명 (선택)" rows={3}
          className="w-full px-3 py-2 text-sm bg-muted/30 border border-border/50 rounded-xl outline-none focus:border-primary resize-none font-medium" />
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">최대 인원</p>
            <Input type="number" min={2} max={20} value={max} onChange={e => setMax(+e.target.value)} className="text-sm" />
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">태그 (최대 5개)</p>
            <div className="flex gap-1">
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => (e.key==='Enter'||e.key===',') && (e.preventDefault(),addTag())}
                placeholder="Enter로 추가" className="text-xs h-9" />
            </div>
          </div>
        </div>
        {tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {tags.map(t => <span key={t} className="flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {t}<button onClick={() => setTags(tg => tg.filter(x=>x!==t))}><X className="size-2.5" /></button>
            </span>)}
          </div>
        )}
        <Button onClick={submit} disabled={saving} className="w-full font-black uppercase tracking-widest">
          {saving ? '만드는 중...' : '스터디 만들기'}
        </Button>
      </div>
    </div>
  );
}

export default function MatchPage() {
  const { user } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [posts,   setPosts]   = useState<StudyPost[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tab,     setTab]     = useState<'all'|'mine'>('all');
  const [filter,  setFilter]  = useState('');
  const [creating,setCreating]= useState(false);
  const [loading, setLoading] = useState(true);
  const [justFinished, setJustFinished] = useState(false);
  const [dbMissing, setDbMissing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: p, error }, { data: m }] = await Promise.all([
      supabase.from('study_posts').select('*').order('created_at', { ascending: false }),
      supabase.from('study_members').select('*'),
    ]);
    if (error?.message?.includes('does not exist')) { setDbMissing(true); setLoading(false); return; }
    setPosts((p ?? []) as StudyPost[]);
    setMembers((m ?? []) as Member[]);
    setLoading(false);
    setJustFinished(true);
    setTimeout(() => setJustFinished(false), 600);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel('study-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_posts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_members' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const join  = async (postId: string) => {
    const { error } = await supabase.from('study_members').insert({ post_id: postId, user_id: user!.id });
    if (error) { showError(error.message); return; }
    showSuccess('참여했습니다!'); load();
  };
  const leave = async (postId: string) => {
    await supabase.from('study_members').delete().eq('post_id', postId).eq('user_id', user!.id);
    showSuccess('탈퇴했습니다.'); load();
  };
  const del   = async (postId: string) => {
    await supabase.from('study_posts').delete().eq('id', postId);
    showSuccess('삭제됐습니다.'); load();
  };
  const close = async (postId: string) => {
    await supabase.from('study_posts').update({ is_open: false }).eq('id', postId);
    load();
  };

  if (dbMissing) return (
    <main className="px-4 py-16 flex flex-col items-center gap-4 text-center max-w-lg mx-auto">
      <p className="text-4xl">⚠️</p>
      <p className="font-black text-xl uppercase tracking-tight">DB 설정 필요</p>
      <p className="text-sm text-muted-foreground"><code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">supabase_notes_study_migration.sql</code>을 실행해 주세요.</p>
    </main>
  );

  const myPostIds = posts.filter(p => p.user_id === user?.id).map(p => p.id);
  const myJoined  = members.filter(m => m.user_id === user?.id).map(m => m.post_id);
  const shown = posts
    .filter(p => tab === 'all' ? true : myPostIds.includes(p.id) || myJoined.includes(p.id))
    .filter(p => !filter || p.subject === filter || p.title.includes(filter) || p.tags.some(t => t.includes(filter)));

  return (
    <main className="px-4 py-8 space-y-6 max-w-2xl mx-auto">
      <ConfirmDialog
        open={!!confirmDeleteId}
        onConfirm={() => { del(confirmDeleteId!); setConfirmDeleteId(null); }}
        onCancel={() => setConfirmDeleteId(null)}
      />
      {creating && <CreateForm onCreated={() => { setCreating(false); load(); }} onCancel={() => setCreating(false)} />}

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">스터디 매칭</h1>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">같이 공부할 사람 구하기</p>
        </div>
        {user && <Button onClick={() => setCreating(true)} className="font-black uppercase gap-2"><Plus className="size-4" />만들기</Button>}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <SegmentedTabs
          items={[{ value: 'all', label: '전체' }, { value: 'mine', label: '참여 중' }]}
          value={tab}
          onChange={(v) => setTab(v as 'all' | 'mine')}
        />
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilter('')}
            className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${!filter?'bg-primary/10 text-primary':'bg-muted text-muted-foreground'}`}>전체</button>
          {SUBJECTS.map(s => (
            <button key={s} onClick={() => setFilter(f => f===s?'':s)}
              className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${filter===s?'bg-primary/10 text-primary':'bg-muted text-muted-foreground'}`}>{s}</button>
          ))}
        </div>
      </div>

      {loading ? <div className="py-16 flex items-center justify-center"><LoadingSpinner done={justFinished} size={56} label="모집글 불러오는 중" /></div>
      : shown.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed rounded-3xl text-muted-foreground font-medium">스터디 그룹이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {shown.map((post, i) => (
            <div key={post.id} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }} className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards">
              <PostCard post={post}
                members={members} myUserId={user?.id ?? ''}
                onJoin={() => join(post.id)} onLeave={() => leave(post.id)}
                onDelete={() => setConfirmDeleteId(post.id)} onClose={() => close(post.id)} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

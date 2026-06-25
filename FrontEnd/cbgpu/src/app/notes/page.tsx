'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import { Plus, Trash2, ArrowLeft, Share2, Lock, Save, Tag, X, Check } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';

// ─── types ────────────────────────────────────────────────────────────────────
interface Note {
  id: string; created_at: string; updated_at: string;
  user_id: string; title: string; content: string;
  tags: string[]; is_shared: boolean;
}

// ─── Simple markdown renderer (no external lib) ───────────────────────────────
function renderMd(raw: string): string {
  const lines = raw.split('\n');
  let html = ''; let inCode = false; let inList = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('```')) { inCode = !inCode; html += inCode ? '<pre class="bg-muted rounded-xl p-4 my-3 overflow-x-auto text-sm font-mono"><code>' : '</code></pre>'; continue; }
    if (inCode) { html += escHtml(l) + '\n'; continue; }
    if (inList && !l.startsWith('- ') && !l.match(/^\d+\. /)) { html += '</ul>'; inList = false; }
    if (l.startsWith('### ')) { html += `<h3 class="text-lg font-black mt-5 mb-1">${inlineMd(l.slice(4))}</h3>`; }
    else if (l.startsWith('## '))  { html += `<h2 class="text-xl font-black mt-6 mb-2">${inlineMd(l.slice(3))}</h2>`; }
    else if (l.startsWith('# '))   { html += `<h1 class="text-2xl font-black mt-8 mb-3">${inlineMd(l.slice(2))}</h1>`; }
    else if (l.startsWith('> '))   { html += `<blockquote class="border-l-4 border-primary/40 pl-4 my-2 text-muted-foreground italic">${inlineMd(l.slice(2))}</blockquote>`; }
    else if (l.startsWith('---'))  { html += '<hr class="border-border/40 my-4" />'; }
    else if (l.startsWith('- '))   { if (!inList) { html += '<ul class="list-disc ml-5 my-2 space-y-0.5">'; inList = true; } html += `<li class="text-sm leading-relaxed">${inlineMd(l.slice(2))}</li>`; }
    else if (l.match(/^\d+\. /))   { if (!inList) { html += '<ol class="list-decimal ml-5 my-2 space-y-0.5">'; inList = true; } html += `<li class="text-sm leading-relaxed">${inlineMd(l.replace(/^\d+\. /, ''))}</li>`; }
    else if (l.trim() === '')      { html += '<br />'; }
    else                           { html += `<p class="text-sm leading-relaxed my-1">${inlineMd(l)}</p>`; }
  }
  if (inList) html += '</ul>';
  return html;
}
function escHtml(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function inlineMd(s: string) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>');
}

// ─── NoteEditor ───────────────────────────────────────────────────────────────
function NoteEditor({ note, onBack, onSaved }: { note: Note | null; onBack: () => void; onSaved: (n: Note) => void }) {
  const { user } = useAuth();
  const { showError } = useAlert();
  const isOwner = !note || note.user_id === user?.id;
  const [title,    setTitle]    = useState(note?.title ?? '');
  const [content,  setContent]  = useState(note?.content ?? '');
  const [tags,     setTags]     = useState<string[]>(note?.tags ?? []);
  const [shared,   setShared]   = useState(note?.is_shared ?? false);
  const [tagInput, setTagInput] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [view,     setView]     = useState<'edit'|'preview'>('edit');
  const autoRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const savedFlashRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const save = useCallback(async (t = title, c = content, tg = tags, sh = shared) => {
    if (!user) return;
    setSaveState('saving');
    const payload = { title: t || '제목 없음', content: c, tags: tg, is_shared: sh, updated_at: new Date().toISOString(), user_id: user.id };
    const { data, error } = note
      ? await supabase.from('research_notes').update(payload).eq('id', note.id).select().single()
      : await supabase.from('research_notes').insert(payload).select().single();
    if (error) { setSaveState('idle'); showError(error.message); return; }
    setSaveState('saved');
    if (savedFlashRef.current) clearTimeout(savedFlashRef.current);
    savedFlashRef.current = setTimeout(() => setSaveState('idle'), 1500);
    onSaved(data as Note);
  }, [note, title, content, tags, shared, user, onSaved, showError]);

  // auto-save debounce
  const scheduleAutoSave = () => {
    if (autoRef.current) clearTimeout(autoRef.current);
    autoRef.current = setTimeout(() => save(), 2000);
  };

  /**
   * 공유 토글/태그 삭제처럼 즉시 저장해야 하는 동작 전용.
   * 예약돼 있던 자동 저장(2초 디바운스)을 취소하지 않으면, 그 안에 캡처된
   * 오래된 shared/tags 값으로 나중에 덮어써서 방금 한 변경이 사라지는 버그가 있었다.
   */
  const saveNow = useCallback((t = title, c = content, tg = tags, sh = shared) => {
    if (autoRef.current) { clearTimeout(autoRef.current); autoRef.current = null; }
    save(t, c, tg, sh);
  }, [save, title, content, tags, shared]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) { const next = [...tags, t]; setTags(next); scheduleAutoSave(); }
    setTagInput('');
  };

  // toolbar shortcuts
  const wrap = (before: string, after = before) => {
    const ta = document.getElementById('note-content') as HTMLTextAreaElement;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd, val = ta.value;
    const next = val.slice(0, s) + before + val.slice(s, e) + after + val.slice(e);
    setContent(next);
    setTimeout(() => { ta.selectionStart = s + before.length; ta.selectionEnd = e + before.length; ta.focus(); }, 0);
  };

  const TOOLBAR = [
    { label: 'H1', action: () => { const ta = document.getElementById('note-content') as HTMLTextAreaElement; const pos = ta?.value.lastIndexOf('\n', ta.selectionStart-1)+1; setContent(c => c.slice(0,pos)+'# '+c.slice(pos)); }},
    { label: 'H2', action: () => { const ta = document.getElementById('note-content') as HTMLTextAreaElement; const pos = ta?.value.lastIndexOf('\n', ta.selectionStart-1)+1; setContent(c => c.slice(0,pos)+'## '+c.slice(pos)); }},
    { label: 'B',  action: () => wrap('**') },
    { label: 'I',  action: () => wrap('*') },
    { label: '`',  action: () => wrap('`') },
    { label: '```',action: () => wrap('```\n', '\n```') },
    { label: '>',  action: () => { const ta = document.getElementById('note-content') as HTMLTextAreaElement; const pos = ta?.value.lastIndexOf('\n', ta.selectionStart-1)+1; setContent(c => c.slice(0,pos)+'> '+c.slice(pos)); }},
    { label: '—',  action: () => setContent(c => c + '\n---\n') },
  ];

  // 다른 사람이 공유한 노트는 읽기만 가능 — DB RLS도 실제 수정을 막지만,
  // 편집 UI를 그대로 보여주면 한참 고치고 저장할 때야 에러를 보게 돼서 미리 분기한다.
  if (!isOwner) {
    return (
      <div className="flex flex-col h-screen max-h-screen">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={onBack} className="active:scale-90 transition-transform"><ArrowLeft className="size-4" /></Button>
          <h1 className="flex-1 font-black text-base truncate px-2">{title || '제목 없음'}</h1>
          <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted shrink-0">
            <Share2 className="size-3" />공개 노트
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4"
          dangerouslySetInnerHTML={{ __html: renderMd(content) || '<p class="text-muted-foreground text-sm">내용이 없습니다.</p>' }} />
        {tags.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border/20 flex-shrink-0 flex-wrap">
            <Tag className="size-3 text-muted-foreground shrink-0" />
            {tags.map(t => <span key={t} className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 flex-shrink-0 flex-wrap gap-y-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="active:scale-90 transition-transform"><ArrowLeft className="size-4" /></Button>
        <Input value={title} onChange={e => { setTitle(e.target.value); scheduleAutoSave(); }}
          placeholder="제목 없음" className="flex-1 min-w-32 font-black text-base border-none shadow-none focus-visible:ring-0 px-2" />
        <div className="flex gap-1 items-center ml-auto flex-wrap">
          <button onClick={() => { const n = !shared; setShared(n); saveNow(title, content, tags, n); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${shared?'text-primary bg-primary/10':'text-muted-foreground bg-muted'}`}>
            {shared ? <Share2 className="size-3" /> : <Lock className="size-3" />}
            {shared ? '공개' : '비공개'}
          </button>
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {(['edit','preview'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${view===v?'bg-background shadow text-foreground':'text-muted-foreground'}`}>
                {v === 'edit' ? '편집' : '미리보기'}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => saveNow()}
            disabled={saveState === 'saving'}
            className={`font-black text-xs gap-1.5 transition-all active:scale-95 ${saveState === 'saved' ? 'bg-emerald-600 hover:bg-emerald-600 text-white' : ''}`}
          >
            {saveState === 'saving' ? (
              <>저장 중...</>
            ) : saveState === 'saved' ? (
              <span key="saved" className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                <Check className="size-3" />저장됨
              </span>
            ) : (
              <>
                <Save className="size-3" />저장
              </>
            )}
          </Button>
        </div>
      </div>

      {/* toolbar */}
      {view === 'edit' && (
        <div className="flex gap-1 px-4 py-1.5 border-b border-border/20 overflow-x-auto flex-shrink-0">
          {TOOLBAR.map(t => (
            <button key={t.label} onClick={t.action}
              className="px-2 py-1 rounded text-[11px] font-black text-muted-foreground hover:bg-muted transition-all font-mono shrink-0">{t.label}</button>
          ))}
        </div>
      )}

      {/* editor / preview */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {view === 'edit' ? (
          <textarea id="note-content" value={content}
            onChange={e => { setContent(e.target.value); scheduleAutoSave(); }}
            placeholder={'# 연구 노트 제목\n\n내용을 입력하세요...\n\n## 마크다운 문법 지원\n- **굵게**, *기울임*, `코드`\n- # H1, ## H2, ### H3\n- > 인용, --- 구분선\n- ``` 코드 블록 ```'}
            className="flex-1 w-full resize-none px-6 py-4 text-sm font-mono bg-background outline-none leading-relaxed animate-in fade-in duration-200"
          />
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4 animate-in fade-in duration-200"
            dangerouslySetInnerHTML={{ __html: renderMd(content) || '<p class="text-muted-foreground text-sm">내용이 없습니다.</p>' }} />
        )}
      </div>

      {/* tags */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-border/20 flex-shrink-0 flex-wrap">
        <Tag className="size-3 text-muted-foreground shrink-0" />
        {tags.map(t => (
          <span key={t} className="flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full animate-in fade-in zoom-in-95 duration-200">
            {t}<button onClick={() => { const n=tags.filter(x=>x!==t); setTags(n); saveNow(title,content,n,shared); }} className="active:scale-90 transition-transform"><X className="size-2.5" /></button>
          </span>
        ))}
        <input value={tagInput} onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addTag())}
          placeholder="태그 추가 (Enter)" className="text-[10px] bg-transparent outline-none font-medium text-muted-foreground placeholder:text-muted-foreground/40 w-24" />
      </div>
    </div>
  );
}

// ─── NoteList ─────────────────────────────────────────────────────────────────
function NoteList({ onOpen }: { onOpen: (n: Note | null) => void }) {
  const { user } = useAuth();
  const { showSuccess } = useAlert();
  const [notes,  setNotes]  = useState<Note[]>([]);
  const [shared, setShared] = useState<Note[]>([]);
  const [tab,    setTab]    = useState<'mine'|'shared'>('mine');
  const [search, setSearch] = useState('');
  const [loading,setLoading]= useState(true);
  const [dbMissing, setDbMissing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: mine, error }, { data: pub }] = await Promise.all([
      supabase.from('research_notes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('research_notes').select('*').eq('is_shared', true).neq('user_id', user.id).order('updated_at', { ascending: false }),
    ]);
    if (error?.message?.includes('does not exist')) { setDbMissing(true); setLoading(false); return; }
    setNotes((mine ?? []) as Note[]);
    setShared((pub ?? []) as Note[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const deleteNote = async (id: string) => {
    await supabase.from('research_notes').delete().eq('id', id);
    setNotes(n => n.filter(x => x.id !== id));
    showSuccess('삭제됐습니다.');
  };

  if (dbMissing) return (
    <div className="py-16 flex flex-col items-center gap-4 text-center">
      <p className="text-4xl">⚠️</p>
      <p className="font-black text-lg uppercase tracking-tight">DB 설정 필요</p>
      <p className="text-sm text-muted-foreground"><code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">supabase_notes_study_migration.sql</code>을 실행해 주세요.</p>
    </div>
  );

  const shown = (tab === 'mine' ? notes : shared)
    .filter(n => n.title.toLowerCase().includes(search.toLowerCase()) || n.tags.some(t => t.includes(search)));

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={!!confirmDeleteId}
        onConfirm={() => { deleteNote(confirmDeleteId!); setConfirmDeleteId(null); }}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SegmentedTabs
          items={[
            { value: 'mine', label: `내 노트 (${notes.length})` },
            { value: 'shared', label: `공유됨 (${shared.length})` },
          ]}
          value={tab}
          onChange={(v) => setTab(v as 'mine' | 'shared')}
        />
        <div className="flex gap-2">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색..." className="h-8 w-32 text-xs" />
          {tab === 'mine' && <Button onClick={() => onOpen(null)} size="sm" className="font-black text-xs gap-1.5 h-8 active:scale-95 transition-transform"><Plus className="size-3" />새 노트</Button>}
        </div>
      </div>

      {loading ? <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 bg-muted/40 animate-pulse rounded-xl"/>)}</div>
      : shown.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-3xl animate-in fade-in duration-300 pop-in-3d">
          <img src="/3d-icons/notebook.webp" alt="" className="size-20 mx-auto mb-3 opacity-90" />
          <p className="font-medium">{tab==='mine'?'노트를 만들어 보세요.':'공유된 노트가 없습니다.'}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {shown.map((n, i) => (
            <div key={n.id} onClick={() => onOpen(n)}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              className="p-4 border border-border/50 rounded-2xl bg-card hover:bg-muted/20 tilt-3d cursor-pointer transition-all group space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-black text-sm leading-tight line-clamp-1">{n.title}</h3>
                {tab==='mine' && (
                  <button onClick={e=>{e.stopPropagation();setConfirmDeleteId(n.id);}} className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive active:scale-90 transition-all">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{n.content.slice(0,100).replace(/[#*`>-]/g,'') || '(내용 없음)'}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {n.tags.slice(0,3).map(t=><span key={t} className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{t}</span>)}
                <span className="text-[9px] text-muted-foreground ml-auto">{new Date(n.updated_at).toLocaleDateString('ko-KR')}</span>
                {n.is_shared && (
                  <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                    <Share2 className="size-2.5" />공개
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default function NotesPage() {
  const { user } = useAuth();
  const [editing, setEditing] = useState<Note | null | 'new'>('list' as any);

  if (!user) return (
    <main className="px-4 py-16 flex flex-col items-center gap-4 text-center">
      <p className="font-black text-xl uppercase">로그인이 필요합니다</p>
    </main>
  );

  if (editing !== ('list' as any)) {
    return (
      <div className="h-[calc(100vh-80px)]">
        <NoteEditor
          note={editing === 'new' ? null : editing as Note}
          onBack={() => setEditing('list' as any)}
          onSaved={(n) => setEditing(n)}
        />
      </div>
    );
  }

  return (
    <main className="px-4 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-black uppercase tracking-tighter italic">연구노트</h1>
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">마크다운 지원 · 자동 저장 · 공유 가능</p>
      </div>
      <NoteList onOpen={(n) => setEditing(n ?? 'new')} />
    </main>
  );
}

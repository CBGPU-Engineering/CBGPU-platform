'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Loader2, Plus, Search, Tag, Trash2, UploadCloud, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import { getNativeBridge } from '@/lib/nativeBridge';

const MAX_BYTES = 200 * 1024 * 1024;
const PAGE_SIZE = 40;
const API_BASE = (process.env.NEXT_PUBLIC_MATERIALS_API_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:8421' : 'https://cbshoj.taild105d1.ts.net:8443')).replace(/\/$/, '');

type Material = {
  id: string;
  uploader_id: string;
  title: string;
  tags: string[];
  file_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

function fileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function sessionToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('로그인이 필요합니다.');
  return session.access_token;
}

async function apiError(response: Response) {
  const body = await response.json().catch(() => null);
  return new Error(typeof body?.detail === 'string' ? body.detail : `파일 서버 오류 (${response.status})`);
}

export default function MaterialsPage() {
  const { user } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showMine, setShowMine] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (offset = 0) => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from('shared_materials')
      .select('id,uploader_id,title,tags,file_name,content_type,size_bytes,created_at')
      .eq('status', 'ready').order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    setLoading(false);
    if (error) { showError('자료 목록을 불러오지 못했습니다: ' + error.message); return; }
    const rows = (data ?? []) as Material[];
    setMaterials(previous => offset ? [...previous, ...rows] : rows);
    setHasMore(rows.length === PAGE_SIZE);
  }, [user, showError]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return materials.filter(material =>
      (!showMine || material.uploader_id === user?.id) &&
      (!selectedTag || material.tags.includes(selectedTag)) &&
      (!needle || `${material.title} ${material.file_name} ${material.tags.join(' ')}`.toLocaleLowerCase().includes(needle))
    );
  }, [materials, query, selectedTag, showMine, user?.id]);
  const availableTags = useMemo(() => [...new Set(materials.flatMap(material => material.tags))].sort(), [materials]);

  function addTag() {
    const value = tagInput.trim().replace(/^#/, '');
    if (!value) return;
    if (value.length > 20) { showError('태그는 20자까지 입력할 수 있습니다.'); return; }
    if (tags.length >= 8 && !tags.includes(value)) { showError('태그는 최대 8개까지 추가할 수 있습니다.'); return; }
    if (!tags.includes(value)) setTags(previous => [...previous, value]);
    setTagInput('');
  }

  function resetForm() {
    setTitle(''); setTags([]); setTagInput(''); setFile(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function upload() {
    if (!user || !file) { showError('파일을 선택해 주세요.'); return; }
    if (!title.trim()) { showError('제목을 입력해 주세요.'); return; }
    if (title.trim().length > 120) { showError('제목은 120자까지 입력할 수 있습니다.'); return; }
    if (!file.size || file.size > MAX_BYTES) { showError('파일은 200MB 이하로 선택해 주세요.'); return; }
    if (!API_BASE) { showError('파일 서버 주소가 설정되지 않았습니다.'); return; }
    setUploading(true);
    let materialId: string | null = null;
    try {
      const token = await sessionToken();
      const { data, error } = await supabase.from('shared_materials').insert({
        uploader_id: user.id, title: title.trim(), tags, file_name: file.name.slice(0, 255),
        content_type: file.type || 'application/octet-stream', size_bytes: file.size, status: 'pending',
      }).select('id').single();
      if (error) throw error;
      materialId = data.id;
      const response = await fetch(`${API_BASE}/materials/${materialId}/content`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: file,
      });
      if (!response.ok) throw await apiError(response);
      showSuccess('자료가 공유됐습니다.');
      setUploadOpen(false);
      resetForm();
      await load();
    } catch (error) {
      if (materialId) {
        // The network response can fail after the server completed the file.
        // Keep a ready row so its file is never orphaned.
        const { data } = await supabase.from('shared_materials').select('status').eq('id', materialId).maybeSingle();
        if (data?.status === 'ready') {
          showSuccess('자료가 공유됐습니다.');
          setUploadOpen(false);
          resetForm();
          await load();
          return;
        }
        await supabase.from('shared_materials').delete().eq('id', materialId);
      }
      showError(error instanceof Error ? error.message : '자료를 올리지 못했습니다.');
    } finally {
      setUploading(false);
    }
  }

  async function download(material: Material) {
    if (!API_BASE) { showError('파일 서버 주소가 설정되지 않았습니다.'); return; }
    setBusyId(material.id);
    try {
      const token = await sessionToken();
      const bridge = getNativeBridge();
      if (bridge) {
        await bridge.downloadMaterial({ id: material.id, fileName: material.file_name, accessToken: token });
        return;
      }
      const response = await fetch(`${API_BASE}/materials/${material.id}/content`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw await apiError(response);
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl; link.download = material.file_name;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
      showError(error instanceof Error ? error.message : '파일을 내려받지 못했습니다.');
    } finally { setBusyId(null); }
  }

  async function remove(material: Material) {
    if (!window.confirm(`“${material.title}” 자료를 삭제할까요?`)) return;
    if (!API_BASE) { showError('파일 서버 주소가 설정되지 않았습니다.'); return; }
    setBusyId(material.id);
    try {
      const token = await sessionToken();
      const response = await fetch(`${API_BASE}/materials/${material.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw await apiError(response);
      setMaterials(previous => previous.filter(item => item.id !== material.id));
      showSuccess('자료를 삭제했습니다.');
    } catch (error) {
      showError(error instanceof Error ? error.message : '자료를 삭제하지 못했습니다.');
    } finally { setBusyId(null); }
  }

  return <main className="mx-auto max-w-5xl space-y-6 px-1 py-3 sm:py-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold tracking-widest text-muted-foreground">함께 쓰는 학습 자료</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">자료 공유</h1>
        <p className="mt-2 text-sm text-muted-foreground">파일에 제목과 태그를 붙여 올리고, 필요한 자료를 찾아 내려받으세요.</p>
      </div>
      <Button onClick={() => setUploadOpen(true)} className="gap-2"><Plus className="size-4" />자료 올리기</Button>
    </div>

    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="제목, 파일명, 태그 검색" className="h-10 bg-background pl-9" />
        </div>
        <Button variant={showMine ? 'default' : 'outline'} onClick={() => setShowMine(value => !value)}>내 자료</Button>
      </div>
      {availableTags.length > 0 && <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setSelectedTag(null)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${!selectedTag ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>전체</button>
        {availableTags.map(tag => <button key={tag} type="button" onClick={() => setSelectedTag(selectedTag === tag ? null : tag)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${selectedTag === tag ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>#{tag}</button>)}
      </div>}
    </div>

    {loading && !materials.length ? <div className="py-16 text-center text-sm text-muted-foreground">자료를 불러오는 중…</div> :
      visible.length ? <div className="grid gap-3 sm:grid-cols-2">
        {visible.map(material => <article key={material.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><FileText className="size-5" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-bold" title={material.title}>{material.title}</h2>
              <p className="mt-1 truncate text-xs text-muted-foreground" title={material.file_name}>{material.file_name} · {fileSize(material.size_bytes)}</p>
            </div>
          </div>
          <div className="flex min-h-6 flex-wrap items-center gap-1.5">
            {material.tags.map(tag => <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">#{tag}</span>)}
          </div>
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <span className="text-xs text-muted-foreground">{new Date(material.created_at).toLocaleDateString('ko-KR')}{material.uploader_id === user?.id ? ' · 내 자료' : ''}</span>
            <div className="flex gap-1">
              {material.uploader_id === user?.id && <Button variant="ghost" size="icon-sm" disabled={busyId === material.id} aria-label={`${material.title} 삭제`} onClick={() => void remove(material)}><Trash2 className="size-4" /></Button>}
              <Button variant="outline" size="sm" className="gap-1.5" disabled={busyId === material.id} onClick={() => void download(material)}>
                {busyId === material.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}받기
              </Button>
            </div>
          </div>
        </article>)}
      </div> : <div className="rounded-2xl border bg-card px-4 py-16 text-center text-sm text-muted-foreground">{materials.length ? '검색 결과가 없습니다.' : '아직 공유된 자료가 없습니다.'}</div>}
    {hasMore && <div className="text-center"><Button variant="outline" disabled={loading} onClick={() => void load(materials.length)}>자료 더 보기</Button></div>}

    <Dialog open={uploadOpen} onOpenChange={open => { if (!uploading) setUploadOpen(open); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>자료 올리기</DialogTitle><DialogDescription>제목과 태그를 적으면 다른 학생이 자료를 쉽게 찾을 수 있어요.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-1.5 text-sm font-semibold"><span>제목</span><Input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="예: 물리학 실험 보고서 양식" className="h-10 bg-background" /></label>
          <div className="space-y-1.5 text-sm font-semibold">
            <label htmlFor="material-tag-input">태그</label>
            <div className="flex gap-2"><Input id="material-tag-input" value={tagInput} onChange={event => setTagInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag(); } }} placeholder="태그 입력 후 Enter" className="h-10 bg-background" /><Button variant="outline" type="button" onClick={addTag}><Tag className="size-4" />추가</Button></div>
            {tags.length > 0 && <div className="flex flex-wrap gap-2 pt-1">{tags.map(tag => <button key={tag} type="button" onClick={() => setTags(previous => previous.filter(value => value !== tag))} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">#{tag}<X className="size-3" /></button>)}</div>}
          </div>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/30 px-4 py-6 text-center hover:bg-muted/50" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); setFile(event.dataTransfer.files[0] ?? null); }}>
            <UploadCloud className="size-6 text-primary" /><span className="text-sm font-semibold">{file ? file.name : '파일을 선택하거나 여기에 놓으세요'}</span>
            <span className="text-xs text-muted-foreground">파일 1개 · 최대 200MB{file ? ` · ${fileSize(file.size)}` : ''}</span>
            <input ref={fileInput} type="file" className="sr-only" onChange={event => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <Button className="w-full gap-2" disabled={uploading || !title.trim() || !file} onClick={() => void upload()}>{uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}{uploading ? '올리는 중…' : '자료 공유하기'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </main>;
}

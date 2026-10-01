'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, File as FileIcon, FileArchive, FileImage, FileText, FolderOpen, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmDialog from '@/components/ConfirmDialog';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import { getNativeBridge } from '@/lib/nativeBridge';
import { MATERIALS_API_BASE as API_BASE, formatBytes as fileSize, materialsToken as sessionToken } from '@/lib/materialsApi';

const PAGE_SIZE = 40;

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

function fileIcon(material: Pick<Material, 'file_name' | 'content_type'>) {
  const type = material.content_type;
  const ext = material.file_name.split('.').pop()?.toLowerCase() ?? '';
  if (type.startsWith('image/')) return FileImage;
  if (/zip|compressed|tar|rar|7z/.test(type) || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FileArchive;
  if (type === 'application/pdf' || type.startsWith('text/') || ['pdf', 'doc', 'docx', 'hwp', 'hwpx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md'].includes(ext)) return FileText;
  return FileIcon;
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
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);

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
      (tab !== 'mine' || material.uploader_id === user?.id) &&
      (!selectedTag || material.tags.includes(selectedTag)) &&
      (!needle || `${material.title} ${material.file_name} ${material.tags.join(' ')}`.toLocaleLowerCase().includes(needle))
    );
  }, [materials, query, selectedTag, tab, user?.id]);
  const availableTags = useMemo(() => [...new Set(materials.flatMap(material => material.tags))].sort(), [materials]);

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
    setDeleteTarget(null);
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

  const filtering = Boolean(query.trim() || selectedTag || tab === 'mine');

  return <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-black uppercase tracking-tighter italic">자료 공유</h1>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">파일 · 제목 · 태그</p>
      </div>
      <Button asChild size="sm" className="shrink-0 gap-1.5 font-black text-xs active:scale-95">
        <Link href="/materials/new"><Plus className="size-3.5" />새 자료</Link>
      </Button>
    </div>

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SegmentedTabs items={[{ value: 'all', label: '공유됨' }, { value: 'mine', label: '내 자료' }]} value={tab} onChange={value => setTab(value as 'all' | 'mine')} />
      <div className="relative sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="제목, 파일명, 태그 검색" aria-label="자료 검색" className="h-9 pl-9 pr-8" />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="검색어 지우기" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>}
      </div>
    </div>

    {availableTags.length > 0 && <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 segmented-tabs" role="group" aria-label="태그 필터">
      {[null, ...availableTags].map(tag => {
        const active = selectedTag === tag;
        return <button key={tag ?? '__all'} type="button" aria-pressed={active} onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black transition-colors ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
          {tag ? `#${tag}` : '전체'}
        </button>;
      })}
    </div>}

    {loading && !materials.length ? <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="자료를 불러오는 중">
      {[0, 1, 2, 3].map(index => <div key={index} className="h-[132px] animate-pulse rounded-2xl border border-border/50 bg-card" />)}
    </div> :
      visible.length ? <div className="grid gap-3 sm:grid-cols-2">
        {visible.map(material => {
          const Icon = fileIcon(material);
          const mine = material.uploader_id === user?.id;
          const busy = busyId === material.id;
          return <article key={material.id} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-border">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-black leading-tight" title={material.title}>{material.title}</h2>
                <p className="mt-1 truncate text-xs text-muted-foreground" title={material.file_name}>{material.file_name}</p>
              </div>
              {mine && <button type="button" disabled={busy} aria-label={`${material.title} 삭제`} onClick={() => setDeleteTarget(material)}
                className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                <Trash2 className="size-4" />
              </button>}
            </div>
            <div className="flex min-h-5 flex-wrap items-center gap-1.5">
              {material.tags.slice(0, 3).map(tag => <Badge key={tag} className="normal-case tracking-normal">#{tag}</Badge>)}
              {material.tags.length > 3 && <span className="text-[10px] font-bold text-muted-foreground">+{material.tags.length - 3}</span>}
            </div>
            <div className="mt-auto flex items-center justify-between gap-3">
              <span className="text-[11px] text-muted-foreground">{fileSize(material.size_bytes)} · {new Date(material.created_at).toLocaleDateString('ko-KR')}</span>
              <Button variant="outline" size="sm" className="gap-1.5 font-black text-xs" disabled={busy} onClick={() => void download(material)}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}받기
              </Button>
            </div>
          </article>;
        })}
      </div> : <div className="rounded-3xl border-2 border-dashed bg-muted/10 px-4 py-16 text-center text-muted-foreground">
        <FolderOpen className="mx-auto mb-4 size-12 opacity-20" />
        <p className="text-sm font-black">{filtering ? '조건에 맞는 자료가 없어요' : '아직 공유된 자료가 없어요'}</p>
        {filtering
          ? <Button variant="ghost" size="sm" className="mt-3 text-xs font-bold" onClick={() => { setQuery(''); setSelectedTag(null); setTab('all'); }}>필터 초기화</Button>
          : <Button asChild size="sm" className="mt-4 gap-1.5 font-black text-xs"><Link href="/materials/new"><Plus className="size-3.5" />첫 자료 올리기</Link></Button>}
      </div>}

    {hasMore && <div className="text-center"><Button variant="outline" disabled={loading} onClick={() => void load(materials.length)}>{loading && <Loader2 className="size-4 animate-spin" />}자료 더 보기</Button></div>}

    <ConfirmDialog open={Boolean(deleteTarget)} title="자료를 삭제할까요?" description={deleteTarget ? `“${deleteTarget.title}”을(를) 삭제하면 다른 사람도 더 이상 받을 수 없어요.` : ''}
      onCancel={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) void remove(deleteTarget); }} />
  </main>;
}

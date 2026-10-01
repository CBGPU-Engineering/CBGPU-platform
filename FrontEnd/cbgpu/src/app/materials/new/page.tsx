'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Loader2, Tag, UploadCloud, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import { MATERIALS_API_BASE as API_BASE, fetchMaterialsJson, formatBytes as fileSize, type MaterialsQuota } from '@/lib/materialsApi';

const MAX_BYTES = 1024 * 1024 * 1024;
const cardClass = 'space-y-5 rounded-2xl border border-border/60 bg-card p-5 sm:p-6';
const labelClass = 'mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground';

function putFile(url: string, token: string, file: File, onProgress: (ratio: number) => void) {
  // fetch cannot report upload progress, so use XHR for the (potentially 1GB) file body.
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { resolve(); return; }
      if (xhr.status === 507) { reject(new Error('자료 공유 저장 공간이 가득 찼습니다. 관리자에게 문의해 주세요.')); return; }
      let detail: unknown;
      try { detail = JSON.parse(xhr.responseText)?.detail; } catch { /* non-JSON error body */ }
      reject(new Error(typeof detail === 'string' ? detail : `파일 서버 오류 (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('파일 서버에 연결하지 못했습니다.'));
    xhr.onabort = () => reject(new Error('업로드가 취소됐습니다.'));
    xhr.send(file);
  });
}

export default function NewMaterialPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);

  function addTag() {
    const value = tagInput.trim().replace(/^#/, '');
    if (!value) return;
    if (value.length > 20) { showError('태그는 20자까지 입력할 수 있습니다.'); return; }
    if (tags.length >= 8 && !tags.includes(value)) { showError('태그는 최대 8개까지 추가할 수 있습니다.'); return; }
    if (!tags.includes(value)) setTags(previous => [...previous, value]);
    setTagInput('');
  }

  async function upload() {
    if (!user || !file) { showError('파일을 선택해 주세요.'); return; }
    if (!title.trim()) { showError('제목을 입력해 주세요.'); return; }
    if (title.trim().length > 120) { showError('제목은 120자까지 입력할 수 있습니다.'); return; }
    if (!file.size || file.size > MAX_BYTES) { showError('파일은 1GB 이하로 선택해 주세요.'); return; }
    if (!API_BASE) { showError('파일 서버 주소가 설정되지 않았습니다.'); return; }
    setUploading(true);
    setProgress(0);
    let materialId: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');
      // 서버 저장 공간이 부족하면 서버가 본문을 읽기 전에 거절해 브라우저에는 연결 오류로만 보인다. 미리 확인해 이유를 알려준다.
      const quota = await fetchMaterialsJson<MaterialsQuota>('/materials/quota').catch(() => null);
      if (quota && file.size > quota.remaining_bytes) {
        throw new Error(`자료 공유 저장 공간이 부족합니다. (남은 공간 ${fileSize(quota.remaining_bytes)}) 관리자에게 문의해 주세요.`);
      }
      const { data, error } = await supabase.from('shared_materials').insert({
        uploader_id: user.id, title: title.trim(), tags, file_name: file.name.slice(0, 255),
        content_type: file.type || 'application/octet-stream', size_bytes: file.size, status: 'pending',
      }).select('id').single();
      if (error) throw error;
      materialId = data.id;
      await putFile(`${API_BASE}/materials/${materialId}/content`, session.access_token, file, setProgress);
      showSuccess('자료가 공유됐습니다.');
      router.push('/materials');
    } catch (error) {
      if (materialId) {
        // The server may finish an upload even if the response is lost.
        const { data } = await supabase.from('shared_materials').select('status').eq('id', materialId).maybeSingle();
        if (data?.status === 'ready') {
          showSuccess('자료가 공유됐습니다.');
          router.push('/materials');
          return;
        }
        await supabase.from('shared_materials').delete().eq('id', materialId);
      }
      showError(error instanceof Error ? error.message : '자료를 올리지 못했습니다.');
    } finally {
      setUploading(false);
    }
  }

  return <main className="mx-auto max-w-2xl space-y-8 px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => router.push('/materials')} disabled={uploading} aria-label="자료 공유로 돌아가기" className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground transition-all hover:border-border hover:text-foreground disabled:opacity-50">
        <ArrowLeft className="size-4" />
      </button>
      <div>
        <h1 className="text-3xl font-black uppercase italic tracking-tighter">자료 올리기</h1>
        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">파일 · 제목 · 태그</p>
      </div>
    </div>

    <form className="space-y-5" onSubmit={event => { event.preventDefault(); void upload(); }}>
      <section className={cardClass}>
        <div>
          <label htmlFor="material-title" className={`${labelClass} flex justify-between`}><span>제목 *</span><span className="font-bold normal-case tracking-normal">{title.length}/120</span></label>
          <Input id="material-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="예: 물리학 실험 보고서 양식" className="h-10" />
        </div>
        <div>
          <label htmlFor="material-tag-input" className={labelClass}>태그</label>
          <div className="flex gap-2">
            <Input id="material-tag-input" value={tagInput} onChange={event => setTagInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag(); } }} placeholder="태그 입력 후 Enter" className="h-10" />
            <Button variant="outline" type="button" className="gap-1.5" onClick={addTag}><Tag className="size-4" />추가</Button>
          </div>
          {tags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{tags.map(tag => <button key={tag} type="button" onClick={() => setTags(previous => previous.filter(value => value !== tag))} aria-label={`태그 ${tag} 제거`} className="rounded-full"><Badge className="normal-case tracking-normal text-xs px-2.5 py-1">#{tag}<X className="size-3" /></Badge></button>)}</div>}
          <p className="mt-2 text-xs text-muted-foreground">{tags.length}/8개 · 태그를 누르면 제거됩니다.</p>
        </div>
      </section>

      <section className={cardClass}>
        <div>
          <h2 className={labelClass}>파일 *</h2>
          {file ? <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="size-5" /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{file.name}</p><p className="text-xs text-muted-foreground">{fileSize(file.size)}{file.size > MAX_BYTES ? ' · 1GB를 넘어요' : ''}</p></div>
            <button type="button" disabled={uploading} onClick={() => setFile(null)} aria-label="선택한 파일 제거" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"><X className="size-4" /></button>
          </div> : <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-9 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border/40 hover:border-border/80 hover:bg-muted/10'}`}
            onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); setFile(event.dataTransfer.files[0] ?? null); }}>
            <UploadCloud className={`size-7 ${dragging ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-sm font-bold">클릭해서 파일 선택하거나 여기에 놓으세요</span>
            <span className="text-xs text-muted-foreground">파일 1개 · 최대 1GB</span>
            <input type="file" disabled={uploading} className="hidden" onChange={event => { setFile(event.target.files?.[0] ?? null); event.target.value = ''; }} />
          </label>}
        </div>
      </section>

      {uploading && <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="space-y-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        <p className="text-right text-xs text-muted-foreground">{progress >= 1 ? '서버에서 마무리하는 중…' : `${Math.round(progress * 100)}% · ${fileSize(file?.size ?? 0)}`}</p>
      </div>}

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="h-11 flex-1 font-bold" disabled={uploading} onClick={() => router.push('/materials')}>취소</Button>
        <Button type="submit" className="h-11 flex-1 gap-2 font-bold" disabled={uploading || !title.trim() || !file}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}{uploading ? `올리는 중 ${Math.round(progress * 100)}%` : '자료 공유하기'}
        </Button>
      </div>
    </form>
  </main>;
}

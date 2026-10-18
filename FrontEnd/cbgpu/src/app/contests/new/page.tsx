'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { ContestField, ContestFieldType, FIELD_LABELS, MAX_FIELDS, contestError, deadlineToISO } from '@/lib/contests';
import { useContestClock } from '@/components/contests/ContestClock';

const newField = (type: ContestFieldType): ContestField => ({ id: crypto.randomUUID(), type, label: '', description: '', required: true, extensions: '', max_size_mb: 10 });
const textareaClass = 'w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function NewContestPage() {
  const { user } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();
  const { now } = useContestClock();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [fields, setFields] = useState<ContestField[]>([]);
  const [busy, setBusy] = useState(false);
  const update = (id: string, patch: Partial<ContestField>) => setFields(prev => prev.map(field => field.id === id ? { ...field, ...patch } : field));
  const move = (index: number, direction: number) => setFields(prev => {
    const next = [...prev];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    return next;
  });

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    if (!title.trim()) return showError('대회 이름을 입력해 주세요.');
    if (!fields.length || fields.some(field => !field.label.trim())) return showError('이름이 있는 제출 항목을 하나 이상 추가해 주세요.');
    if (now === null) return showError('서버 시각을 확인하고 있어요. 잠시 후 다시 시도해 주세요.');
    const endsAt = deadlineToISO(deadline);
    if (endsAt && new Date(endsAt).getTime() <= now) return showError('마감은 현재 서버 시각 이후로 지정해 주세요.');
    const cleanFields = fields.map(field => ({ ...field, label: field.label.trim(), description: field.description.trim(), extensions: field.extensions.toLowerCase().split(',').map(ext => ext.trim()).filter(Boolean).join(',') }));
    if (cleanFields.some(field => field.type === 'file' && (field.max_size_mb < 1 || field.max_size_mb > 50 || !Number.isInteger(field.max_size_mb) || (field.extensions && !/^\.[a-z0-9]+(?:\.[a-z0-9]+)*(,\.[a-z0-9]+(?:\.[a-z0-9]+)*)*$/.test(field.extensions))))) return showError('파일 크기는 1~50MB, 확장자는 .ppt,.pptx처럼 입력해 주세요.');
    setBusy(true);
    try {
      const { data, error } = await supabase.from('contests').insert({ host_id: user.id, title: title.trim(), description: description.trim(), ends_at: endsAt, fields: cleanFields }).select('id').single();
      if (error) throw error;
      showSuccess('대회를 만들었어요. 제출 링크를 공유해 보세요!');
      router.push(`/contests/${data.id}`);
    } catch (error) { showError(contestError(error)); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/contests" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />대회 목록</Link>
      <header><h1 className="text-3xl font-black">대회 만들기</h1><p className="mt-2 text-sm text-muted-foreground">참가자에게 받을 항목을 구성한 뒤 제출 링크를 공유하세요.</p></header>
      <form onSubmit={create} className="space-y-6">
        <fieldset disabled={busy} className="space-y-6">
          <section className="space-y-5 rounded-3xl border bg-card p-6">
            <label className="block space-y-2 text-sm font-bold"><span>대회 이름</span><Input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 교내 창의융합 탐구대회" /></label>
            <label className="block space-y-2 text-sm font-bold"><span>대회 안내</span><textarea className={textareaClass} rows={4} maxLength={10000} value={description} onChange={e => setDescription(e.target.value)} placeholder="참가 대상, 제출 방법, 유의사항 등을 안내해 주세요." /></label>
            <label className="block space-y-2 text-sm font-bold"><span>제출 마감일·시간 (한국 시간)</span><Input type="datetime-local" step="1" value={deadline} onChange={e => setDeadline(e.target.value)} /><span className="block text-xs font-normal text-muted-foreground">초 단위까지 지정할 수 있어요. 비워두면 마감 제한 없이 접수해요.</span></label>
          </section>
          <section className="space-y-4">
            <div><h2 className="text-lg font-bold">제출 항목 <span className="text-muted-foreground">{fields.length}/{MAX_FIELDS}</span></h2><p className="mt-1 text-xs text-muted-foreground">생성 후에는 항목이 고정돼요. 마감 시간과 접수 상태는 변경할 수 있어요.</p></div>
            {!fields.length && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">아래에서 파일, 링크, 텍스트 항목을 추가해 주세요.</div>}
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-4 rounded-3xl border bg-card p-5">
                <div className="flex items-center justify-between"><span className="text-sm font-bold">{index + 1}. {FIELD_LABELS[field.type]}</span><div className="flex gap-1"><Button type="button" size="icon" variant="ghost" disabled={index === 0} aria-label="항목 위로" onClick={() => move(index, -1)}><ArrowUp /></Button><Button type="button" size="icon" variant="ghost" disabled={index === fields.length - 1} aria-label="항목 아래로" onClick={() => move(index, 1)}><ArrowDown /></Button><Button type="button" size="icon" variant="ghost" aria-label="항목 삭제" onClick={() => setFields(prev => prev.filter(f => f.id !== field.id))}><Trash2 /></Button></div></div>
                <label className="block space-y-2 text-sm"><span>항목 이름</span><Input required maxLength={200} value={field.label} onChange={e => update(field.id, { label: e.target.value })} placeholder={field.type === 'file' ? '예: 최종 보고서' : field.type === 'link' ? '예: 시연 영상 링크' : '예: 작품 소개'} /></label>
                <label className="block space-y-2 text-sm"><span>설명</span><Input maxLength={1000} value={field.description} onChange={e => update(field.id, { description: e.target.value })} placeholder="참가자가 알아야 할 내용을 적어주세요." /></label>
                {field.type === 'file' && <div className="space-y-3"><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm"><span>이 항목의 허용 확장자</span><Input value={field.extensions} onChange={e => update(field.id, { extensions: e.target.value })} placeholder="예: .ppt,.pptx" maxLength={200} /></label><label className="space-y-2 text-sm"><span>최대 파일 크기 (MB)</span><Input type="number" min="1" max="50" step="1" required value={field.max_size_mb} onChange={e => update(field.id, { max_size_mb: Number(e.target.value) })} /></label></div><p className="text-xs leading-relaxed text-muted-foreground">원하는 확장자를 쉼표로 구분해 직접 입력하세요. 발표 자료는 .ppt,.pptx / 보고서는 .pdf,.hwp,.hwpx,.docx / 소스 코드는 .zip,.py 등 항목마다 다르게 지정할 수 있어요. 비우면 모든 확장자를 허용해요.</p></div>}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.required} onChange={e => update(field.id, { required: e.target.checked })} />필수 제출</label>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">{(Object.keys(FIELD_LABELS) as ContestFieldType[]).map(type => <Button type="button" key={type} variant="outline" disabled={fields.length >= MAX_FIELDS} onClick={() => setFields(prev => [...prev, newField(type)])}><Plus />{FIELD_LABELS[type]} 추가</Button>)}</div>
          </section>
          <Button type="submit" disabled={!fields.length || now === null} className="w-full" size="lg">{busy ? '대회를 만들고 있어요…' : '대회 생성하고 제출 링크 받기'}</Button>
        </fieldset>
      </form>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Copy, Download, RefreshCw, Send, Users, FileUp, ShieldCheck, Layers3, FileText, Link2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/spinner';
import ContestClock, { useContestClock } from '@/components/contests/ContestClock';
import { ContestLogo } from '@/components/contests/ContestLogo';
import ContestLogoEditor from '@/components/contests/ContestLogoEditor';
import EventHub from '@/components/contests/EventHub';
import {
  Contest, ContestAnswers, ContestSubmission, SubmittedFile, CONTEST_BUCKET, FIELD_LABELS,
  contestClosed, contestError, deadlineToISO, deadlineToInput, fileError,
  formatContestDate, isHttpUrl, validateAnswers,
} from '@/lib/contests';

async function downloadFile(file: SubmittedFile) {
  const { data, error } = await supabase.storage.from(CONTEST_BUCKET).download(file.path);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function FileDownload({ file }: { file: SubmittedFile }) {
  const [busy, setBusy] = useState(false);
  const { showError } = useAlert();
  return <Button type="button" variant="outline" disabled={busy} className="max-w-full" onClick={async () => {
    setBusy(true);
    try { await downloadFile(file); } catch (error) { showError(contestError(error)); }
    finally { setBusy(false); }
  }}><Download /><span className="truncate">{busy ? '다운로드 중…' : file.name}</span></Button>;
}

function SubmissionForm({ contest, submission, closed, clockReady, onSaved }: {
  contest: Contest; submission: ContestSubmission | null; closed: boolean; clockReady: boolean;
  onSaved: (submission: ContestSubmission) => void;
}) {
  const { user, profile } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [name, setName] = useState(submission?.participant_name || profile?.full_name || '');
  const [studentId, setStudentId] = useState(submission?.student_id || profile?.student_id || '');
  const [answers, setAnswers] = useState<ContestAnswers>(submission?.answers || {});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const submitting = useRef(false);
  const update = (id: string, value: string) => setAnswers(prev => ({ ...prev, [id]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user || submitting.current || closed || !clockReady) return;
    if (!name.trim()) return showError('제출자 이름 또는 팀명을 입력해 주세요.');
    const validation = validateAnswers(contest.fields, answers, files);
    if (validation) return showError(validation);
    submitting.current = true;
    setBusy(true);
    const uploaded: string[] = [];
    try {
      const nextAnswers: ContestAnswers = {};
      for (const field of contest.fields) {
        if (field.type !== 'file') {
          nextAnswers[field.id] = typeof answers[field.id] === 'string' ? (answers[field.id] as string).trim() : '';
          continue;
        }
        const file = files[field.id];
        if (!file) {
          if (typeof answers[field.id] === 'object') nextAnswers[field.id] = answers[field.id];
          continue;
        }
        setProgress(`${field.label} 업로드 중…`);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'file';
        const path = `${contest.id}/${user.id}/${field.id}/${crypto.randomUUID()}_${safeName}`;
        const { error } = await supabase.storage.from(CONTEST_BUCKET).upload(path, file, { upsert: false });
        if (error) throw error;
        uploaded.push(path);
        nextAnswers[field.id] = { path, name: file.name, size: file.size };
      }
      setProgress('제출 내용 저장 중…');
      const { data, error } = await supabase.from('contest_submissions').upsert({
        contest_id: contest.id, user_id: user.id, participant_name: name.trim(), student_id: String(studentId).trim(), answers: nextAnswers,
      }, { onConflict: 'contest_id,user_id' }).select('*').single();
      if (error) throw error;
      // Each submission is committed atomically. Failed cleanup cannot remove referenced files under RLS.
      const replaced = Object.values(submission?.answers || {}).filter((value): value is SubmittedFile => typeof value === 'object')
        .filter(old => !Object.values(nextAnswers).some(value => typeof value === 'object' && value.path === old.path)).map(file => file.path);
      if (replaced.length) {
        const { error: cleanupError } = await supabase.storage.from(CONTEST_BUCKET).remove(replaced);
        if (cleanupError) console.error('Contest file cleanup:', cleanupError.message);
      }
      showSuccess(submission ? '제출 내용을 수정했어요.' : '제출을 완료했어요!');
      onSaved(data);
    } catch (error) {
      if (uploaded.length) await supabase.storage.from(CONTEST_BUCKET).remove(uploaded).catch(() => {});
      showError(contestError(error));
    } finally { submitting.current = false; setBusy(false); setProgress(''); }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {submission && <div role="status" className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><p className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="size-5" />제출 완료</p><p className="mt-1 text-xs text-muted-foreground">마지막 제출: {formatContestDate(submission.submitted_at)}</p><p className="mt-2 text-sm">마감 전까지 내용을 수정할 수 있어요. 수정한 내용은 다시 제출해야 저장돼요.</p></div>}
      <fieldset disabled={closed || busy || !clockReady} className="space-y-5">
        <section className="contest-panel">
          <div className="contest-panel-heading"><span className="contest-step"><Users className="size-4" /></span><div><h2 className="font-bold">참가자 정보</h2><p className="mt-1 text-xs text-muted-foreground">제출물을 확인할 수 있도록 알려주세요.</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-bold"><span>제출자 이름 / 팀명 <span className="text-destructive">*</span></span><Input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
          <label className="space-y-2 text-sm font-bold"><span>학번 (선택)</span><Input maxLength={30} value={studentId} onChange={e => setStudentId(e.target.value)} /></label>
          </div>
        </section>
        {contest.fields.map((field, index) => {
          const value = answers[field.id];
          return <section key={field.id} className="contest-field-card space-y-4">
            <div className="flex items-center gap-3"><span className="contest-step">{String(index + 1).padStart(2, '0')}</span><label htmlFor={`answer-${field.id}`} className="block font-bold">{field.label} {field.required ? <span className="ml-1 rounded-md bg-primary/5 px-2 py-1 text-[10px] font-semibold text-primary">필수</span> : <span className="ml-1 text-xs font-normal text-muted-foreground">선택</span>}</label></div>
            <p className="text-xs text-muted-foreground">{FIELD_LABELS[field.type]}{field.type === 'file' ? ` · 파일 1개, 최대 ${field.max_size_mb}MB · ${field.extensions || '모든 확장자'}` : ''}</p>
            {field.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{field.description}</p>}
            {field.type === 'text' ? <textarea id={`answer-${field.id}`} required={field.required} maxLength={10000} rows={5} value={typeof value === 'string' ? value : ''} onChange={e => update(field.id, e.target.value)} className="w-full rounded-xl border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="내용을 입력해 주세요." /> : field.type === 'link' ? <Input id={`answer-${field.id}`} type="url" required={field.required} maxLength={2000} placeholder="https://" value={typeof value === 'string' ? value : ''} onChange={e => update(field.id, e.target.value)} /> : <div className="space-y-3">
              {typeof value === 'object' && <p className="break-words text-sm">현재 파일: {value.name}</p>}
              <div className="contest-file-zone"><FileUp className="mb-1 size-7 text-primary" strokeWidth={1.5} /><span className="max-w-full break-all text-sm font-semibold">{files[field.id]?.name || '클릭하거나 파일을 끌어 놓으세요'}</span><span className="text-xs text-muted-foreground">{field.extensions || '모든 파일 형식'} · 최대 {field.max_size_mb}MB</span><Input id={`answer-${field.id}`} aria-label={`${field.label} 파일 선택`} type="file" accept={field.extensions || undefined} required={field.required && !value} onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const error = fileError(file, field);
                  if (error) { showError(error); e.target.value = ''; setFiles(prev => { const next = { ...prev }; delete next[field.id]; return next; }); return; }
                }
                setFiles(prev => { const next = { ...prev }; if (file) next[field.id] = file; else delete next[field.id]; return next; });
              }} /></div>
              {files[field.id] && <p className="text-xs text-primary">새 파일: {files[field.id].name} · 다시 제출하면 교체돼요.</p>}
              {!field.required && (value || files[field.id]) && <Button type="button" variant="ghost" onClick={() => {
                setAnswers(prev => { const next = { ...prev }; delete next[field.id]; return next; });
                setFiles(prev => { const next = { ...prev }; delete next[field.id]; return next; });
                const input = document.getElementById(`answer-${field.id}`) as HTMLInputElement | null;
                if (input) input.value = '';
              }}>파일 제외하기</Button>}
            </div>}
          </section>;
        })}
        <p className="text-xs text-muted-foreground">제출 내용은 본인과 대회 호스트만 볼 수 있어요. 계정당 한 건을 제출하며 재제출하면 기존 내용이 갱신돼요.</p>
        <Button type="submit" size="lg" className="w-full"><Send />{busy ? progress || '제출 중…' : closed ? '제출이 마감되었어요' : !clockReady ? '서버 시각 확인 중…' : submission ? '수정 내용 다시 제출하기' : '작품 제출하기'}</Button>
      </fieldset>
      {submission && <section className="space-y-3"><h2 className="font-bold">저장된 제출 파일</h2>{Object.values(submission.answers).filter((value): value is SubmittedFile => typeof value === 'object').map(file => <div key={file.path}><FileDownload file={file} /></div>)}</section>}
    </form>
  );
}

function HostPanel({ contest, submissions, onUpdated, refresh, now }: {
  contest: Contest; submissions: ContestSubmission[]; onUpdated: (contest: Contest) => void; refresh: () => Promise<void>; now: number | null;
}) {
  const [deadline, setDeadline] = useState(deadlineToInput(contest.ends_at));
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const { showError, showSuccess } = useAlert();
  useEffect(() => { setShareUrl(window.location.href.split('?')[0].split('#')[0]); }, []);

  async function update(patch: { is_open?: boolean; ends_at?: string | null }) {
    if (busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from('contests').update(patch).eq('id', contest.id).select('*').single();
      if (error) throw error;
      onUpdated(data);
      showSuccess('접수 설정을 변경했어요.');
    } catch (error) { showError(contestError(error)); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <section className="contest-panel space-y-4"><div><p className="contest-eyebrow mb-2 text-primary">INVITE PARTICIPANTS</p><h2 className="text-lg font-bold">참가 링크 공유</h2></div><p className="text-sm text-muted-foreground">이 링크 하나로 참가 신청, 행사 안내와 작품 제출을 받아보세요.</p><div className="flex flex-wrap gap-2"><Input aria-label="참가 링크" className="min-w-0 flex-1" readOnly value={shareUrl} onFocus={e => e.target.select()} /><Button onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); showSuccess('참가 링크를 복사했어요.'); } catch { showError('링크를 선택한 뒤 직접 복사해 주세요.'); } }}><Copy />복사</Button></div></section>
    <ContestLogoEditor contest={contest} onUpdated={onUpdated} />
    <section className="contest-panel space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="contest-eyebrow mb-2 text-primary">RECEPTION</p><h2 className="text-lg font-bold">접수 관리</h2></div><Button variant="outline" disabled={busy} onClick={() => void update({ is_open: !contest.is_open })}>{contest.is_open ? '접수 중지하기' : '접수 재개하기'}</Button></div>
      <form onSubmit={event => {
        event.preventDefault();
        const endsAt = deadlineToISO(deadline);
        if (now === null) return showError('서버 시각 확인 후 다시 시도해 주세요.');
        if (endsAt && new Date(endsAt).getTime() <= now) return showError('새 마감 시간은 현재 서버 시각 이후로 지정해 주세요.');
        void update({ ends_at: endsAt });
      }} className="space-y-3"><label className="block space-y-2 text-sm font-bold"><span>마감일·시간 (한국 시간, 초 단위)</span><Input type="datetime-local" step="1" value={deadline} onChange={e => setDeadline(e.target.value)} disabled={busy} /></label><p className="text-xs text-muted-foreground">비워서 저장하면 마감 제한이 없어져요. 접수 중지 상태라면 접수도 재개해 주세요.</p><Button type="submit" variant="outline" disabled={busy || now === null}>마감 시간 저장</Button></form>
    </section>
    <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-bold"><Users className="size-5" />받은 제출물 {submissions.length}건</h2><Button variant="ghost" disabled={busy} onClick={async () => { setBusy(true); try { await refresh(); } finally { setBusy(false); } }}><RefreshCw />새로고침</Button></div>
      {!submissions.length ? <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-muted-foreground">아직 작품 제출물이 없어요. 참가자에게 참가 링크를 공유해 주세요.</div> : submissions.map(submission => <details key={submission.user_id} className="rounded-3xl border bg-card p-5"><summary className="cursor-pointer break-words font-bold">{submission.participant_name}{submission.student_id ? ` · ${submission.student_id}` : ''}<span className="mt-1 block text-xs font-normal text-muted-foreground">최종 제출 {formatContestDate(submission.submitted_at)}</span></summary><div className="mt-5 space-y-5 border-t pt-5">{contest.fields.map(field => {
        const value = submission.answers[field.id];
        return <div key={field.id} className="space-y-2"><h3 className="text-sm font-bold">{field.label}</h3>{!value ? <p className="text-sm text-muted-foreground">미제출</p> : typeof value === 'object' ? <FileDownload file={value} /> : field.type === 'link' && isHttpUrl(value) ? <a href={value} target="_blank" rel="noopener noreferrer" className="block break-all text-sm text-primary underline underline-offset-4">{value}</a> : <p className="whitespace-pre-wrap break-words text-sm">{value}</p>}</div>;
      })}</div></details>)}
    </section>
  </div>;
}

export default function ContestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [contest, setContest] = useState<Contest | null>(null);
  const [submissions, setSubmissions] = useState<ContestSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { now, syncError } = useContestClock();
  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
      const { data, error } = await supabase.from('contests').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('대회를 찾을 수 없어요. 공유받은 링크를 확인해 주세요.');
      let query = supabase.from('contest_submissions').select('*').eq('contest_id', id).order('submitted_at', { ascending: false });
      if (data.host_id !== user.id) query = query.eq('user_id', user.id);
      const { data: entries, error: entriesError } = await query;
      if (entriesError) throw entriesError;
      setContest(data);
      setSubmissions(entries || []);
    } catch (error) { setError(contestError(error)); }
    finally { setLoading(false); }
  }, [id, user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!user) return;
    let disposed = false;
    const refreshSettings = async () => {
      const { data, error } = await supabase.from('contests').select('*').eq('id', id).maybeSingle();
      if (!disposed && !error && data) setContest(data);
    };
    const interval = setInterval(() => void refreshSettings(), 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshSettings(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { disposed = true; clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [id, user]);
  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  if (error || !contest) return <div className="mx-auto max-w-2xl space-y-4 rounded-3xl border p-8"><p role="alert">{error || '대회를 찾을 수 없어요.'}</p><Button variant="outline" onClick={() => void load()}>다시 불러오기</Button><Button asChild variant="ghost"><Link href="/contests">대회 목록</Link></Button></div>;
  const isHost = contest.host_id === user?.id;
  const ownSubmission = submissions.find(entry => entry.user_id === user?.id) || null;
  return <div className="contest-page mx-auto max-w-6xl space-y-7">
    <Link href="/contests" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />대회 목록</Link>
    <header className="contest-hero"><div className="flex flex-col gap-6 sm:flex-row sm:items-center"><ContestLogo path={contest.logo_path} title={contest.title} className="contest-logo-large" /><div className="min-w-0 flex-1"><p className="contest-eyebrow mb-3">{isHost ? '호스트 · 대회 관리' : '참가자 · 제출하기'}</p><h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{contest.title}</h1><div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-white/60"><span className="flex items-center gap-1.5"><Layers3 className="size-3.5" />제출 항목 {contest.fields.length}개</span><span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" />본인과 호스트에게만 공개</span></div></div></div>{contest.description && <p className="mt-7 max-w-2xl whitespace-pre-wrap break-words border-t border-white/10 pt-6 text-sm leading-relaxed text-white/70">{contest.description}</p>}</header>
    <div className="contest-detail-layout">
      <aside className="contest-summary space-y-4"><ContestClock endsAt={contest.ends_at} isOpen={contest.is_open} now={now} syncError={syncError} /><section className="contest-panel"><h2 className="mb-4 text-sm font-bold">제출 항목 안내</h2><ul className="space-y-4">{contest.fields.map(field => { const Icon = field.type === 'file' ? FileUp : field.type === 'link' ? Link2 : FileText; return <li key={field.id} className="flex items-start gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="break-words text-xs font-semibold">{field.label}<span className="ml-2 text-[10px] font-normal text-muted-foreground">{field.required ? '필수' : '선택'}</span></p><p className="mt-1 break-words text-[11px] text-muted-foreground">{FIELD_LABELS[field.type]}{field.type === 'file' ? ` · ${field.extensions || '모든 형식'} · ${field.max_size_mb}MB` : ''}</p></div></li>; })}</ul></section></aside>
      <div className="contest-detail-main space-y-7"><EventHub contest={contest} isHost={isHost} onContestUpdated={setContest} />{isHost ? <HostPanel contest={contest} submissions={submissions} onUpdated={setContest} refresh={load} now={now} /> : <SubmissionForm key={`${contest.id}-${ownSubmission?.submitted_at || 'new'}`} contest={contest} submission={ownSubmission} closed={now !== null && contestClosed(contest, now)} clockReady={now !== null} onSaved={entry => setSubmissions([entry])} />}</div>
    </div>
  </div>;
}

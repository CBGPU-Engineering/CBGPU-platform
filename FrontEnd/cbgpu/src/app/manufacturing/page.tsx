'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/spinner';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { PrinterVisual } from '@/components/manufacturing/PrinterVisual';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Printer, Scissors, Plus, Clock, CheckCircle2, XCircle, ShieldAlert,
  Boxes, Play, Square, ExternalLink, Download, Wrench, Undo2, X, Layers, User,
} from 'lucide-react';

type Tab = 'print' | 'laser' | 'print_manager' | 'laser_manager';

const DURATION_PRESETS = [
  { label: '1시간', hours: 1 },
  { label: '2시간', hours: 2 },
  { label: '4시간', hours: 4 },
  { label: '8시간', hours: 8 },
  { label: '12시간', hours: 12 },
  { label: '24시간', hours: 24 },
];

const PRINT_STATUS_INFO: Record<string, { variant: any; icon: React.ReactNode; label: string }> = {
  pending:   { variant: 'warning', icon: <Clock className="size-3" />,        label: '승인 대기' },
  accepted:  { variant: 'default', icon: <Boxes className="size-3" />,        label: '대기열' },
  queued:    { variant: 'default', icon: <Boxes className="size-3" />,        label: '대기열' },
  printing:  { variant: 'success', icon: <Printer className="size-3" />,      label: '프린팅 중' },
  done:      { variant: 'success', icon: <CheckCircle2 className="size-3" />, label: '완료' },
  rejected:  { variant: 'danger',  icon: <XCircle className="size-3" />,      label: '거절됨' },
  canceled:  { variant: 'muted',   icon: <XCircle className="size-3" />,      label: '취소됨' },
};

const LASER_STATUS_INFO: Record<string, { variant: any; icon: React.ReactNode; label: string }> = {
  pending:     { variant: 'warning', icon: <Clock className="size-3" />,        label: '승인 대기' },
  accepted:    { variant: 'default', icon: <Boxes className="size-3" />,        label: '대기중' },
  in_progress: { variant: 'success', icon: <Scissors className="size-3" />,     label: '작업 중' },
  done:        { variant: 'success', icon: <CheckCircle2 className="size-3" />, label: '완료' },
  rejected:    { variant: 'danger',  icon: <XCircle className="size-3" />,      label: '거절됨' },
  canceled:    { variant: 'muted',   icon: <XCircle className="size-3" />,      label: '취소됨' },
};

export default function ManufacturingPage() {
  const { user, isAdmin, is3DPrintManager, managedPrinterIds, isLaserCutManager, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('print');

  // ── 3D printing (requester) ───────────────────────────────────────────
  const [printers, setPrinters] = useState<any[]>([]);
  const [myPrintJobs, setMyPrintJobs] = useState<any[]>([]);
  const [printLoading, setPrintLoading] = useState(true);

  const fetchPrinters = async () => {
    const { data, error } = await supabase.from('printers').select('*').order('id');
    if (!error) setPrinters(data || []);
  };

  const fetchMyPrintJobs = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('print_jobs')
      .select('*, manager:manager_id(full_name, student_id)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error) setMyPrintJobs(data || []);
  };

  const [printQueueLength, setPrintQueueLength] = useState<number | null>(null);
  const fetchPrintQueueLength = async () => {
    const { data, error } = await supabase.rpc('print_queue_length');
    if (!error) setPrintQueueLength(data);
  };

  const loadPrintTab = async () => {
    setPrintLoading(true);
    await Promise.all([fetchPrinters(), fetchMyPrintJobs(), fetchPrintQueueLength()]);
    setPrintLoading(false);
  };

  // ── Laser cutting (requester) ─────────────────────────────────────────
  const [myLaserJobs, setMyLaserJobs] = useState<any[]>([]);
  const [laserLoading, setLaserLoading] = useState(true);

  const [laserQueueLength, setLaserQueueLength] = useState<number | null>(null);

  const fetchMyLaserJobs = async () => {
    if (!user) return;
    setLaserLoading(true);
    const [{ data, error }, { data: qlen, error: qlenError }] = await Promise.all([
      supabase.from('laser_jobs').select('*, manager:manager_id(full_name, student_id)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.rpc('laser_queue_length'),
    ]);
    if (!error) setMyLaserJobs(data || []);
    if (!qlenError) setLaserQueueLength(qlen);
    setLaserLoading(false);
  };

  // ── 3D manager ─────────────────────────────────────────────────────────
  const [allPrintJobs, setAllPrintJobs] = useState<any[]>([]);
  const [managerPrintLoading, setManagerPrintLoading] = useState(true);
  const [queueDialogPrinter, setQueueDialogPrinter] = useState<any | null>(null);
  const [queueJobId, setQueueJobId] = useState('');
  const [queueHours, setQueueHours] = useState(4);

  async function downloadFile(path: string) {
    const { data, error } = await supabase.storage.from('manufacturing').createSignedUrl(path, 3600);
    if (error || !data) { showError('다운로드 링크 생성 실패'); return; }
    window.open(data.signedUrl, '_blank');
  }

  const fetchAllPrintJobs = async () => {
    setManagerPrintLoading(true);
    const { data, error } = await supabase
      .from('print_jobs')
      .select('*, manager:manager_id(full_name, student_id)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error) setAllPrintJobs(data || []);
    setManagerPrintLoading(false);
  };

  const loadPrintManagerTab = async () => {
    await Promise.all([fetchPrinters(), fetchAllPrintJobs()]);
  };

  async function updatePrintJobStatus(id: string, status: string) {
    const updates: Record<string, any> = { status };
    if (status === 'done') updates.completed_at = new Date().toISOString();
    // Claim the job for whoever accepts it, if the requester didn't pick a specific manager.
    if (status === 'accepted') {
      const job = allPrintJobs.find(j => j.id === id);
      if (job && !job.manager_id && user) updates.manager_id = user.id;
    }
    const { error } = await supabase.from('print_jobs').update(updates).eq('id', id);
    if (error) showError('처리 실패: ' + error.message);
    else { showSuccess('상태가 변경됐습니다.'); fetchAllPrintJobs(); }
  }

  async function rejectPrintJob(id: string, reason: string) {
    const { error } = await supabase.from('print_jobs').update({ status: 'rejected', reject_reason: reason || null }).eq('id', id);
    if (error) showError('처리 실패: ' + error.message);
    else { showSuccess('거절 처리했습니다.'); fetchAllPrintJobs(); }
  }

  const openQueueDialog = (printer: any) => {
    setQueueDialogPrinter(printer);
    setQueueJobId('');
    setQueueHours(4);
  };

  async function startPrint() {
    if (!queueDialogPrinter || !queueJobId) { showError('작업을 선택해주세요.'); return; }
    const now = new Date();
    const end = new Date(now.getTime() + queueHours * 3600000);
    const { error: jobError } = await supabase.from('print_jobs').update({
      status: 'printing',
      printer_id: queueDialogPrinter.id,
      started_at: now.toISOString(),
      estimated_end_at: end.toISOString(),
    }).eq('id', queueJobId);
    if (jobError) { showError('작업 갱신 실패: ' + jobError.message); return; }

    const { error: printerError } = await supabase.from('printers').update({
      status: 'printing',
      current_job_id: queueJobId,
      started_at: now.toISOString(),
      estimated_end_at: end.toISOString(),
    }).eq('id', queueDialogPrinter.id);
    if (printerError) { showError('프린터 갱신 실패: ' + printerError.message); return; }

    showSuccess('인쇄를 시작했습니다.');
    setQueueDialogPrinter(null);
    loadPrintManagerTab();
  }

  async function finishPrint(printer: any) {
    if (printer.current_job_id) {
      await supabase.from('print_jobs').update({
        status: 'done',
        completed_at: new Date().toISOString(),
      }).eq('id', printer.current_job_id);
    }
    // The printer stays occupied (status 'done') until someone actually collects the part —
    // it isn't really free just because printing stopped.
    const { error } = await supabase.from('printers').update({
      status: 'done',
      estimated_end_at: null,
    }).eq('id', printer.id);
    if (error) showError('처리 실패: ' + error.message);
    else { showSuccess('인쇄 완료 처리했습니다. 회수하면 "회수함"을 눌러주세요.'); loadPrintManagerTab(); }
  }

  async function collectPrint(printer: any) {
    if (printer.current_job_id) {
      await supabase.from('print_jobs').update({ collected_at: new Date().toISOString() }).eq('id', printer.current_job_id);
    }
    const { error } = await supabase.from('printers').update({
      status: 'idle',
      current_job_id: null,
      started_at: null,
      estimated_end_at: null,
    }).eq('id', printer.id);
    if (error) showError('처리 실패: ' + error.message);
    else { showSuccess('회수 처리했습니다. 프린터가 다시 대기 상태가 됐습니다.'); loadPrintManagerTab(); }
  }

  async function markPrinterBroken(printer: any) {
    // If a job was actually printing (not just finished and awaiting pickup), don't mark it
    // done — send it back to the queue instead.
    if (printer.current_job_id && printer.status === 'printing') {
      await supabase.from('print_jobs').update({
        status: 'accepted',
        printer_id: null,
        started_at: null,
        estimated_end_at: null,
      }).eq('id', printer.current_job_id);
    }
    const { error } = await supabase.from('printers').update({
      status: 'maintenance',
      current_job_id: null,
      started_at: null,
      estimated_end_at: null,
    }).eq('id', printer.id);
    if (error) showError('처리 실패: ' + error.message);
    else { showSuccess('고장으로 표시했습니다.'); loadPrintManagerTab(); }
  }

  async function repairPrinter(printer: any) {
    const { error } = await supabase.from('printers').update({ status: 'idle' }).eq('id', printer.id);
    if (error) showError('처리 실패: ' + error.message);
    else { showSuccess('정상 상태로 복구했습니다.'); loadPrintManagerTab(); }
  }

  // ── Laser manager ──────────────────────────────────────────────────────
  const [allLaserJobs, setAllLaserJobs] = useState<any[]>([]);
  const [managerLaserLoading, setManagerLaserLoading] = useState(true);

  const fetchAllLaserJobs = async () => {
    setManagerLaserLoading(true);
    const { data, error } = await supabase
      .from('laser_jobs')
      .select('*, manager:manager_id(full_name, student_id)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error) setAllLaserJobs(data || []);
    setManagerLaserLoading(false);
  };

  async function updateLaserJobStatus(id: string, status: string) {
    const updates: Record<string, any> = { status };
    if (status === 'done') updates.completed_at = new Date().toISOString();
    if (status === 'accepted') {
      const job = allLaserJobs.find(j => j.id === id);
      if (job && !job.manager_id && user) updates.manager_id = user.id;
    }
    const { error } = await supabase.from('laser_jobs').update(updates).eq('id', id);
    if (error) showError('처리 실패: ' + error.message);
    else { showSuccess('상태가 변경됐습니다.'); fetchAllLaserJobs(); }
  }

  async function rejectLaserJob(id: string, reason: string) {
    const { error } = await supabase.from('laser_jobs').update({ status: 'rejected', reject_reason: reason || null }).eq('id', id);
    if (error) showError('처리 실패: ' + error.message);
    else { showSuccess('거절 처리했습니다.'); fetchAllLaserJobs(); }
  }

  // ── Laser materials catalog (managed by laser managers) ──────────────────
  const [laserCatalog, setLaserCatalog] = useState<any[]>([]);
  const [newCatalogMaterial, setNewCatalogMaterial] = useState<'mdf' | 'acrylic'>('mdf');
  const [newCatalogThickness, setNewCatalogThickness] = useState('3');

  const fetchLaserCatalog = async () => {
    const { data, error } = await supabase.from('laser_materials').select('*').order('material').order('thickness_mm');
    if (!error) setLaserCatalog(data || []);
  };

  async function addLaserCatalogEntry() {
    const thicknessNum = parseFloat(newCatalogThickness);
    if (isNaN(thicknessNum) || thicknessNum <= 0) { showError('두께를 올바르게 입력해주세요.'); return; }
    const { error } = await supabase.from('laser_materials').insert({ material: newCatalogMaterial, thickness_mm: thicknessNum });
    if (error) showError(error.code === '23505' ? '이미 등록된 조합입니다.' : '추가 실패: ' + error.message);
    else { showSuccess('재질이 등록됐습니다.'); fetchLaserCatalog(); }
  }

  async function removeLaserCatalogEntry(id: string) {
    const { error } = await supabase.from('laser_materials').delete().eq('id', id);
    if (error) showError('삭제 실패: ' + error.message);
    else { showSuccess('재질이 삭제됐습니다.'); fetchLaserCatalog(); }
  }

  // ── Reject dialog (shared by both manager tabs) ──────────────────────────
  const [rejectTarget, setRejectTarget] = useState<{ type: 'print' | 'laser'; id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  function openReject(type: 'print' | 'laser', id: string) {
    setRejectTarget({ type, id });
    setRejectReason('');
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    if (rejectTarget.type === 'print') await rejectPrintJob(rejectTarget.id, rejectReason.trim());
    else await rejectLaserJob(rejectTarget.id, rejectReason.trim());
    setRejectTarget(null);
  }

  useEffect(() => {
    if (!user) return;
    if (tab === 'print') loadPrintTab();
    if (tab === 'laser') fetchMyLaserJobs();
    if (tab === 'print_manager' && is3DPrintManager) loadPrintManagerTab();
    if (tab === 'laser_manager' && isLaserCutManager) { fetchAllLaserJobs(); fetchLaserCatalog(); }
  }, [tab, user]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size={56} label="인증 확인 중" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="bg-muted p-8 rounded-full">
          <ShieldAlert className="w-16 h-16 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tighter italic uppercase">Login Required</h1>
          <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest opacity-70">
            로그인 후 이용할 수 있습니다.
          </p>
        </div>
        <Button onClick={() => router.push('/auth/login')} className="font-black px-10 h-12 uppercase tracking-widest">
          Login
        </Button>
      </div>
    );
  }

  const tabItems = [
    { value: 'print', label: '3D 프린팅' },
    { value: 'laser', label: '레이저 커팅' },
    ...(is3DPrintManager ? [{ value: 'print_manager', label: `3D 담당자${allPrintJobs.filter(j => j.status === 'pending').length ? ` (${allPrintJobs.filter(j => j.status === 'pending').length})` : ''}` }] : []),
    ...(isLaserCutManager ? [{ value: 'laser_manager', label: `레이저 담당자${allLaserJobs.filter(j => j.status === 'pending').length ? ` (${allLaserJobs.filter(j => j.status === 'pending').length})` : ''}` }] : []),
  ];

  // FIFO — oldest accepted-but-unassigned job first, so the queue is processed fairly.
  const idleJobsForQueue = [...allPrintJobs]
    .filter(j => j.status === 'accepted' && !j.printer_id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter italic uppercase">제작</h1>
          <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest opacity-60">3D Printing · Laser Cutting</p>
        </div>
      </div>

      <SegmentedTabs items={tabItems} value={tab} onChange={v => setTab(v as Tab)} />

      {/* ── 3D printing (requester) ── */}
      {tab === 'print' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-black uppercase text-sm tracking-widest">프린터 현황 (Bambu Lab X1C)</h2>
              {printQueueLength !== null && printQueueLength > 0 && (
                <Badge variant="warning" icon={<Clock className="size-3" />}>대기열 {printQueueLength}건</Badge>
              )}
            </div>
            <Button onClick={() => router.push('/manufacturing/print/new')} className="font-black text-[10px] uppercase gap-1.5 h-9">
              <Plus className="size-3.5" /> 신청하기
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {printers.map(p => (
              <Card key={p.id} className="p-4 rounded-2xl space-y-2">
                <PrinterVisual status={p.status} />
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm">{p.name}</span>
                  {p.status === 'printing'
                    ? <Badge variant="success" icon={<Printer className="size-3" />}>사용중</Badge>
                    : p.status === 'done'
                      ? <Badge variant="warning" icon={<CheckCircle2 className="size-3" />}>회수 대기</Badge>
                      : p.status === 'maintenance'
                        ? <Badge variant="danger">고장</Badge>
                        : <Badge variant="muted">대기</Badge>}
                </div>
                {p.status === 'printing' && p.estimated_end_at && (
                  <p className="text-[11px] text-muted-foreground font-bold">
                    {formatDistanceToNow(new Date(p.estimated_end_at), { locale: ko, addSuffix: true })} 완료 예정
                  </p>
                )}
              </Card>
            ))}
          </div>

          <h2 className="font-black uppercase text-sm tracking-widest">내 신청 내역</h2>
          <div className="border-2 rounded-3xl bg-card overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-4 px-6">파일</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-4">모드</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-4">상태</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-4 px-6">신청일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {printLoading ? (
                    <TableRow><TableCell colSpan={4} className="py-16"><div className="flex justify-center"><LoadingSpinner size={40} label="불러오는 중" /></div></TableCell></TableRow>
                  ) : myPrintJobs.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-16 font-bold text-muted-foreground opacity-50">신청 내역이 없습니다.</TableCell></TableRow>
                  ) : (
                    myPrintJobs.map(j => {
                      const info = PRINT_STATUS_INFO[j.status] || { variant: 'default', icon: null, label: j.status };
                      return (
                        <TableRow key={j.id} className="hover:bg-muted/20 transition-colors border-b last:border-0 cursor-pointer align-top" onClick={() => router.push(`/manufacturing/print/${j.id}`)}>
                          <TableCell className="py-4 px-6">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-sm">{j.file_name || '—'}</span>
                              {j.manager?.full_name && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><User className="size-2.5" /> {j.manager.full_name}</span>}
                              {j.status === 'rejected' && j.reject_reason && <span className="text-[10px] text-destructive font-bold">거절 사유: {j.reject_reason}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="py-4"><span className="text-xs font-black uppercase">{j.mode === 'beginner' ? '초보자' : '고급자'}</span></TableCell>
                          <TableCell className="py-4"><Badge variant={info.variant} icon={info.icon}>{info.label}</Badge></TableCell>
                          <TableCell className="py-4 px-6 text-xs text-muted-foreground font-bold">{new Date(j.created_at).toLocaleString('ko-KR')}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ── Laser cutting (requester) ── */}
      {tab === 'laser' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-black uppercase text-sm tracking-widest">내 신청 내역</h2>
              {laserQueueLength !== null && laserQueueLength > 0 && (
                <Badge variant="warning" icon={<Clock className="size-3" />}>대기열 {laserQueueLength}건</Badge>
              )}
            </div>
            <Button onClick={() => router.push('/manufacturing/laser/new')} className="font-black text-[10px] uppercase gap-1.5 h-9">
              <Plus className="size-3.5" /> 신청하기
            </Button>
          </div>
          <div className="border-2 rounded-3xl bg-card overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-4 px-6">파일</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-4">재질</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-4">상태</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-4 px-6">신청일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {laserLoading ? (
                    <TableRow><TableCell colSpan={4} className="py-16"><div className="flex justify-center"><LoadingSpinner size={40} label="불러오는 중" /></div></TableCell></TableRow>
                  ) : myLaserJobs.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-16 font-bold text-muted-foreground opacity-50">신청 내역이 없습니다.</TableCell></TableRow>
                  ) : (
                    myLaserJobs.map(j => {
                      const info = LASER_STATUS_INFO[j.status] || { variant: 'default', icon: null, label: j.status };
                      return (
                        <TableRow key={j.id} className="hover:bg-muted/20 transition-colors border-b last:border-0 cursor-pointer align-top" onClick={() => router.push(`/manufacturing/laser/${j.id}`)}>
                          <TableCell className="py-4 px-6">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-sm">{j.file_name || '—'}</span>
                              {j.manager?.full_name && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><User className="size-2.5" /> {j.manager.full_name}</span>}
                              {j.status === 'rejected' && j.reject_reason && <span className="text-[10px] text-destructive font-bold">거절 사유: {j.reject_reason}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 text-xs font-black uppercase">{j.material === 'mdf' ? 'MDF' : '아크릴'}{j.thickness_mm ? ` · ${j.thickness_mm}mm` : ''}</TableCell>
                          <TableCell className="py-4"><Badge variant={info.variant} icon={info.icon}>{info.label}</Badge></TableCell>
                          <TableCell className="py-4 px-6 text-xs text-muted-foreground font-bold">{new Date(j.created_at).toLocaleString('ko-KR')}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ── 3D manager ── */}
      {tab === 'print_manager' && is3DPrintManager && (
        <div className="space-y-8">
          <div>
            <h2 className="font-black uppercase text-sm tracking-widest mb-3">프린터 큐</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {printers.map(p => {
                const isMine = managedPrinterIds.includes(p.id);
                return (
                  <Card key={p.id} className="p-4 rounded-2xl space-y-3">
                    <PrinterVisual status={p.status} />
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm">{p.name}</span>
                      {p.status === 'printing'
                        ? <Badge variant="success" icon={<Printer className="size-3" />}>사용중</Badge>
                        : p.status === 'done'
                          ? <Badge variant="warning" icon={<CheckCircle2 className="size-3" />}>회수 대기</Badge>
                          : p.status === 'maintenance'
                            ? <Badge variant="danger">고장</Badge>
                            : <Badge variant="muted">대기</Badge>}
                    </div>

                    {!isMine ? (
                      <p className="text-[10px] text-muted-foreground font-bold opacity-50 text-center py-1">담당 프린터가 아닙니다</p>
                    ) : p.status === 'maintenance' ? (
                      <Button size="sm" variant="outline" className="w-full font-black text-[10px] uppercase gap-1.5" onClick={() => repairPrinter(p)}>
                        <Undo2 className="size-3" /> 정상으로 복구
                      </Button>
                    ) : p.status === 'done' ? (
                      <>
                        <p className="text-[11px] text-muted-foreground font-bold">출력이 끝났습니다. 회수해주세요.</p>
                        <Button size="sm" className="w-full font-black text-[10px] uppercase gap-1.5" onClick={() => collectPrint(p)}>
                          <CheckCircle2 className="size-3" /> 회수함
                        </Button>
                        <Button size="sm" variant="destructive" className="w-full font-black text-[10px] uppercase gap-1.5" onClick={() => markPrinterBroken(p)}>
                          <Wrench className="size-3" /> 고장 처리
                        </Button>
                      </>
                    ) : p.status === 'printing' ? (
                      <>
                        {p.estimated_end_at && (
                          <p className="text-[11px] text-muted-foreground font-bold">
                            {formatDistanceToNow(new Date(p.estimated_end_at), { locale: ko, addSuffix: true })} 완료 예정
                          </p>
                        )}
                        <Button size="sm" variant="outline" className="w-full font-black text-[10px] uppercase gap-1.5" onClick={() => finishPrint(p)}>
                          <Square className="size-3" /> 출력 완료
                        </Button>
                        <Button size="sm" variant="destructive" className="w-full font-black text-[10px] uppercase gap-1.5" onClick={() => markPrinterBroken(p)}>
                          <Wrench className="size-3" /> 고장 처리
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="w-full font-black text-[10px] uppercase gap-1.5"
                          disabled={idleJobsForQueue.length === 0}
                          onClick={() => openQueueDialog(p)}
                        >
                          <Play className="size-3" /> 인쇄 시작
                        </Button>
                        <Button size="sm" variant="destructive" className="w-full font-black text-[10px] uppercase gap-1.5" onClick={() => markPrinterBroken(p)}>
                          <Wrench className="size-3" /> 고장 처리
                        </Button>
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="font-black uppercase text-sm tracking-widest mb-3">전체 신청 목록</h2>
            <div className="border-2 rounded-3xl bg-card overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-b-2">
                      <TableHead className="font-black uppercase text-[10px] tracking-widest py-4 px-6">신청자</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest py-4">모드/파일</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest py-4">상태</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest py-4 px-6 text-right">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {managerPrintLoading ? (
                      <TableRow><TableCell colSpan={4} className="py-16"><div className="flex justify-center"><LoadingSpinner size={40} label="불러오는 중" /></div></TableCell></TableRow>
                    ) : allPrintJobs.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-16 font-bold text-muted-foreground opacity-50">신청 내역이 없습니다.</TableCell></TableRow>
                    ) : (
                      allPrintJobs.map(j => {
                        const info = PRINT_STATUS_INFO[j.status] || { variant: 'default', icon: null, label: j.status };
                        return (
                          <TableRow key={j.id} className="hover:bg-muted/20 transition-colors border-b last:border-0 align-top">
                            <TableCell className="py-4 px-6 text-xs font-bold">{j.user_email}</TableCell>
                            <TableCell className="py-4">
                              <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-black uppercase">{j.mode === 'beginner' ? '초보자' : '고급자'} · {j.quantity}개{j.material ? ` · ${j.material}` : ''}{j.color ? ` · ${j.color}` : ''}</span>
                                {j.purpose && <span className="text-xs font-bold text-muted-foreground">{j.purpose}</span>}
                                {j.manager?.full_name && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><User className="size-2.5" /> 담당: {j.manager.full_name}</span>}
                                <Link href={`/manufacturing/print/${j.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                                  상세 보기 <ExternalLink className="size-3" />
                                </Link>
                                {j.file_path && (
                                  <button onClick={() => downloadFile(j.file_path)} className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1">
                                    <Download className="size-3" /> {j.file_name}{j.mode === 'advanced' ? ' (슬라이싱 완료 — 출력용)' : ' (슬라이싱 필요)'}
                                  </button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-4"><Badge variant={info.variant} icon={info.icon}>{info.label}</Badge></TableCell>
                            <TableCell className="py-4 px-6 text-right">
                              <div className="flex justify-end gap-2">
                                {j.status === 'pending' && (
                                  <>
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase h-8 px-3 rounded-xl" onClick={() => updatePrintJobStatus(j.id, 'accepted')}>수락</Button>
                                    <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase h-8 px-3 rounded-xl" onClick={() => openReject('print', j.id)}>거절</Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Laser manager ── */}
      {tab === 'laser_manager' && isLaserCutManager && (
        <div className="space-y-8">
          <Card className="p-6 rounded-2xl space-y-3">
            <h2 className="font-black uppercase text-xs tracking-widest flex items-center gap-1.5"><Layers className="size-4" /> 재질 카탈로그</h2>
            <p className="text-[11px] text-muted-foreground font-bold opacity-70">
              지금 취급하는 재질/두께만 등록하세요. 신청자는 여기 등록된 조합만 고를 수 있습니다 (재고 수량은 관리하지 않습니다).
            </p>
            {laserCatalog.length === 0 ? (
              <p className="text-xs text-muted-foreground opacity-50">등록된 재질이 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {laserCatalog.map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1.5 bg-muted/50 rounded-full pl-3 pr-1.5 py-1 text-xs font-bold">
                    {c.material === 'mdf' ? 'MDF' : '아크릴'} {c.thickness_mm}mm
                    <button onClick={() => removeLaserCatalogEntry(c.id)} className="ml-1 flex items-center justify-center size-5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Select value={newCatalogMaterial} onValueChange={v => setNewCatalogMaterial(v as 'mdf' | 'acrylic')}>
                <SelectTrigger className="h-9 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mdf">MDF</SelectItem>
                  <SelectItem value="acrylic">아크릴</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" step="0.5" min="0" value={newCatalogThickness} onChange={e => setNewCatalogThickness(e.target.value)} className="h-9 w-28 text-xs" placeholder="두께(mm)" />
              <Button size="sm" className="h-9 px-3 font-black text-[10px] uppercase gap-1" onClick={addLaserCatalogEntry}>
                <Plus className="size-3.5" /> 추가
              </Button>
            </div>
          </Card>

          <div className="border-2 rounded-3xl bg-card overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-b-2">
                  <TableHead className="font-black uppercase text-[10px] tracking-widest py-4 px-6">신청자</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest py-4">재질/파일</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest py-4">상태</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest py-4 px-6 text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managerLaserLoading ? (
                  <TableRow><TableCell colSpan={4} className="py-16"><div className="flex justify-center"><LoadingSpinner size={40} label="불러오는 중" /></div></TableCell></TableRow>
                ) : allLaserJobs.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-16 font-bold text-muted-foreground opacity-50">신청 내역이 없습니다.</TableCell></TableRow>
                ) : (
                  allLaserJobs.map(j => {
                    const info = LASER_STATUS_INFO[j.status] || { variant: 'default', icon: null, label: j.status };
                    return (
                      <TableRow key={j.id} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                        <TableCell className="py-4 px-6 text-xs font-bold">{j.user_email}</TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-black uppercase">{j.material === 'mdf' ? 'MDF' : '아크릴'}{j.thickness_mm ? ` · ${j.thickness_mm}mm` : ''} × {j.quantity}</span>
                            {j.purpose && <span className="text-xs font-bold text-muted-foreground">{j.purpose}</span>}
                            {j.manager?.full_name && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><User className="size-2.5" /> 담당: {j.manager.full_name}</span>}
                            <Link href={`/manufacturing/laser/${j.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                              {j.file_name || '파일 보기'} <ExternalLink className="size-3" />
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell className="py-4"><Badge variant={info.variant} icon={info.icon}>{info.label}</Badge></TableCell>
                        <TableCell className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            {j.status === 'pending' && (
                              <>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase h-8 px-3 rounded-xl" onClick={() => updateLaserJobStatus(j.id, 'accepted')}>수락</Button>
                                <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase h-8 px-3 rounded-xl" onClick={() => openReject('laser', j.id)}>거절</Button>
                              </>
                            )}
                            {j.status === 'accepted' && (
                              <Button size="sm" variant="outline" className="font-black text-[10px] uppercase h-8 px-3 rounded-xl" onClick={() => updateLaserJobStatus(j.id, 'in_progress')}>작업 시작</Button>
                            )}
                            {j.status === 'in_progress' && (
                              <Button size="sm" className="font-black text-[10px] uppercase h-8 px-3 rounded-xl" onClick={() => updateLaserJobStatus(j.id, 'done')}>완료</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          </div>
        </div>
      )}

      {/* ── Start print dialog ── */}
      <Dialog open={!!queueDialogPrinter} onOpenChange={o => !o && setQueueDialogPrinter(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tighter italic text-xl">{queueDialogPrinter?.name} 인쇄 시작</DialogTitle>
            <DialogDescription className="text-xs font-bold opacity-60">대기열에서 작업을 선택하고 예상 소요 시간을 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">작업 선택</label>
              <select
                value={queueJobId}
                onChange={e => setQueueJobId(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm font-bold outline-none"
              >
                <option value="">— 선택 —</option>
                {idleJobsForQueue.map(j => (
                  <option key={j.id} value={j.id}>{j.user_email} · {j.file_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">예상 소요 시간</label>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_PRESETS.map(p => (
                  <button
                    key={p.hours}
                    type="button"
                    onClick={() => setQueueHours(p.hours)}
                    className={`px-2 py-2 rounded-xl border text-[11px] font-black transition-all active:scale-95 ${
                      queueHours === p.hours ? 'border-primary bg-primary text-primary-foreground' : 'border-border/50 hover:bg-muted/30'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-black uppercase text-[10px]" onClick={() => setQueueDialogPrinter(null)}>취소</Button>
            <Button className="font-black uppercase text-[10px]" onClick={startPrint}>시작</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject reason dialog ── */}
      <Dialog open={!!rejectTarget} onOpenChange={o => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tighter italic text-xl">신청 거절</DialogTitle>
            <DialogDescription className="text-xs font-bold opacity-60">신청자가 볼 수 있는 거절 사유를 남겨주세요 (선택).</DialogDescription>
          </DialogHeader>
          <textarea
            rows={3}
            placeholder="예: 인쇄 시간이 너무 길어 처리가 어렵습니다."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 resize-y"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-black uppercase text-[10px]" onClick={() => setRejectTarget(null)}>취소</Button>
            <Button variant="destructive" className="font-black uppercase text-[10px]" onClick={confirmReject}>거절하기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

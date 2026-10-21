'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAlert } from '@/lib/alert';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { ShieldAlert, CheckCircle2, XCircle, Clock, Undo2, KeyRound, Server, Container, GitBranch, Globe, School, Lock, Users, HelpCircle, Megaphone, Printer, Scissors, Plus, X, Music } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { PersonSearchSelect } from '@/components/manufacturing/PersonSearchSelect';
import ConfirmDialog from '@/components/ConfirmDialog';
import MaterialsStorage from '@/components/admin/MaterialsStorage';
import { Trash2 } from 'lucide-react';

type AdminTab = 'gpu' | 'server' | 'accounts' | 'manufacture' | 'materials';

export default function AdminPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [tab, setTab] = useState<AdminTab>('gpu');
  const [query, setQuery] = useState('');
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(30);
  const selectTab = (next: AdminTab, reviewOnly = false) => {
    setTab(next);
    setQuery('');
    setNeedsReviewOnly(reviewOnly);
    setVisibleLimit(30);
  };
  const router = useRouter();

  // ── GPU 예약 ────────────────────────────────────────────────────────────────
  const [reservations, setReservations] = useState<any[]>([]);
  const [gpuLoading, setGpuLoading] = useState(true);
  const [gpuJustFinished, setGpuJustFinished] = useState(false);

  const fetchReservations = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select(`*, profiles:user_id (full_name, student_id)`)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) { showError("데이터 로드 실패."); }
    else { setReservations(data || []); }
    setGpuLoading(false);
    setGpuJustFinished(true);
    setTimeout(() => setGpuJustFinished(false), 600);
  };

  async function updateStatus(id: string, newStatus: 'approved' | 'rejected' | 'pending', gpuId?: number) {
    if (newStatus === 'approved' && gpuId === undefined) { showError('GPU 번호가 없습니다.'); return; }
    if (newStatus === 'approved' && gpuId !== undefined) {
      const target = reservations.find(r => r.id === id);
      if (target) {
        const conflict = reservations.find(r =>
          r.id !== id &&
          r.gpu_id === gpuId &&
          r.status === 'approved' &&
          new Date(r.start_time) < new Date(target.end_time) &&
          new Date(r.end_time) > new Date(target.start_time)
        );
        if (conflict) { showError("승인 불가: 이미 확정된 예약과 시간이 겹칩니다."); return; }
      }
      const { error } = await supabase.rpc('approve_gpu_reservation', { p_reservation_id: id });
      if (error) showError("처리 실패: " + error.message);
      else { showSuccess('예약이 승인됐습니다.'); fetchReservations(); }
      return;
    }
    const { data, error } = await supabase.from('reservations').update({ status: newStatus }).eq('id', id).select('id');
    if (error || !data?.length) showError("처리 실패: " + (error?.message || '변경된 예약이 없습니다.'));
    else { showSuccess(`상태가 ${newStatus}로 변경됐습니다.`); fetchReservations(); }
  }

  // ── CPU 프로젝트 ────────────────────────────────────────────────────────────
  const [cpuProjects, setCpuProjects] = useState<any[]>([]);
  const [cpuLoading, setCpuLoading] = useState(true);
  const [cpuJustFinished, setCpuJustFinished] = useState(false);

  const fetchCpuProjects = async () => {
    const { data, error } = await supabase
      .from('cpu_projects')
      .select('*')
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) showError("서버 프로젝트 로드 실패.");
    else setCpuProjects(data || []);
    setCpuLoading(false);
    setCpuJustFinished(true);
    setTimeout(() => setCpuJustFinished(false), 600);
  };

  async function updateCpuStatus(id: string, newStatus: 'approved' | 'rejected' | 'pending') {
    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === 'approved') {
      updates.deploy_requested_at = new Date().toISOString();
    }
    const { error } = await supabase.from('cpu_projects').update(updates).eq('id', id);
    if (error) showError("처리 실패: " + error.message);
    else { showSuccess(`상태가 ${newStatus}로 변경됐습니다.`); fetchCpuProjects(); }
  }

  // ── 계정(학번/이름 확인) ────────────────────────────────────────────────────
  const [profiles, setProfiles] = useState<any[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesJustFinished, setProfilesJustFinished] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, student_id, full_name, is_admin, is_approved, is_laser_cut_manager')
      .order('is_approved', { ascending: true, nullsFirst: true })
      .order('full_name', { ascending: true })
      .limit(1000);
    if (error) showError("계정 목록 로드 실패.");
    else setProfiles(data || []);
    setProfilesLoading(false);
    setProfilesJustFinished(true);
    setTimeout(() => setProfilesJustFinished(false), 600);
  };

  async function setProfileApproval(id: string, approved: boolean) {
    const { error } = await supabase.from('profiles').update({ is_approved: approved }).eq('id', id);
    if (error) showError("처리 실패: " + error.message);
    else {
      showSuccess(approved ? '승인 처리됐습니다.' : '학번/이름 확인이 필요한 상태로 표시했습니다.');
      fetchProfiles();
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setIsDeletingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { showError('세션이 만료되었습니다. 다시 로그인해주세요.'); return; }

      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: deleteTarget.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { showError(body?.message || '계정 삭제 실패'); return; }

      showSuccess('계정이 삭제됐습니다.');
      fetchProfiles();
    } catch (err: any) {
      showError(err.message || '계정 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingUser(false);
      setDeleteTarget(null);
    }
  }

  async function toggleLaserManager(id: string, current: boolean) {
    const { error } = await supabase.from('profiles').update({ is_laser_cut_manager: !current }).eq('id', id);
    if (error) showError("처리 실패: " + error.message);
    else {
      showSuccess(!current ? '레이저 담당자로 지정됐습니다.' : '레이저 담당자 지정이 해제됐습니다.');
      fetchProfiles();
      fetchLaserManagers();
    }
  }

  // ── Manufacture: per-printer manager assignment ───────────────────────
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);
  const [printerManagers, setPrinterManagers] = useState<any[]>([]);
  const [laserManagers, setLaserManagers] = useState<any[]>([]);
  const [manufactureLoading, setManufactureLoading] = useState(true);
  const [addPrinterManagerSelect, setAddPrinterManagerSelect] = useState<Record<number, string>>({});
  const [addLaserManagerSelect, setAddLaserManagerSelect] = useState('');

  const fetchAllProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('id, full_name, student_id').order('student_id');
    if (!error) setAllProfiles(data || []);
  };

  const fetchPrinters = async () => {
    const { data, error } = await supabase.from('printers').select('*').order('id');
    if (!error) setPrinters(data || []);
  };

  const fetchPrinterManagers = async () => {
    const { data, error } = await supabase
      .from('printer_managers')
      .select('printer_id, user_id, profiles:user_id (full_name, student_id)');
    if (!error) setPrinterManagers(data || []);
  };

  const fetchLaserManagers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, student_id')
      .eq('is_laser_cut_manager', true)
      .order('student_id');
    if (!error) setLaserManagers(data || []);
  };

  const fetchManufactureData = async () => {
    setManufactureLoading(true);
    await Promise.all([fetchAllProfiles(), fetchPrinters(), fetchPrinterManagers(), fetchLaserManagers()]);
    setManufactureLoading(false);
  };

  async function addPrinterManager(printerId: number) {
    const userId = addPrinterManagerSelect[printerId];
    if (!userId) { showError('담당자로 지정할 사람을 선택해주세요.'); return; }
    const { error } = await supabase.from('printer_managers').insert({ printer_id: printerId, user_id: userId });
    if (error) showError('추가 실패: ' + error.message);
    else { showSuccess('담당자가 추가됐습니다.'); setAddPrinterManagerSelect(s => ({ ...s, [printerId]: '' })); fetchPrinterManagers(); }
  }

  async function removePrinterManager(printerId: number, userId: string) {
    const { error } = await supabase.from('printer_managers').delete().eq('printer_id', printerId).eq('user_id', userId);
    if (error) showError('제거 실패: ' + error.message);
    else { showSuccess('담당자가 제거됐습니다.'); fetchPrinterManagers(); }
  }

  async function addLaserManager() {
    if (!addLaserManagerSelect) { showError('담당자로 지정할 사람을 선택해주세요.'); return; }
    await toggleLaserManager(addLaserManagerSelect, false);
    setAddLaserManagerSelect('');
  }

  // ── 기상송 담당자 지정 — is_admin이 아니어도 /admin/wakeup(검토·재생)을 볼
  // 수 있는 권한. 지정 자체는 여기, 진짜 관리자 화면에서만 한다 —
  // /admin/wakeup은 담당자 전용이라 관리자가 거기서 스스로에게 권한을 줄 수 없다.
  const [wakeupManagers, setWakeupManagers] = useState<any[]>([]);
  const [addWakeupManagerSelect, setAddWakeupManagerSelect] = useState('');

  const fetchWakeupManagers = async () => {
    const { data, error } = await supabase.from('profiles').select('id, full_name, student_id').eq('is_wakeup_manager', true).order('student_id');
    if (!error) setWakeupManagers(data || []);
  };

  async function toggleWakeupManager(id: string, current: boolean) {
    const { error } = await supabase.from('profiles').update({ is_wakeup_manager: !current }).eq('id', id);
    if (error) showError('처리 실패: ' + error.message);
    else { showSuccess(!current ? '기상송 담당자로 지정됐습니다.' : '기상송 담당자 지정이 해제됐습니다.'); fetchWakeupManagers(); }
  }

  async function addWakeupManager() {
    if (!addWakeupManagerSelect) { showError('담당자로 지정할 사람을 선택해주세요.'); return; }
    await toggleWakeupManager(addWakeupManagerSelect, false);
    setAddWakeupManagerSelect('');
  }

  // ── 사이트 공지 배너 ────────────────────────────────────────────────────────
  const [bannerMessage, setBannerMessage] = useState('');
  const [bannerActive, setBannerActive] = useState(false);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [bannerSaving, setBannerSaving] = useState(false);

  const fetchBanner = async () => {
    const { data, error } = await supabase.from('site_banner').select('message, is_active').eq('id', 1).maybeSingle();
    if (error) showError("배너 로드 실패.");
    else {
      setBannerMessage(data?.message ?? '');
      setBannerActive(data?.is_active ?? false);
    }
    setBannerLoading(false);
  };

  async function saveBanner(active: boolean) {
    setBannerSaving(true);
    const { error } = await supabase
      .from('site_banner')
      .upsert({ id: 1, message: bannerMessage, is_active: active }, { onConflict: 'id' });
    if (error) showError("저장 실패: " + error.message);
    else {
      setBannerActive(active);
      showSuccess(active ? '배너를 켰습니다.' : '배너를 껐습니다.');
    }
    setBannerSaving(false);
  }

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchReservations();
      fetchCpuProjects();
      fetchProfiles();
      fetchBanner();
      fetchManufactureData();
      fetchWakeupManagers();
    }
  }, [authLoading, isAdmin]);

  // ── 공통 UI ─────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size={56} label="권한 확인 중" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in duration-700">
        <div className="bg-destructive/10 p-8 rounded-full ring-8 ring-destructive/5">
          <ShieldAlert className="w-16 h-16 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase">Access Denied</h1>
          <p className="text-muted-foreground text-lg max-w-md font-bold uppercase opacity-70">
            Administrator privileges required.
          </p>
        </div>
        <Button onClick={() => router.push('/')} variant="outline" className="font-black px-10 h-12 uppercase tracking-widest border-2 hover:bg-foreground hover:text-background transition-all">
          Return Home
        </Button>
      </div>
    );
  }

  const pendingCpuCount = cpuProjects.filter(p => p.status === 'pending').length;
  const unreviewedCount = profiles.filter(p => p.is_approved === null || p.is_approved === false).length;
  const pendingGpuCount = reservations.filter(r => r.status === 'pending').length;
  const conflictsWithApproved = (target: any) => target.status === 'pending' && reservations.some(r =>
    r.id !== target.id && r.gpu_id === target.gpu_id && r.status === 'approved' &&
    new Date(r.start_time) < new Date(target.end_time) &&
    new Date(r.end_time) > new Date(target.start_time)
  );
  const matchesQuery = (...values: unknown[]) => values.some(value => String(value ?? '').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const filteredReservations = reservations.filter(r => (!needsReviewOnly || r.status === 'pending') && matchesQuery(r.profiles?.full_name, r.profiles?.student_id, r.gpu_id, r.purpose));
  const filteredProjects = cpuProjects.filter(p => (!needsReviewOnly || p.status === 'pending') && matchesQuery(p.name, p.user_email, p.profiles?.full_name, p.profiles?.student_id));
  const filteredProfiles = profiles.filter(p => (!needsReviewOnly || p.is_approved !== true) && matchesQuery(p.full_name, p.student_id, p.email));
  const visibleReservations = filteredReservations.slice(0, visibleLimit);
  const visibleProjects = filteredProjects.slice(0, visibleLimit);
  const visibleProfiles = filteredProfiles.slice(0, visibleLimit);
  const hasList = tab === 'gpu' || tab === 'server' || tab === 'accounts';
  const resultCount = tab === 'gpu' ? filteredReservations.length : tab === 'server' ? filteredProjects.length : filteredProfiles.length;
  const listLoading = tab === 'gpu' ? gpuLoading : tab === 'server' ? cpuLoading : profilesLoading;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <section>
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">관리자</h1>
            <p className="pt-2 text-muted-foreground text-sm">신청을 검토하고 학교 서비스를 관리하세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/study">
              <Button variant="outline" className="font-black text-xs uppercase tracking-widest gap-1.5">
                <KeyRound className="size-3.5" /> 자습신청 토큰 관리
              </Button>
            </Link>
            <Link href="/admin/wakeup">
              <Button variant="outline" className="font-black text-xs uppercase tracking-widest gap-1.5">
                <Music className="size-3.5" /> 기상송 관리
              </Button>
            </Link>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-2 sm:gap-3" aria-label="검토할 신청 바로가기">
          {([
            ['gpu', 'GPU 승인 대기', pendingGpuCount, gpuLoading],
            ['server', '서버 승인 대기', pendingCpuCount, cpuLoading],
            ['accounts', '미검토·제한 계정', unreviewedCount, profilesLoading],
          ] as const).map(([target, label, count, loading]) => (
            <button key={target} type="button" onClick={() => selectTab(target, true)} className="rounded-2xl border bg-card p-3 sm:p-5 text-left transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary" aria-pressed={tab === target && needsReviewOnly}>
              <span className="block text-sm text-muted-foreground">{label}</span>
              <span className="mt-2 block text-2xl font-semibold tabular-nums">{loading ? '확인 중…' : `${count}건`}</span>
              <span className="mt-2 block text-xs text-muted-foreground">목록 확인 →</span>
            </button>
          ))}
        </div>

        {/* 탭 전환 */}
        <div className="mb-6">
          <SegmentedTabs
            items={[
              { value: 'gpu',      label: 'GPU 예약' },
              { value: 'server',   label: `서버 배포${pendingCpuCount > 0 ? ` (${pendingCpuCount})` : ''}` },
              { value: 'accounts', label: `계정${unreviewedCount > 0 ? ` (${unreviewedCount})` : ''}` },
              { value: 'manufacture', label: 'Manufacture' },
              { value: 'materials', label: '자료 공유' },
            ]}
            value={tab}
            onChange={v => selectTab(v as AdminTab)}
          />
        </div>

        {hasList && <div className="mb-5 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input type="search" aria-label="현재 관리 목록 검색" placeholder={tab === 'server' ? '프로젝트 이름 또는 이메일 검색' : '이름 또는 학번 검색'} value={query} onChange={e => { setQuery(e.target.value); setVisibleLimit(30); }} className="h-11 sm:max-w-md" />
            <Button variant={needsReviewOnly ? 'secondary' : 'outline'} className="min-h-11" aria-pressed={needsReviewOnly} onClick={() => { setNeedsReviewOnly(v => !v); setVisibleLimit(30); }}>{tab === 'accounts' ? '미검토·제한 계정만' : '승인 대기만'}</Button>
            {(query || needsReviewOnly) && <Button variant="ghost" className="min-h-11" onClick={() => { setQuery(''); setNeedsReviewOnly(false); setVisibleLimit(30); }}>필터 초기화</Button>}
          </div>
          <p role="status" className="text-sm text-muted-foreground">{listLoading ? '목록을 불러오는 중…' : `검색 결과 ${resultCount}건 · ${Math.min(resultCount, visibleLimit)}건 표시`}</p>
        </div>}

        {/* ── GPU 예약 탭 ── */}
        {tab === 'gpu' && (
          <div className="border rounded-3xl bg-card overflow-hidden shadow-sm">
            {/* 모바일: 가로 스크롤 없이 바로 승인/거절 — 카드 목록 */}
            <div className="md:hidden divide-y">
              {gpuLoading || gpuJustFinished ? (
                <div className="py-16 flex items-center justify-center"><LoadingSpinner done={gpuJustFinished} size={48} label="예약 내역 불러오는 중" /></div>
              ) : visibleReservations.length === 0 ? (
                <div className="text-center py-20 font-bold text-muted-foreground opacity-50">표시할 예약이 없습니다.</div>
              ) : (
                visibleReservations.map((res) => {
                  const start = new Date(res.start_time);
                  const end = new Date(res.end_time);
                  const isEnded = new Date() > end;
                  const hasConflict = conflictsWithApproved(res);
                  const dateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                  return (
                    <div key={res.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-black text-sm uppercase tracking-tight truncate">{res.profiles?.full_name || 'Unknown'}</span>
                          <span className="text-[10px] text-muted-foreground font-bold opacity-70">{res.profiles?.student_id || res.user_email}</span>
                        </div>
                        <span className="font-black italic text-primary text-sm shrink-0">GPU #{res.gpu_id}</span>
                      </div>
                      <div className="bg-muted/50 px-3 py-2 rounded-xl border border-border/50 text-[11px] font-bold leading-tight">
                        {start.toLocaleString('ko-KR', dateOptions)}
                        <span className="opacity-30 mx-1">→</span>
                        {end.toLocaleString('ko-KR', dateOptions)}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          {res.status === 'pending'  && <Badge variant="warning" icon={<Clock className="size-3" />}>Pending</Badge>}
                          {hasConflict && <p className="mt-1 text-xs font-bold text-destructive">확정 예약과 시간 겹침</p>}
                          {res.status === 'approved' && <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>Approved</Badge>}
                          {res.status === 'rejected' && <Badge variant="danger"  icon={<XCircle className="size-3" />}>Rejected</Badge>}
                        </div>
                        {isEnded ? (
                          <span className="text-[10px] font-black uppercase opacity-30">Session Finished</span>
                        ) : res.status === 'pending' ? (
                          <div className="flex gap-2">
                            <Button size="sm" disabled={hasConflict} title={hasConflict ? '확정 예약과 시간이 겹쳐 승인할 수 없습니다.' : undefined} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase h-8 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" onClick={() => updateStatus(res.id, 'approved', res.gpu_id)}>Approve</Button>
                            <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase h-8 px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" onClick={() => updateStatus(res.id, 'rejected')}>Reject</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="font-black text-[10px] uppercase h-8 px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" onClick={() => updateStatus(res.id, 'pending')}>
                            <Undo2 className="size-3" /> Reset
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5 px-6">Applicant</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">GPU Unit</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">Time Frame</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">Status</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5 px-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gpuLoading || gpuJustFinished ? (
                    <TableRow><TableCell colSpan={5} className="py-16"><div className="flex items-center justify-center"><LoadingSpinner done={gpuJustFinished} size={48} label="예약 내역 불러오는 중" /></div></TableCell></TableRow>
                  ) : visibleReservations.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 font-bold text-muted-foreground opacity-50">표시할 예약이 없습니다.</TableCell></TableRow>
                  ) : (
                    visibleReservations.map((res) => {
                      const start = new Date(res.start_time);
                      const end = new Date(res.end_time);
                      const isEnded = new Date() > end;
                      const hasConflict = conflictsWithApproved(res);
                      const dateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                      return (
                        <TableRow key={res.id} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                          <TableCell className="py-5 px-6">
                            <div className="flex flex-col">
                              <span className="font-black text-sm uppercase tracking-tight">{res.profiles?.full_name || 'Unknown'}</span>
                              <span className="text-[10px] text-muted-foreground font-bold opacity-70">{res.profiles?.student_id || res.user_email}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-black italic text-primary">GPU #{res.gpu_id}</TableCell>
                          <TableCell className="text-[11px] font-bold leading-tight py-5">
                            <div className="bg-muted/50 px-3 py-2 rounded-xl inline-block border border-border/50">
                              {start.toLocaleString('ko-KR', dateOptions)} <br/>
                              <span className="opacity-30 mx-1">to</span> {end.toLocaleString('ko-KR', dateOptions)}
                            </div>
                          </TableCell>
                          <TableCell className="py-5">
                            {res.status === 'pending'  && <Badge variant="warning" icon={<Clock className="size-3" />}>Pending</Badge>}
                            {hasConflict && <p className="mt-1 text-xs font-bold text-destructive">확정 예약과 시간 겹침</p>}
                            {res.status === 'approved' && <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>Approved</Badge>}
                            {res.status === 'rejected' && <Badge variant="danger"  icon={<XCircle className="size-3" />}>Rejected</Badge>}
                          </TableCell>
                          <TableCell className="text-right py-5 px-6">
                            <div className="flex justify-end gap-2">
                              {isEnded ? (
                                <span className="text-[10px] font-black uppercase opacity-30 px-4">Session Finished</span>
                              ) : res.status === 'pending' ? (
                                <>
                                  <Button size="sm" disabled={hasConflict} title={hasConflict ? '확정 예약과 시간이 겹쳐 승인할 수 없습니다.' : undefined} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase h-8 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" onClick={() => updateStatus(res.id, 'approved', res.gpu_id)}>Approve</Button>
                                  <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase h-8 px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" onClick={() => updateStatus(res.id, 'rejected')}>Reject</Button>
                                </>
                              ) : (
                                <Button size="sm" variant="outline" className="font-black text-[10px] uppercase h-8 px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" onClick={() => updateStatus(res.id, 'pending')}>
                                  <Undo2 className="size-3" /> Reset
                                </Button>
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
        )}

        {/* ── 서버 배포 탭 ── */}
        {tab === 'server' && (
          <div className="border rounded-3xl bg-card overflow-hidden shadow-sm">
            {/* 모바일: 가로 스크롤 없이 바로 승인/거절 — 카드 목록 */}
            <div className="md:hidden divide-y">
              {cpuLoading || cpuJustFinished ? (
                <div className="py-16 flex items-center justify-center"><LoadingSpinner done={cpuJustFinished} size={48} label="프로젝트 불러오는 중" /></div>
              ) : visibleProjects.length === 0 ? (
                <div className="text-center py-20 font-bold text-muted-foreground opacity-50">표시할 프로젝트가 없습니다.</div>
              ) : (
                visibleProjects.map((proj) => (
                  <div key={proj.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="font-black text-sm uppercase tracking-tight truncate">{(proj.profiles as any)?.full_name || 'Unknown'}</span>
                        <span className="text-[10px] text-muted-foreground font-bold opacity-70">{(proj.profiles as any)?.student_id || proj.user_email}</span>
                      </div>
                      {proj.status === 'pending'  && <Badge variant="warning" icon={<Clock className="size-3" />}>Pending</Badge>}
                      {proj.status === 'approved' && <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>Approved</Badge>}
                      {proj.status === 'rejected' && <Badge variant="danger"  icon={<XCircle className="size-3" />}>Rejected</Badge>}
                    </div>
                    <div className="bg-muted/50 px-3 py-2 rounded-xl border border-border/50 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        {proj.deploy_type === 'docker'
                          ? <Container className="size-3 text-muted-foreground" />
                          : <GitBranch className="size-3 text-muted-foreground" />}
                        <span className="font-black text-sm">{proj.name}</span>
                      </div>
                      <code className="text-[10px] text-muted-foreground opacity-70 block truncate">
                        {proj.deploy_type === 'docker' ? proj.docker_image : proj.git_url?.replace('https://', '')}
                      </code>
                      <div className="flex flex-col gap-1 text-[10px] font-bold text-muted-foreground pt-1">
                        <span>Port: {proj.host_port}:{proj.container_port}</span>
                        <span className="flex items-center gap-1">
                          {proj.access_scope === 'private' && <><Lock className="size-2.5" /> Private</>}
                          {proj.access_scope === 'school'  && <><School className="size-2.5 text-blue-500" /> School</>}
                          {proj.access_scope === 'public'  && <><Globe className="size-2.5 text-green-500" /> Public</>}
                        </span>
                        <span>CPU: {proj.cpu_limit} / Mem: {proj.memory_limit}</span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 flex-wrap">
                      <Link href={`/server/${proj.id}`}>
                        <Button size="sm" variant="outline" className="font-black text-[10px] uppercase h-8 px-3 rounded-xl border-2 transition-all active:scale-95 gap-1.5">
                          <Server className="size-3" /> 상세
                        </Button>
                      </Link>
                      {proj.status === 'pending' && (
                        <>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase h-8 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" onClick={() => updateCpuStatus(proj.id, 'approved')}>Approve</Button>
                          <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase h-8 px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" onClick={() => updateCpuStatus(proj.id, 'rejected')}>Reject</Button>
                        </>
                      )}
                      {(proj.status === 'approved' || proj.status === 'rejected') && (
                        <Button size="sm" variant="outline" className="font-black text-[10px] uppercase h-8 px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" onClick={() => updateCpuStatus(proj.id, 'pending')}>
                          <Undo2 className="size-3" /> Reset
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5 px-6">Applicant</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">Project</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">Config</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">Status</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5 px-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cpuLoading || cpuJustFinished ? (
                    <TableRow><TableCell colSpan={5} className="py-16"><div className="flex items-center justify-center"><LoadingSpinner done={cpuJustFinished} size={48} label="프로젝트 불러오는 중" /></div></TableCell></TableRow>
                  ) : visibleProjects.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 font-bold text-muted-foreground opacity-50">표시할 프로젝트가 없습니다.</TableCell></TableRow>
                  ) : (
                    visibleProjects.map((proj) => (
                      <TableRow key={proj.id} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                        <TableCell className="py-5 px-6">
                          <div className="flex flex-col">
                            <span className="font-black text-sm uppercase tracking-tight">{(proj.profiles as any)?.full_name || 'Unknown'}</span>
                            <span className="text-[10px] text-muted-foreground font-bold opacity-70">{(proj.profiles as any)?.student_id || proj.user_email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              {proj.deploy_type === 'docker'
                                ? <Container className="size-3 text-muted-foreground" />
                                : <GitBranch className="size-3 text-muted-foreground" />}
                              <span className="font-black text-sm">{proj.name}</span>
                            </div>
                            <code className="text-[10px] text-muted-foreground opacity-70">
                              {proj.deploy_type === 'docker' ? proj.docker_image : proj.git_url?.replace('https://', '')}
                            </code>
                          </div>
                        </TableCell>
                        <TableCell className="py-5">
                          <div className="flex flex-col gap-1 text-[10px] font-bold text-muted-foreground">
                            <span>Port: {proj.host_port}:{proj.container_port}</span>
                            <span className="flex items-center gap-1">
                              {proj.access_scope === 'private' && <><Lock className="size-2.5" /> Private</>}
                              {proj.access_scope === 'school'  && <><School className="size-2.5 text-blue-500" /> School</>}
                              {proj.access_scope === 'public'  && <><Globe className="size-2.5 text-green-500" /> Public</>}
                            </span>
                            <span>CPU: {proj.cpu_limit} / Mem: {proj.memory_limit}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5">
                          {proj.status === 'pending'  && <Badge variant="warning" icon={<Clock className="size-3" />}>Pending</Badge>}
                          {proj.status === 'approved' && <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>Approved</Badge>}
                          {proj.status === 'rejected' && <Badge variant="danger"  icon={<XCircle className="size-3" />}>Rejected</Badge>}
                        </TableCell>
                        <TableCell className="text-right py-5 px-6">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <Link href={`/server/${proj.id}`}>
                              <Button size="sm" variant="outline" className="font-black text-[10px] uppercase h-8 px-3 rounded-xl border-2 transition-all active:scale-95 gap-1.5">
                                <Server className="size-3" /> 상세
                              </Button>
                            </Link>
                            {proj.status === 'pending' && (
                              <>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase h-8 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" onClick={() => updateCpuStatus(proj.id, 'approved')}>Approve</Button>
                                <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase h-8 px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" onClick={() => updateCpuStatus(proj.id, 'rejected')}>Reject</Button>
                              </>
                            )}
                            {proj.status === 'approved' && (
                              <Button size="sm" variant="outline" className="font-black text-[10px] uppercase h-8 px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" onClick={() => updateCpuStatus(proj.id, 'pending')}>
                                <Undo2 className="size-3" /> Reset
                              </Button>
                            )}
                            {proj.status === 'rejected' && (
                              <Button size="sm" variant="outline" className="font-black text-[10px] uppercase h-8 px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" onClick={() => updateCpuStatus(proj.id, 'pending')}>
                                <Undo2 className="size-3" /> Reset
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── 계정 탭 ── */}
        {tab === 'accounts' && (
          <div className="border rounded-3xl bg-card overflow-hidden shadow-sm">
            {/* 모바일: 가로 스크롤 없이 바로 승인 — 카드 목록 */}
            <div className="md:hidden divide-y">
              {profilesLoading || profilesJustFinished ? (
                <div className="py-16 flex items-center justify-center"><LoadingSpinner done={profilesJustFinished} size={48} label="계정 목록 불러오는 중" /></div>
              ) : visibleProfiles.length === 0 ? (
                <div className="text-center py-20 font-bold text-muted-foreground opacity-50">표시할 계정이 없습니다.</div>
              ) : (
                visibleProfiles.map((p) => (
                  <div key={p.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-black text-sm uppercase tracking-tight truncate">{p.full_name || 'Unknown'}</span>
                        {p.is_admin && <Badge variant="warning">Admin</Badge>}
                        {p.is_laser_cut_manager && <Badge variant="default">레이저 담당</Badge>}
                      </div>
                      <span className="text-sm font-bold shrink-0">{p.student_id || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        {p.is_approved === false && <Badge variant="danger" icon={<XCircle className="size-3" />}>제한됨</Badge>}
                        {p.is_approved === null && <Badge variant="warning" icon={<HelpCircle className="size-3" />}>미검토</Badge>}
                        {p.is_approved === true && <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>승인됨</Badge>}
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {p.is_approved !== true && (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase h-8 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" onClick={() => setProfileApproval(p.id, true)}>
                            승인
                          </Button>
                        )}
                        {p.is_approved !== false && (
                          <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase h-8 px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" onClick={() => setProfileApproval(p.id, false)}>
                            확인 필요로 표시
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="font-black text-[10px] uppercase h-8 px-3 rounded-xl border-2 border-destructive/30 text-destructive hover:bg-destructive/10 transition-all active:scale-95 gap-1.5" onClick={() => setDeleteTarget({ id: p.id, name: p.full_name || p.student_id || 'Unknown' })}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5 px-6">Name</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">Student ID</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">Status</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5 px-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profilesLoading || profilesJustFinished ? (
                    <TableRow><TableCell colSpan={4} className="py-16"><div className="flex items-center justify-center"><LoadingSpinner done={profilesJustFinished} size={48} label="계정 목록 불러오는 중" /></div></TableCell></TableRow>
                  ) : visibleProfiles.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 font-bold text-muted-foreground opacity-50">표시할 계정이 없습니다.</TableCell></TableRow>
                  ) : (
                    visibleProfiles.map((p) => (
                      <TableRow key={p.id} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                        <TableCell className="py-5 px-6">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm uppercase tracking-tight">{p.full_name || 'Unknown'}</span>
                            {p.is_admin && <Badge variant="warning">Admin</Badge>}
                            {p.is_laser_cut_manager && <Badge variant="default">레이저 담당</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-bold">{p.student_id || '-'}</TableCell>
                        <TableCell className="py-5">
                          {p.is_approved === false && <Badge variant="danger" icon={<XCircle className="size-3" />}>제한됨</Badge>}
                          {p.is_approved === null && <Badge variant="warning" icon={<HelpCircle className="size-3" />}>미검토</Badge>}
                          {p.is_approved === true && <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>승인됨</Badge>}
                        </TableCell>
                        <TableCell className="text-right py-5 px-6">
                          <div className="flex justify-end gap-2 flex-wrap">
                            {p.is_approved !== true && (
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase h-8 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" onClick={() => setProfileApproval(p.id, true)}>
                                승인
                              </Button>
                            )}
                            {p.is_approved !== false && (
                              <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase h-8 px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" onClick={() => setProfileApproval(p.id, false)}>
                                확인 필요로 표시
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="font-black text-[10px] uppercase h-8 px-3 rounded-xl border-2 border-destructive/30 text-destructive hover:bg-destructive/10 transition-all active:scale-95 gap-1.5" onClick={() => setDeleteTarget({ id: p.id, name: p.full_name || p.student_id || 'Unknown' })}>
                              <Trash2 className="size-3" /> 삭제
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── Manufacture tab ── */}
        {tab === 'materials' && <MaterialsStorage />}

        {tab === 'manufacture' && (
          <div className="space-y-8">
            {manufactureLoading ? (
              <div className="flex justify-center py-16"><LoadingSpinner size={48} label="불러오는 중" /></div>
            ) : (
              <>
                <div>
                  <h2 className="font-black uppercase text-sm tracking-widest mb-1 flex items-center gap-1.5"><Printer className="size-4" /> 3D 프린터 담당자</h2>
                  <p className="text-xs text-muted-foreground font-bold opacity-60 mb-4">
                    프린터를 먼저 고르고, 그 프린터를 담당할 사람을 추가하세요. 담당자는 그 프린터의 인쇄 시작/완료/고장 처리를 할 수 있습니다.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {printers.map(printer => {
                      const assigned = printerManagers.filter(pm => pm.printer_id === printer.id);
                      const assignedIds = new Set(assigned.map(a => a.user_id));
                      const candidates = allProfiles.filter(p => !assignedIds.has(p.id));
                      return (
                        <div key={printer.id} className="border-2 rounded-2xl bg-card p-5 space-y-3">
                          <p className="font-black text-sm uppercase">{printer.name}</p>
                          {assigned.length === 0 ? (
                            <p className="text-xs text-muted-foreground opacity-50">담당자 없음</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {assigned.map(a => (
                                <span key={a.user_id} className="inline-flex items-center gap-1.5 bg-muted/50 rounded-full pl-3 pr-1.5 py-1 text-xs font-bold">
                                  {a.profiles?.full_name || 'Unknown'} <span className="text-muted-foreground opacity-60">({a.profiles?.student_id || '-'})</span>
                                  <button onClick={() => removePrinterManager(printer.id, a.user_id)} className="ml-1 flex items-center justify-center size-5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
                                    <X className="size-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <PersonSearchSelect
                              candidates={candidates}
                              value={addPrinterManagerSelect[printer.id] || ''}
                              onChange={v => setAddPrinterManagerSelect(s => ({ ...s, [printer.id]: v }))}
                            />
                            <Button size="sm" className="h-9 px-3 font-black text-[10px] uppercase gap-1" onClick={() => addPrinterManager(printer.id)}>
                              <Plus className="size-3.5" /> 추가
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h2 className="font-black uppercase text-sm tracking-widest mb-3 flex items-center gap-1.5"><Scissors className="size-4" /> 레이저 커팅 담당자</h2>
                  <div className="border-2 rounded-2xl bg-card p-5 space-y-3 max-w-xl">
                    {laserManagers.length === 0 ? (
                      <p className="text-xs text-muted-foreground opacity-50">담당자 없음</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {laserManagers.map(m => (
                          <span key={m.id} className="inline-flex items-center gap-1.5 bg-muted/50 rounded-full pl-3 pr-1.5 py-1 text-xs font-bold">
                            {m.full_name || 'Unknown'} <span className="text-muted-foreground opacity-60">({m.student_id || '-'})</span>
                            <button onClick={() => toggleLaserManager(m.id, true)} className="ml-1 flex items-center justify-center size-5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <PersonSearchSelect
                        candidates={allProfiles.filter(p => !laserManagers.some(m => m.id === p.id))}
                        value={addLaserManagerSelect}
                        onChange={setAddLaserManagerSelect}
                      />
                      <Button size="sm" className="h-9 px-3 font-black text-[10px] uppercase gap-1" onClick={addLaserManager}>
                        <Plus className="size-3.5" /> 추가
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {hasList && !listLoading && resultCount > visibleLimit && <div className="mt-6 flex justify-center"><Button variant="outline" className="min-h-11" onClick={() => setVisibleLimit(v => v + 30)}>30건 더 보기 ({resultCount - visibleLimit}건 남음)</Button></div>}
        <div className="mt-10 border-t pt-8"><h2 className="mb-4 text-lg font-semibold">서비스 설정</h2>
        {/* 자주 사용하지 않는 설정은 필요할 때 펼친다. */}
        <details className="mb-4 rounded-2xl border bg-card p-5 space-y-4">
          <summary className="min-h-11 cursor-pointer font-semibold list-inside">
            기상송 담당자 지정
          </summary>
          <div className="flex items-center gap-2 sr-only">
            <Music className="size-5 text-primary" />
            <h2 className="font-black uppercase text-sm tracking-widest">기상송 담당자 지정</h2>
          </div>
          <div className="flex gap-2">
            <PersonSearchSelect
              candidates={allProfiles.filter(p => !wakeupManagers.some(m => m.id === p.id))}
              value={addWakeupManagerSelect}
              onChange={setAddWakeupManagerSelect}
            />
            <Button onClick={addWakeupManager}>추가</Button>
          </div>
          {wakeupManagers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {wakeupManagers.map(m => (
                <span key={m.id} className="flex items-center gap-1 bg-muted rounded-full pl-3 pr-1.5 py-1 text-xs font-bold">
                  {m.full_name || 'Unknown'} <span className="text-muted-foreground opacity-60">({m.student_id || '-'})</span>
                  <button aria-label={`${m.full_name || '사용자'} 담당자 해제`} onClick={() => toggleWakeupManager(m.id, true)} className="ml-1 flex items-center justify-center size-11 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </details>

        <details className="mb-8 rounded-2xl border bg-card p-5 space-y-4">
          <summary className="min-h-11 cursor-pointer font-semibold list-inside">전체 공지 배너 <span className="ml-2 text-sm font-normal text-muted-foreground">{bannerLoading ? '확인 중' : bannerActive ? '표시 중' : '꺼짐'}</span></summary>
          {bannerLoading ? (
            <div className="flex items-center justify-center py-8"><LoadingSpinner size={40} label="배너 불러오는 중" /></div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Megaphone className="size-5 text-primary" />
                <h2 className="font-black uppercase text-sm tracking-widest">전체 공지 배너</h2>
                {bannerActive && (
                  <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>표시 중</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                켜두면 로그인 여부와 상관없이 모든 페이지 상단에 이 문구가 보입니다.
              </p>
              <textarea
                aria-label="전체 공지 내용"
                value={bannerMessage}
                onChange={(e) => setBannerMessage(e.target.value)}
                placeholder="예: 7/10(금) 03:00~05:00 서버 점검이 있습니다."
                rows={3}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest gap-1.5"
                  disabled={bannerSaving || !bannerMessage.trim()}
                  onClick={() => saveBanner(true)}
                >
                  <Megaphone className="size-3.5" /> 저장하고 켜기
                </Button>
                <Button
                  variant="outline"
                  className="font-black text-xs uppercase tracking-widest"
                  disabled={bannerSaving || !bannerActive}
                  onClick={() => saveBanner(false)}
                >
                  끄기
                </Button>
              </div>
            </>
          )}
        </details>

        </div>
      </section>

      <ConfirmDialog
        open={!!deleteTarget}
        title="계정을 삭제할까요?"
        description={`${deleteTarget?.name ?? ''} 계정의 이름/학번/프로필 사진이 삭제되고 로그인할 수 없게 됩니다. 되돌릴 수 없습니다.`}
        confirmLabel={isDeletingUser ? '삭제 중...' : '계정 삭제'}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

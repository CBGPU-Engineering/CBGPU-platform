'use client';
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatMemoryLimit } from '@/lib/formatMemoryLimit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAlert } from '@/lib/alert';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { ShieldAlert, CheckCircle2, XCircle, Clock, Undo2, Server, Container, GitBranch, Globe, School, Lock, Users, HelpCircle, Megaphone, Printer, Scissors, Plus, X, Music, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import { PersonSearchSelect } from '@/components/manufacturing/PersonSearchSelect';
import ConfirmDialog from '@/components/ConfirmDialog';
import MaterialsStorage from '@/components/admin/MaterialsStorage';
import { Trash2 } from 'lucide-react';

type AdminTab = 'gpu' | 'server' | 'accounts' | 'manufacture' | 'materials';

export default function AdminPage({sectionOverride}:{sectionOverride?:AdminTab}) {
  const params=useSearchParams(),section=sectionOverride||params.get('section');
  const initialTab:AdminTab=section&&['gpu','server','accounts','manufacture','materials'].includes(section)?section as AdminTab:'gpu';
  const initialReview=params.get('review')==='1';
  return <AdminContent key={initialTab+String(initialReview)} initialTab={initialTab} initialReview={initialReview}/>;
}

function AdminContent({initialTab,initialReview}:{initialTab:AdminTab;initialReview:boolean}) {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [loadErrors, setLoadErrors] = useState<Partial<Record<AdminTab, string>>>({});
  const [needsReviewOnly, setNeedsReviewOnly] = useState(initialReview);
  const [statusFilter, setStatusFilter] = useState('all');
  const [gpuFilter, setGpuFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [rowActions, setRowActions] = useState<Record<string, boolean>>({});
  const activeRowActions = useRef(new Set<string>());
  async function runRowAction(key: string, action: () => Promise<void>) {
    if (activeRowActions.current.has(key)) return;
    activeRowActions.current.add(key); setRowActions(v => ({ ...v, [key]: true }));
    try { await action(); }
    catch (error) { showError(error instanceof Error ? error.message : "Could not complete the operation. Please try again."); }
    finally { activeRowActions.current.delete(key); setRowActions(v => ({ ...v, [key]: false })); }
  }
  const resetFilters = () => { setQuery(''); setNeedsReviewOnly(false); setStatusFilter('all'); setGpuFilter('all'); setRoleFilter('all'); setVisibleLimit(30); };
  const [visibleLimit, setVisibleLimit] = useState(30);
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('default');
  const [density, setDensity] = useState('comfortable');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  useEffect(() => { setPage(1); }, [query, needsReviewOnly, statusFilter, gpuFilter, roleFilter, visibleLimit, sortOrder]);
  useEffect(() => {
    const handle = () => document.querySelector<HTMLInputElement>('input[aria-label="Search current list"]')?.focus();
    window.addEventListener('admin:search-list', handle);
    return () => window.removeEventListener('admin:search-list', handle);
  }, []);
  const selectTab = (next: AdminTab, reviewOnly = false) => {
    setTab(next);
    router.replace('/admin/'+next+(reviewOnly?'?review=1':''));
    resetFilters();
    setNeedsReviewOnly(reviewOnly);
    setVisibleLimit(30);
  };
  const router = useRouter();


  // ── GPU 예약 ────────────────────────────────────────────────────────────────
  const [reservations, setReservations] = useState<any[]>([]);
  const [gpuLoading, setGpuLoading] = useState(true);
  const [gpuJustFinished, setGpuJustFinished] = useState(false);

  const fetchReservations = async () => {
    setGpuLoading(true);
    setLoadErrors(v => ({ ...v, gpu: undefined }));
    try {
    const { data, error } = await supabase
      .from('reservations')
      .select(`*, profiles:user_id (full_name, student_id)`)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) { setLoadErrors(v => ({ ...v, gpu: "Could not load GPU reservations." })); showError("Could not load data."); }
    else { setReservations(data || []); }
    } catch { setLoadErrors(v => ({ ...v, gpu: "Could not load the list. Please try again." })); }
    setGpuLoading(false);
    setGpuJustFinished(true);
    setTimeout(() => setGpuJustFinished(false), 600);
  };

  async function updateStatus(id: string, newStatus: 'approved' | 'rejected' | 'pending', gpuId?: number) {
    return runRowAction('gpu:' + id, async () => {
    if (newStatus === 'approved' && gpuId === undefined) { showError("A GPU number is required."); return; }
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
        if (conflict) { showError("Cannot approve: this overlaps an approved reservation."); return; }
      }
      const { error } = await supabase.rpc('approve_gpu_reservation', { p_reservation_id: id });
      if (error) showError("Operation failed: " + error.message);
      else { showSuccess("Reservation approved."); await fetchReservations(); }
      return;
    }
    const { data, error } = await supabase.from('reservations').update({ status: newStatus }).eq('id', id).select('id');
    if (error || !data?.length) showError("Operation failed: " + (error?.message || "No reservations were changed."));
    else { showSuccess(`Status changed to ${newStatus}.`); await fetchReservations(); }
    });
  }

  // ── CPU 프로젝트 ────────────────────────────────────────────────────────────
  const [cpuProjects, setCpuProjects] = useState<any[]>([]);
  const [cpuLoading, setCpuLoading] = useState(true);
  const [cpuJustFinished, setCpuJustFinished] = useState(false);

  const fetchCpuProjects = async () => {
    setCpuLoading(true);
    setLoadErrors(v => ({ ...v, server: undefined }));
    try {
    const { data, error } = await supabase
      .from('cpu_projects')
      .select('*')
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) { setLoadErrors(v => ({ ...v, server: "Could not load server projects." })); showError("Could not load server projects."); }
    else setCpuProjects(data || []);
    } catch { setLoadErrors(v => ({ ...v, server: "Could not load the list. Please try again." })); }
    setCpuLoading(false);
    setCpuJustFinished(true);
    setTimeout(() => setCpuJustFinished(false), 600);
  };

  async function updateCpuStatus(id: string, newStatus: 'approved' | 'rejected' | 'pending') {
    return runRowAction('server:' + id, async () => {
    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === 'approved') {
      updates.deploy_requested_at = new Date().toISOString();
    }
    const { error } = await supabase.from('cpu_projects').update(updates).eq('id', id);
    if (error) showError("Operation failed: " + error.message);
    else { showSuccess(`Status changed to ${newStatus}.`); await fetchCpuProjects(); }
    });
  }

  // ── 계정(학번/이름 확인) ────────────────────────────────────────────────────
  const [profiles, setProfiles] = useState<any[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesJustFinished, setProfilesJustFinished] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const fetchProfiles = async () => {
    setProfilesLoading(true);
    setLoadErrors(v => ({ ...v, accounts: undefined }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/profiles', { headers: { Authorization: `Bearer ${session?.access_token || ''}` }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load accounts.");
      setProfiles(data.profiles || []);
    } catch {
      setLoadErrors(v => ({ ...v, accounts: "Could not load accounts." }));
      showError("Could not load accounts.");
    }
    setProfilesLoading(false);
    setProfilesJustFinished(true);
    setTimeout(() => setProfilesJustFinished(false), 600);
  };

  async function setProfileApproval(id: string, approved: boolean) {
    return runRowAction('account:' + id, async () => {
    const { error } = await supabase.from('profiles').update({ is_approved: approved }).eq('id', id);
    if (error) showError("Operation failed: " + error.message);
    else {
      showSuccess(approved ? "Account approved." : "Account marked for identity review.");
      await fetchProfiles();
    }
    });
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setIsDeletingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { showError("Your session expired. Please sign in again."); return; }

      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: deleteTarget.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { showError(body?.message || "Could not delete account"); return; }

      showSuccess("Account deleted.");
      fetchProfiles();
    } catch (err: any) {
      showError(err.message || "Could not delete the account.");
    } finally {
      setIsDeletingUser(false);
      setDeleteTarget(null);
    }
  }

  async function toggleLaserManager(id: string, current: boolean) {
    const { error } = await supabase.from('profiles').update({ is_laser_cut_manager: !current }).eq('id', id);
    if (error) showError("Operation failed: " + error.message);
    else {
      showSuccess(!current ? "Laser manager assigned." : "Laser manager removed.");
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
    if (!userId) { showError("Select a person to assign."); return; }
    const { error } = await supabase.from('printer_managers').insert({ printer_id: printerId, user_id: userId });
    if (error) showError("Could not add: " + error.message);
    else { showSuccess("Manager added."); setAddPrinterManagerSelect(s => ({ ...s, [printerId]: '' })); fetchPrinterManagers(); }
  }

  async function removePrinterManager(printerId: number, userId: string) {
    const { error } = await supabase.from('printer_managers').delete().eq('printer_id', printerId).eq('user_id', userId);
    if (error) showError("Could not remove: " + error.message);
    else { showSuccess("Manager removed."); fetchPrinterManagers(); }
  }

  async function addLaserManager() {
    if (!addLaserManagerSelect) { showError("Select a person to assign."); return; }
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
    if (error) showError("Operation failed: " + error.message);
    else { showSuccess(!current ? "Wake-up music manager assigned." : "Wake-up music manager removed."); fetchWakeupManagers(); }
  }

  async function addWakeupManager() {
    if (!addWakeupManagerSelect) { showError("Select a person to assign."); return; }
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
    if (error) showError("Could not load the announcement.");
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
    if (error) showError("Could not save: " + error.message);
    else {
      setBannerActive(active);
      showSuccess(active ? "Announcement enabled." : "Announcement disabled.");
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
        <LoadingSpinner size={56} label="Checking access" />
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
  const pendingGpuCount = reservations.filter(r => r.status === 'pending' && new Date(r.end_time) > new Date()).length;
  const conflictsWithApproved = (target: any) => target.status === 'pending' && reservations.some(r =>
    r.id !== target.id && r.gpu_id === target.gpu_id && r.status === 'approved' &&
    new Date(r.start_time) < new Date(target.end_time) &&
    new Date(r.end_time) > new Date(target.start_time)
  );
  const matchesQuery = (...values: unknown[]) => values.some(value => String(value ?? '').toLocaleLowerCase().includes(deferredQuery.trim().toLocaleLowerCase()));
  const filteredReservations = reservations.filter(r => (!needsReviewOnly || (r.status === 'pending' && new Date(r.end_time) > new Date())) && (gpuFilter === 'all' || String(r.gpu_id) === gpuFilter) && (statusFilter === 'all' || (statusFilter === 'ended' ? new Date(r.end_time) <= new Date() : r.status === statusFilter)) && matchesQuery(r.profiles?.full_name, r.profiles?.student_id, r.gpu_id, r.purpose));
  const filteredProjects = cpuProjects.filter(p => (!needsReviewOnly || p.status === 'pending') && (statusFilter === 'all' || p.status === statusFilter) && matchesQuery(p.name, p.user_email, p.profiles?.full_name, p.profiles?.student_id));
  const filteredProfiles = profiles.filter(p => (!needsReviewOnly || p.is_approved !== true) && (statusFilter === 'all' || (statusFilter === 'unreviewed' ? p.is_approved == null : statusFilter === 'approved' ? p.is_approved === true : p.is_approved === false)) && (roleFilter === 'all' || (roleFilter === 'admin' ? p.is_admin === true : p.is_laser_cut_manager === true || p.is_wakeup_manager === true)) && matchesQuery(p.full_name, p.student_id, p.email));
  const sortRows = (rows: any[]) => [...rows].sort((a, b) => {
    if (sortOrder === 'name') return String(a.profiles?.full_name || a.full_name || a.name || '').localeCompare(String(b.profiles?.full_name || b.full_name || b.name || ''));
    if (sortOrder === 'oldest' || sortOrder === 'newest') return (Date.parse(a.created_at || '') - Date.parse(b.created_at || '') || 0) * (sortOrder === 'newest' ? -1 : 1);
    if (sortOrder === 'review') return Number(b.status === 'pending' || b.is_approved === false || b.is_approved === null) - Number(a.status === 'pending' || a.is_approved === false || a.is_approved === null);
    return 0;
  });
  const resultTotal = tab === 'gpu' ? filteredReservations.length : tab === 'server' ? filteredProjects.length : filteredProfiles.length;
  const pageCount = Math.max(1, Math.ceil(resultTotal / visibleLimit));
  const currentPage = Math.min(page, pageCount);
  const offset = (currentPage - 1) * visibleLimit;
  const visibleReservations = sortRows(filteredReservations).slice(offset, offset + visibleLimit);
  const visibleProjects = sortRows(filteredProjects).slice(offset, offset + visibleLimit);
  const visibleProfiles = sortRows(filteredProfiles).slice(offset, offset + visibleLimit);
  const hasList = tab === 'gpu' || tab === 'server' || tab === 'accounts';
  const resultCount = tab === 'gpu' ? filteredReservations.length : tab === 'server' ? filteredProjects.length : filteredProfiles.length;
  const listError = loadErrors[tab];
  const refreshList = async () => { if (tab === 'gpu') await fetchReservations(); else if (tab === 'server') await fetchCpuProjects(); else if (tab === 'accounts') await fetchProfiles(); setLastRefreshed(new Date()); };
  const listLoading = tab === 'gpu' ? gpuLoading : tab === 'server' ? cpuLoading : profilesLoading;

  return (
    <div className="admin-management space-y-10" data-density={density}>
      <section>
        <div className="page-heading">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Administration</h1>
            <p className="page-description">{tab === 'gpu' ? 'Review GPU requests, check conflicts and manage access.' : tab === 'server' ? 'Review deployments and inspect project configuration.' : tab === 'accounts' ? 'Find accounts, review access and manage permissions.' : tab === 'materials' ? 'Inspect storage usage and manage shared files.' : 'Assign equipment managers and maintain service access.'}</p>
          </div>

        </div>

        <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3" aria-label="Review queues">
          {([
            ['gpu', "Upcoming GPU requests", pendingGpuCount, gpuLoading],
            ['server', "Pending deployments", pendingCpuCount, cpuLoading],
            ['accounts', "Accounts requiring review", unreviewedCount, profilesLoading],
          ] as const).map(([target, label, count, loading]) => (
            <button key={target} type="button" onClick={() => selectTab(target, true)} className="rounded-2xl border bg-card p-3 sm:p-5 text-left transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary" aria-pressed={tab === target && needsReviewOnly}>
              <span className="block text-sm text-muted-foreground">{label}</span>
              <span className="mt-2 block text-2xl font-semibold tabular-nums">{loading ? "Checking…" : loadErrors[target] ? "Needs review" : `${count} items`}</span>
              <span className="mt-2 block text-xs text-muted-foreground">Review list →</span>
            </button>
          ))}
        </div>


        {hasList && <div className="surface admin-list-toolbar mb-5 p-4 sm:p-6 space-y-4">
          <div><h2 className="font-semibold text-lg">{tab === 'gpu' ? "GPU reservations" : tab === 'server' ? "Server deployments" : "Account access"}</h2><p className="text-xs text-muted-foreground leading-6 mt-1">{tab === 'gpu' ? "Review upcoming requests first. Conflicting reservations cannot be approved." : tab === 'server' ? "Review deployment settings and visibility before approval. Open project details to inspect its status." : "Verify names and student IDs, then approve or mark accounts for review. Deleting an account requires separate confirmation."}</p></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input type="search" aria-label="Search current list" placeholder={tab === 'server' ? "Search project name or email" : tab === 'accounts' ? "Search name, student ID or email" : "Search name, student ID, GPU or purpose"} value={query} onChange={e => { setQuery(e.target.value); setVisibleLimit(30); }} className="h-11 sm:max-w-md" />
            <Button variant={needsReviewOnly ? 'secondary' : 'outline'} className="min-h-11" aria-pressed={needsReviewOnly} onClick={() => { setNeedsReviewOnly(v => !v); setStatusFilter('all'); setVisibleLimit(30); }}>{tab === 'accounts' ? "Needs review only" : "Pending only"}</Button>
            {(query || needsReviewOnly || statusFilter !== 'all' || gpuFilter !== 'all' || roleFilter !== 'all') && <Button variant="ghost" className="min-h-11" onClick={resetFilters}>Clear filters</Button>}
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-xs font-semibold space-y-2"><span className="block">Status</span><select aria-label="Filter by status" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setNeedsReviewOnly(false); setVisibleLimit(30); }} className="block min-h-11 rounded-lg border bg-background px-3 text-sm"><option value="all">All statuses</option>{tab === 'accounts' ? <><option value="unreviewed">Unreviewed</option><option value="approved">Approved</option><option value="restricted">Restricted</option></> : <><option value="pending">Pending approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option>{tab === 'gpu' && <option value="ended">Ended</option>}</>}</select></label>
            {tab === 'gpu' && <label className="text-xs font-semibold space-y-2"><span className="block">GPU</span><select aria-label="Filter by GPU" value={gpuFilter} onChange={e => { setGpuFilter(e.target.value); setVisibleLimit(30); }} className="block min-h-11 rounded-lg border bg-background px-3 text-sm"><option value="all">All GPUs</option>{[1,2,3,4].map(id => <option key={id} value={String(id)}>GPU #{id}</option>)}</select></label>}
            {tab === 'accounts' && <label className="text-xs font-semibold space-y-2"><span className="block">Role</span><select aria-label="Filter by role" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setVisibleLimit(30); }} className="block min-h-11 rounded-lg border bg-background px-3 text-sm"><option value="all">All accounts</option><option value="admin">Administration</option><option value="manager">Laser and music managers</option></select></label>}
          <Button type="button" variant="outline" disabled={listLoading} onClick={refreshList} className="min-h-11 gap-2"><RefreshCw className={`size-4 ${listLoading ? 'animate-spin motion-reduce:animate-none' : ''}`} />{listLoading ? "Loading…" : "Refresh list"}</Button>
          </div>
          <div className="admin-list-options">
            <label>Sort<select aria-label="Sort records" value={sortOrder} onChange={e => setSortOrder(e.target.value)}><option value="default">Original order</option><option value="review">Needs review first</option><option value="name">Name A–Z</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
            <label>Rows per page<select aria-label="Rows per page" value={visibleLimit} onChange={e => setVisibleLimit(Number(e.target.value))}>{[15,30,60,100].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
            <label>Density<select aria-label="Table density" value={density} onChange={e => setDensity(e.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
            <span className="meta">{lastRefreshed ? `Refresh completed at ${lastRefreshed.toLocaleTimeString('en-US')}` : 'Use / to search this list'}</span>
          </div>
          {listError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm"><p className="font-semibold">{listError}</p><p className="mt-2 text-muted-foreground">Previously loaded records remain below. Refresh to try again.</p></div>}
          {Object.values(rowActions).some(Boolean) && <p role="status" className="text-sm text-primary">Saving changes and refreshing the list…</p>}
          <p role="status" className="text-sm text-muted-foreground">{listError ? "Could not refresh the list." : listLoading ? "Loading records…" : `${resultCount} results · ${resultCount ? offset + 1 : 0}–${Math.min(resultCount, offset + visibleLimit)} shown`}</p>
          {tab !== 'accounts' && <p className="text-xs text-muted-foreground">Search and counts cover the most recent 1,000 loaded records.</p>}
        </div>}

        {/* ── GPU 예약 탭 ── */}
        {tab === 'gpu' && (
          <div className="border rounded-3xl bg-card overflow-hidden shadow-sm">
            {/* 모바일: 가로 스크롤 없이 바로 승인/거절 — 카드 목록 */}
            <div className="md:hidden divide-y">
              {gpuLoading || gpuJustFinished ? (
                <div className="py-16 flex items-center justify-center"><LoadingSpinner done={gpuJustFinished} size={48} label="Loading reservations" /></div>
              ) : visibleReservations.length === 0 ? (
                <div className="text-center py-20 font-bold text-muted-foreground opacity-50">No reservations to display.</div>
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
                          <span className="font-black text-sm uppercase tracking-tight truncate">{res.profiles?.full_name || "Account unavailable"}</span>
                          <span className="text-[10px] text-muted-foreground font-bold opacity-70">{res.profiles?.student_id || res.user_email}</span>
                        </div>
                        <span className="font-black italic text-primary text-sm shrink-0">GPU #{res.gpu_id}</span>
                      </div>
                      <div className="bg-muted/50 px-3 py-2 rounded-xl border border-border/50 text-[11px] font-bold leading-tight">
                        {start.toLocaleString('en-US', dateOptions)}
                        <span className="opacity-30 mx-1">→</span>
                        {end.toLocaleString('en-US', dateOptions)}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          {res.status === 'pending'  && <Badge variant="warning" icon={<Clock className="size-3" />}>Pending</Badge>}
                          {hasConflict && <p className="mt-1 text-xs font-bold text-destructive">Conflicts with an approved reservation</p>}
                          {res.status === 'approved' && <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>Approved</Badge>}
                          {res.status === 'rejected' && <Badge variant="danger"  icon={<XCircle className="size-3" />}>Rejected</Badge>}
                        </div>
                        {isEnded ? (
                          <span className="text-[10px] font-black uppercase opacity-30">Session Finished</span>
                        ) : res.status === 'pending' ? (
                          <div className="flex gap-2">
                            <Button size="sm" disabled={hasConflict || rowActions['gpu:' + res.id]} title={hasConflict ? "Cannot approve overlapping reservations." : undefined} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" onClick={() => updateStatus(res.id, 'approved', res.gpu_id)}>Approve</Button>
                            <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" disabled={rowActions['gpu:' + res.id]} onClick={() => updateStatus(res.id, 'rejected')}>Reject</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" disabled={rowActions['gpu:' + res.id]} onClick={() => updateStatus(res.id, 'pending')}>
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
              <Table className="data-table">
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
                    <TableRow><TableCell colSpan={5} className="py-16"><div className="flex items-center justify-center"><LoadingSpinner done={gpuJustFinished} size={48} label="Loading reservations" /></div></TableCell></TableRow>
                  ) : visibleReservations.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 font-bold text-muted-foreground opacity-50">No reservations to display.</TableCell></TableRow>
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
                              <span className="font-black text-sm uppercase tracking-tight">{res.profiles?.full_name || "Account unavailable"}</span>
                              <span className="text-[10px] text-muted-foreground font-bold opacity-70">{res.profiles?.student_id || res.user_email}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-black italic text-primary">GPU #{res.gpu_id}</TableCell>
                          <TableCell className="text-[11px] font-bold leading-tight py-5">
                            <div className="bg-muted/50 px-3 py-2 rounded-xl inline-block border border-border/50">
                              {start.toLocaleString('en-US', dateOptions)} <br/>
                              <span className="opacity-30 mx-1">to</span> {end.toLocaleString('en-US', dateOptions)}
                            </div>
                          </TableCell>
                          <TableCell className="py-5">
                            {res.status === 'pending'  && <Badge variant="warning" icon={<Clock className="size-3" />}>Pending</Badge>}
                            {hasConflict && <p className="mt-1 text-xs font-bold text-destructive">Conflicts with an approved reservation</p>}
                            {res.status === 'approved' && <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>Approved</Badge>}
                            {res.status === 'rejected' && <Badge variant="danger"  icon={<XCircle className="size-3" />}>Rejected</Badge>}
                          </TableCell>
                          <TableCell className="text-right py-5 px-6">
                            <div className="flex justify-end gap-2">
                              {isEnded ? (
                                <span className="text-[10px] font-black uppercase opacity-30 px-4">Session Finished</span>
                              ) : res.status === 'pending' ? (
                                <>
                                  <Button size="sm" disabled={hasConflict || rowActions['gpu:' + res.id]} title={hasConflict ? "Cannot approve overlapping reservations." : undefined} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" onClick={() => updateStatus(res.id, 'approved', res.gpu_id)}>Approve</Button>
                                  <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" disabled={rowActions['gpu:' + res.id]} onClick={() => updateStatus(res.id, 'rejected')}>Reject</Button>
                                </>
                              ) : (
                                <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" disabled={rowActions['gpu:' + res.id]} onClick={() => updateStatus(res.id, 'pending')}>
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
                <div className="py-16 flex items-center justify-center"><LoadingSpinner done={cpuJustFinished} size={48} label="Loading projects" /></div>
              ) : visibleProjects.length === 0 ? (
                <div className="text-center py-20 font-bold text-muted-foreground opacity-50">No projects to display.</div>
              ) : (
                visibleProjects.map((proj) => (
                  <div key={proj.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="font-black text-sm uppercase tracking-tight truncate">{(proj.profiles as any)?.full_name || "Account unavailable"}</span>
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
                        <span>CPU: {proj.cpu_limit} / Mem: {formatMemoryLimit(proj.memory_limit)}</span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 flex-wrap">
                      <Link href={`/server/${proj.id}`}>
                        <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-3 rounded-xl border-2 transition-all active:scale-95 gap-1.5">
                          <Server className="size-3" />  Details
                        </Button>
                      </Link>
                      {proj.status === 'pending' && (
                        <>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" disabled={rowActions['server:' + proj.id]} onClick={() => updateCpuStatus(proj.id, 'approved')}>Approve</Button>
                          <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" disabled={rowActions['server:' + proj.id]} onClick={() => updateCpuStatus(proj.id, 'rejected')}>Reject</Button>
                        </>
                      )}
                      {(proj.status === 'approved' || proj.status === 'rejected') && (
                        <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" disabled={rowActions['server:' + proj.id]} onClick={() => updateCpuStatus(proj.id, 'pending')}>
                          <Undo2 className="size-3" /> Reset
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <Table className="data-table">
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
                    <TableRow><TableCell colSpan={5} className="py-16"><div className="flex items-center justify-center"><LoadingSpinner done={cpuJustFinished} size={48} label="Loading projects" /></div></TableCell></TableRow>
                  ) : visibleProjects.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 font-bold text-muted-foreground opacity-50">No projects to display.</TableCell></TableRow>
                  ) : (
                    visibleProjects.map((proj) => (
                      <TableRow key={proj.id} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                        <TableCell className="py-5 px-6">
                          <div className="flex flex-col">
                            <span className="font-black text-sm uppercase tracking-tight">{(proj.profiles as any)?.full_name || "Account unavailable"}</span>
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
                            <span>CPU: {proj.cpu_limit} / Mem: {formatMemoryLimit(proj.memory_limit)}</span>
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
                              <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-3 rounded-xl border-2 transition-all active:scale-95 gap-1.5">
                                <Server className="size-3" />  Details
                              </Button>
                            </Link>
                            {proj.status === 'pending' && (
                              <>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" disabled={rowActions['server:' + proj.id]} onClick={() => updateCpuStatus(proj.id, 'approved')}>Approve</Button>
                                <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" disabled={rowActions['server:' + proj.id]} onClick={() => updateCpuStatus(proj.id, 'rejected')}>Reject</Button>
                              </>
                            )}
                            {proj.status === 'approved' && (
                              <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" disabled={rowActions['server:' + proj.id]} onClick={() => updateCpuStatus(proj.id, 'pending')}>
                                <Undo2 className="size-3" /> Reset
                              </Button>
                            )}
                            {proj.status === 'rejected' && (
                              <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" disabled={rowActions['server:' + proj.id]} onClick={() => updateCpuStatus(proj.id, 'pending')}>
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
                <div className="py-16 flex items-center justify-center"><LoadingSpinner done={profilesJustFinished} size={48} label="Loading accounts" /></div>
              ) : visibleProfiles.length === 0 ? (
                <div className="text-center py-20 font-bold text-muted-foreground opacity-50">No accounts to display.</div>
              ) : (
                visibleProfiles.map((p) => (
                  <div key={p.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-black text-sm uppercase tracking-tight truncate">{p.full_name || "Name not provided"}</span>
                        {p.is_admin && <Badge variant="warning">Admin</Badge>}
                        {p.is_laser_cut_manager && <Badge variant="default">Laser manager</Badge>}
                      </div>
                      <span className="text-sm font-bold shrink-0">{p.student_id || '-'}</span>
                    </div>
                    {p.email && <p className="text-xs text-muted-foreground break-all">{p.email}</p>}
                    {rowActions['account:' + p.id] && <p role="status" className="text-xs text-primary">Updating account…</p>}
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        {p.is_approved === false && <Badge variant="danger" icon={<XCircle className="size-3" />}>Restricted</Badge>}
                        {p.is_approved === null && <Badge variant="warning" icon={<HelpCircle className="size-3" />}>Unreviewed</Badge>}
                        {p.is_approved === true && <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>Approved</Badge>}
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {p.is_approved !== true && (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" disabled={rowActions['account:' + p.id]} onClick={() => setProfileApproval(p.id, true)}>

                            Approve
                          </Button>
                        )}
                        {p.is_approved !== false && (
                          <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" disabled={rowActions['account:' + p.id]} onClick={() => setProfileApproval(p.id, false)}>

                            Mark for review
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-3 rounded-xl border-2 border-destructive/30 text-destructive hover:bg-destructive/10 transition-all active:scale-95 gap-1.5" disabled={rowActions['account:' + p.id]} aria-label={`${p.full_name || p.student_id || "Selected account"} Delete`} onClick={() => setDeleteTarget({ id: p.id, name: p.full_name || p.student_id || "Account unavailable" })}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <Table className="data-table">
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
                    <TableRow><TableCell colSpan={4} className="py-16"><div className="flex items-center justify-center"><LoadingSpinner done={profilesJustFinished} size={48} label="Loading accounts" /></div></TableCell></TableRow>
                  ) : visibleProfiles.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 font-bold text-muted-foreground opacity-50">No accounts to display.</TableCell></TableRow>
                  ) : (
                    visibleProfiles.map((p) => (
                      <TableRow key={p.id} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                        <TableCell className="py-5 px-6">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm uppercase tracking-tight">{p.full_name || "Name not provided"}</span>
                            {p.is_admin && <Badge variant="warning">Admin</Badge>}
                            {p.is_laser_cut_manager && <Badge variant="default">Laser manager</Badge>}
                          </div>
                          {p.email && <p className="mt-2 text-xs text-muted-foreground break-all">{p.email}</p>}
                          {rowActions['account:' + p.id] && <p role="status" className="mt-2 text-xs text-primary">Updating…</p>}
                        </TableCell>
                        <TableCell className="text-sm font-bold">{p.student_id || '-'}</TableCell>
                        <TableCell className="py-5">
                          {p.is_approved === false && <Badge variant="danger" icon={<XCircle className="size-3" />}>Restricted</Badge>}
                          {p.is_approved === null && <Badge variant="warning" icon={<HelpCircle className="size-3" />}>Unreviewed</Badge>}
                          {p.is_approved === true && <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>Approved</Badge>}
                        </TableCell>
                        <TableCell className="text-right py-5 px-6">
                          <div className="flex justify-end gap-2 flex-wrap">
                            {p.is_approved !== true && (
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" disabled={rowActions['account:' + p.id]} onClick={() => setProfileApproval(p.id, true)}>

                                Approve
                              </Button>
                            )}
                            {p.is_approved !== false && (
                              <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" disabled={rowActions['account:' + p.id]} onClick={() => setProfileApproval(p.id, false)}>

                                Mark for review
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-3 rounded-xl border-2 border-destructive/30 text-destructive hover:bg-destructive/10 transition-all active:scale-95 gap-1.5" disabled={rowActions['account:' + p.id]} aria-label={`${p.full_name || p.student_id || "Selected account"} Delete`} onClick={() => setDeleteTarget({ id: p.id, name: p.full_name || p.student_id || "Account unavailable" })}>
                              <Trash2 className="size-3" />  Delete
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
              <div className="flex justify-center py-16"><LoadingSpinner size={48} label="Loading" /></div>
            ) : (
              <>
                <div>
                  <h2 className="font-black uppercase text-sm tracking-widest mb-1 flex items-center gap-1.5"><Printer className="size-4" />  3D printer managers</h2>
                  <p className="text-xs text-muted-foreground font-bold opacity-60 mb-4">

                    Select a printer and assign its managers. Managers can start and finish jobs and report faults for that printer.
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
                            <p className="text-xs text-muted-foreground opacity-50">No managers assigned</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {assigned.map(a => (
                                <span key={a.user_id} className="inline-flex items-center gap-1.5 bg-muted/50 rounded-full pl-3 pr-1.5 py-1 text-xs font-bold">
                                  {a.profiles?.full_name || "Account unavailable"} <span className="text-muted-foreground opacity-60">({a.profiles?.student_id || '-'})</span>
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
                              <Plus className="size-3.5" />  Add
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h2 className="font-black uppercase text-sm tracking-widest mb-3 flex items-center gap-1.5"><Scissors className="size-4" />  Laser cutting managers</h2>
                  <div className="border-2 rounded-2xl bg-card p-5 space-y-3 max-w-xl">
                    {laserManagers.length === 0 ? (
                      <p className="text-xs text-muted-foreground opacity-50">No managers assigned</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {laserManagers.map(m => (
                          <span key={m.id} className="inline-flex items-center gap-1.5 bg-muted/50 rounded-full pl-3 pr-1.5 py-1 text-xs font-bold">
                            {m.full_name || "Account unavailable"} <span className="text-muted-foreground opacity-60">({m.student_id || '-'})</span>
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
                        <Plus className="size-3.5" />  Add
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {hasList && !listLoading && <nav className="admin-pagination" aria-label="Record pages"><span className="meta">{resultCount} results · Page {currentPage} of {pageCount}</span><div><Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button variant="outline" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button></div></nav>}

        <div className="mt-10 border-t pt-8"><h2 className="mb-4 text-lg font-semibold">Service settings</h2>
        {/* 자주 사용하지 않는 설정은 필요할 때 펼친다. */}
        <details className="mb-4 rounded-2xl border bg-card p-5 space-y-4">
          <summary className="min-h-11 cursor-pointer font-semibold list-inside">

            Wake-up music managers
          </summary>
          <div className="flex items-center gap-2 sr-only">
            <Music className="size-5 text-primary" />
            <h2 className="font-black uppercase text-sm tracking-widest">Wake-up music managers</h2>
          </div>
          <div className="flex gap-2">
            <PersonSearchSelect
              candidates={allProfiles.filter(p => !wakeupManagers.some(m => m.id === p.id))}
              value={addWakeupManagerSelect}
              onChange={setAddWakeupManagerSelect}
            />
            <Button onClick={addWakeupManager}>Add</Button>
          </div>
          {wakeupManagers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {wakeupManagers.map(m => (
                <span key={m.id} className="flex items-center gap-1 bg-muted rounded-full pl-3 pr-1.5 py-1 text-xs font-bold">
                  {m.full_name || "Account unavailable"} <span className="text-muted-foreground opacity-60">({m.student_id || '-'})</span>
                  <button aria-label={`${m.full_name || "User"} Remove manager`} onClick={() => toggleWakeupManager(m.id, true)} className="ml-1 flex items-center justify-center size-11 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </details>

        <details className="mb-8 rounded-2xl border bg-card p-5 space-y-4">
          <summary className="min-h-11 cursor-pointer font-semibold list-inside">Site announcement <span className="ml-2 text-sm font-normal text-muted-foreground">{bannerLoading ? "Checking" : bannerActive ? "Enabled" : "Disabled"}</span></summary>
          {bannerLoading ? (
            <div className="flex items-center justify-center py-8"><LoadingSpinner size={40} label="Loading announcement" /></div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Megaphone className="size-5 text-primary" />
                <h2 className="font-black uppercase text-sm tracking-widest">Site announcement</h2>
                {bannerActive && (
                  <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>Enabled</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-medium">

                When enabled, this announcement appears at the top of the user website for all visitors.
              </p>
              <textarea
                aria-label="Announcement message"
                value={bannerMessage}
                onChange={(e) => setBannerMessage(e.target.value)}
                placeholder="For example: Scheduled maintenance on July 10, 03:00–05:00."
                rows={3}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest gap-1.5"
                  disabled={bannerSaving || !bannerMessage.trim()}
                  onClick={() => saveBanner(true)}
                >
                  <Megaphone className="size-3.5" />  Save and enable
                </Button>
                <Button
                  variant="outline"
                  className="font-black text-xs uppercase tracking-widest"
                  disabled={bannerSaving || !bannerActive}
                  onClick={() => saveBanner(false)}
                >

                  Disable
                </Button>
              </div>
            </>
          )}
        </details>

        </div>
      </section>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this account?"
        description={`${deleteTarget?.name ?? ''} will lose their name, student ID and profile image and will no longer be able to sign in. This cannot be undone.`}
        confirmLabel={isDeletingUser ? "Deleting…" : "Delete account"}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

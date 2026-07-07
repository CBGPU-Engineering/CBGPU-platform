'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAlert } from '@/lib/alert';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { ShieldAlert, CheckCircle2, XCircle, Clock, Undo2, KeyRound, Server, Container, GitBranch, Globe, School, Lock, Users, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';

type AdminTab = 'gpu' | 'server' | 'accounts';

export default function AdminPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [tab, setTab] = useState<AdminTab>('gpu');
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

  function generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(x => chars[x % chars.length]).join('');
  }

  async function updateStatus(id: string, newStatus: 'approved' | 'rejected' | 'pending', gpuId?: number) {
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
      const password = generatePassword();
      const { error: gpuError } = await supabase.from('gpus').upsert({ id: gpuId, password }, { onConflict: 'id' });
      if (gpuError) { showError("비밀번호 생성 실패: " + gpuError.message); return; }
    }
    const { error } = await supabase.from('reservations').update({ status: newStatus }).eq('id', id);
    if (error) showError("처리 실패: " + error.message);
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

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, student_id, full_name, is_admin, is_approved')
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

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchReservations();
      fetchCpuProjects();
      fetchProfiles();
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

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <section>
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter italic uppercase">Admin Control</h1>
            <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest opacity-60">Review and manage requests</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/study">
              <Button variant="outline" className="font-black text-xs uppercase tracking-widest gap-1.5">
                <KeyRound className="size-3.5" /> 자습신청 토큰 관리
              </Button>
            </Link>
          </div>
        </div>

        {/* 탭 전환 */}
        <div className="mb-6">
          <SegmentedTabs
            items={[
              { value: 'gpu',      label: 'GPU 예약' },
              { value: 'server',   label: `서버 배포${pendingCpuCount > 0 ? ` (${pendingCpuCount})` : ''}` },
              { value: 'accounts', label: `계정${unreviewedCount > 0 ? ` (${unreviewedCount})` : ''}` },
            ]}
            value={tab}
            onChange={v => setTab(v as AdminTab)}
          />
        </div>

        {/* ── GPU 예약 탭 ── */}
        {tab === 'gpu' && (
          <div className="border-2 rounded-3xl bg-card overflow-hidden shadow-2xl transition-all">
            <div className="overflow-x-auto">
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
                  ) : reservations.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 font-bold text-muted-foreground opacity-50">No pending requests found.</TableCell></TableRow>
                  ) : (
                    reservations.map((res) => {
                      const start = new Date(res.start_time);
                      const end = new Date(res.end_time);
                      const isEnded = new Date() > end;
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
                            {res.status === 'approved' && <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>Approved</Badge>}
                            {res.status === 'rejected' && <Badge variant="danger"  icon={<XCircle className="size-3" />}>Rejected</Badge>}
                          </TableCell>
                          <TableCell className="text-right py-5 px-6">
                            <div className="flex justify-end gap-2">
                              {isEnded ? (
                                <span className="text-[10px] font-black uppercase opacity-30 px-4">Session Finished</span>
                              ) : res.status === 'pending' ? (
                                <>
                                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase h-8 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" onClick={() => updateStatus(res.id, 'approved', res.gpu_id)}>Approve</Button>
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
          <div className="border-2 rounded-3xl bg-card overflow-hidden shadow-2xl transition-all">
            <div className="overflow-x-auto">
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
                  ) : cpuProjects.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 font-bold text-muted-foreground opacity-50">No server projects found.</TableCell></TableRow>
                  ) : (
                    cpuProjects.map((proj) => (
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
          <div className="border-2 rounded-3xl bg-card overflow-hidden shadow-2xl transition-all">
            <div className="overflow-x-auto">
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
                  ) : profiles.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 font-bold text-muted-foreground opacity-50">No accounts found.</TableCell></TableRow>
                  ) : (
                    profiles.map((p) => (
                      <TableRow key={p.id} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                        <TableCell className="py-5 px-6">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm uppercase tracking-tight">{p.full_name || 'Unknown'}</span>
                            {p.is_admin && <Badge variant="warning">Admin</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-bold">{p.student_id || '-'}</TableCell>
                        <TableCell className="py-5">
                          {p.is_approved === false && <Badge variant="danger" icon={<XCircle className="size-3" />}>제한됨</Badge>}
                          {p.is_approved === null && <Badge variant="warning" icon={<HelpCircle className="size-3" />}>미검토</Badge>}
                          {p.is_approved === true && <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>승인됨</Badge>}
                        </TableCell>
                        <TableCell className="text-right py-5 px-6">
                          <div className="flex justify-end gap-2">
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
      </section>
    </div>
  );
}

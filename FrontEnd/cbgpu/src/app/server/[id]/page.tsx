'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/spinner';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, RotateCcw, Trash2, Globe, School, Lock,
  Container, GitBranch, Cpu, MemoryStick, Plus, ExternalLink,
  CheckCircle2, Clock, XCircle,
} from 'lucide-react';

const labelCls = "text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block";
const inputCls = "h-9 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm font-bold outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 transition-colors";

type Runtime = 'node20' | 'node18' | 'python311' | 'python39';
type AccessScope = 'private' | 'school' | 'public';

const RUNTIMES: { value: Runtime; label: string }[] = [
  { value: 'node20',    label: 'Node.js 20' },
  { value: 'node18',    label: 'Node.js 18' },
  { value: 'python311', label: 'Python 3.11' },
  { value: 'python39',  label: 'Python 3.9' },
];

const MEMORY_OPTS = ['128m', '256m', '512m', '1g', '2g', '4g'] as const;
type MemoryLimit = typeof MEMORY_OPTS[number];

type EnvEntry = { key: string; value: string };

interface RedeployForm {
  dockerImage: string;
  gitBranch: string;
  runtime: Runtime;
  runCommand: string;
  containerPort: string;
  hostPort: string;
  accessScope: AccessScope;
  cpuLimit: string;
  memoryLimit: string;
  envVars: EnvEntry[];
}

export default function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [redeployOpen, setRedeployOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<RedeployForm | null>(null);

  const fetchProject = async () => {
    const { data, error } = await supabase
      .from('cpu_projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error) { showError('프로젝트를 찾을 수 없습니다.'); router.push('/server'); return; }
    setProject(data);
    setLoading(false);
  };

  useEffect(() => {
    if (id) fetchProject();
  }, [id]);

  const openRedeploy = () => {
    if (!project) return;
    const envEntries: EnvEntry[] = Object.entries(project.env_vars || {}).map(([k, v]) => ({ key: k, value: String(v) }));
    setForm({
      dockerImage:   project.docker_image || '',
      gitBranch:     project.git_branch || 'main',
      runtime:       project.runtime || 'node20',
      runCommand:    project.run_command || '',
      containerPort: String(project.container_port || 80),
      hostPort:      String(project.host_port),
      accessScope:   project.access_scope || 'private',
      cpuLimit:      project.cpu_limit || '1',
      memoryLimit:   project.memory_limit || '512m',
      envVars:       envEntries,
    });
    setRedeployOpen(true);
  };

  const set = <K extends keyof RedeployForm>(key: K, val: RedeployForm[K]) =>
    setForm(f => f ? { ...f, [key]: val } : f);

  const addEnvVar = () => form && set('envVars', [...form.envVars, { key: '', value: '' }]);
  const removeEnvVar = (i: number) => form && set('envVars', form.envVars.filter((_, idx) => idx !== i));
  const updateEnvVar = (i: number, field: 'key' | 'value', val: string) =>
    form && set('envVars', form.envVars.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const handleRedeploy = async () => {
    if (!form || !project) return;
    const hostPort = parseInt(form.hostPort);
    const containerPort = parseInt(form.containerPort);
    if (isNaN(hostPort)) { showError('포트는 숫자여야 합니다.'); return; }

    const envVarsObj: Record<string, string> = {};
    for (const e of form.envVars) {
      if (e.key.trim()) envVarsObj[e.key.trim()] = e.value;
    }

    setSubmitting(true);
    const updates: Record<string, any> = {
      container_port:     containerPort,
      host_port:          hostPort,
      access_scope:       form.accessScope,
      cpu_limit:          form.cpuLimit || '1',
      memory_limit:       form.memoryLimit || '512m',
      env_vars:           envVarsObj,
      deploy_requested_at: new Date().toISOString(),
    };

    if (project.deploy_type === 'docker') {
      if (!form.dockerImage.trim()) { showError('이미지를 입력해주세요.'); setSubmitting(false); return; }
      updates.docker_image = form.dockerImage.trim();
    } else {
      updates.git_branch  = form.gitBranch.trim() || 'main';
      updates.runtime     = form.runtime;
      updates.run_command = form.runCommand.trim();
    }

    const { error } = await supabase.from('cpu_projects').update(updates).eq('id', project.id);
    setSubmitting(false);

    if (error) {
      if (error.code === '23505') showError('이미 사용 중인 포트입니다.');
      else showError('재배포 요청 실패: ' + error.message);
    } else {
      showSuccess('재배포가 요청됐습니다. 잠시 후 적용됩니다.');
      setRedeployOpen(false);
      fetchProject();
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    const { error } = await supabase
      .from('cpu_projects')
      .update({ status: 'deleted' })
      .eq('id', project.id);
    if (error) showError('삭제 실패: ' + error.message);
    else {
      showSuccess('프로젝트가 삭제됐습니다.');
      router.push('/server');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size={56} label="프로젝트 불러오는 중" />
      </div>
    );
  }

  if (!project) return null;

  const isOwner = user?.id === project.user_id;
  const canManage = isOwner || isAdmin;
  const isRunning = project.status === 'approved' && project.deployed_at;
  const serverUrl = `http://[서버IP]:${project.host_port}`;

  const STATUS_INFO: Record<string, { icon: React.ReactNode; variant: any; label: string }> = {
    pending:  { icon: <Clock className="size-4" />,         variant: 'warning', label: 'Pending — 관리자 승인 대기 중' },
    approved: { icon: <CheckCircle2 className="size-4" />,  variant: 'success', label: isRunning ? 'Running' : 'Approved — 배포 준비 중' },
    rejected: { icon: <XCircle className="size-4" />,       variant: 'danger',  label: 'Rejected' },
    deleted:  { icon: <Trash2 className="size-4" />,        variant: 'muted',   label: 'Deleted' },
  };
  const statusInfo = STATUS_INFO[project.status] || { icon: null, variant: 'default', label: project.status };

  const envEntries = Object.entries(project.env_vars || {}) as [string, string][];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-2xl">
      {/* 헤더 */}
      <div>
        <button
          onClick={() => router.push('/server')}
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-3" /> Back to Projects
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-3xl font-black tracking-tighter italic uppercase">{project.name}</h1>
              <Badge variant={statusInfo.variant as any} icon={statusInfo.icon}>{statusInfo.label}</Badge>
              {isRunning && <span className="size-2 rounded-full bg-emerald-500 animate-pulse inline-block" />}
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground font-bold opacity-70">{project.description}</p>
            )}
          </div>

          {canManage && project.status !== 'deleted' && (
            <div className="flex items-center gap-2 shrink-0">
              {project.status === 'approved' && (
                <Button
                  variant="outline"
                  className="font-black text-[10px] uppercase gap-1.5 h-9"
                  onClick={openRedeploy}
                >
                  <RotateCcw className="size-3.5" /> 재배포
                </Button>
              )}
              <Button
                variant="destructive"
                className="font-black text-[10px] uppercase gap-1.5 h-9"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-3.5" /> 삭제
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 접근 정보 — 실행 중일 때만 */}
      {isRunning && (
        <div className="p-5 rounded-2xl bg-emerald-500/5 border-2 border-emerald-500/20">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3">Access</p>
          <div className="flex items-center gap-2">
            <code className="text-sm font-black text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-lg">
              {serverUrl}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-emerald-600"
              onClick={() => window.open(serverUrl, '_blank')}
            >
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 opacity-60">
            {project.access_scope === 'private' && '※ Tailscale VPN 연결 시에만 접근 가능합니다'}
            {project.access_scope === 'school'  && '※ 교내 네트워크 또는 Tailscale VPN에서 접근 가능합니다'}
            {project.access_scope === 'public'  && '※ 인터넷 어디서나 접근 가능합니다'}
          </p>
        </div>
      )}

      {/* 설정 정보 */}
      <div className="border-2 rounded-3xl overflow-hidden bg-card">
        <div className="px-6 py-4 border-b-2 bg-muted/20">
          <p className="font-black uppercase tracking-widest text-xs">Configuration</p>
        </div>
        <div className="p-6 grid gap-5">
          {/* 배포 방식 */}
          <div>
            <label className={labelCls}>Deploy Type</label>
            <div className="flex items-center gap-2">
              {project.deploy_type === 'docker'
                ? <Container className="size-4 text-muted-foreground" />
                : <GitBranch className="size-4 text-muted-foreground" />}
              <span className="font-bold text-sm uppercase">{project.deploy_type}</span>
            </div>
          </div>

          {project.deploy_type === 'docker' ? (
            <div>
              <label className={labelCls}>Docker Image</label>
              <code className="font-bold text-sm">{project.docker_image}</code>
            </div>
          ) : (
            <>
              <div>
                <label className={labelCls}>Git Repository</label>
                <a
                  href={project.git_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {project.git_url} <ExternalLink className="size-3" />
                </a>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Branch</label>
                  <span className="font-bold text-sm">{project.git_branch || 'main'}</span>
                </div>
                <div>
                  <label className={labelCls}>Runtime</label>
                  <span className="font-bold text-sm">{RUNTIMES.find(r => r.value === project.runtime)?.label || project.runtime}</span>
                </div>
                <div>
                  <label className={labelCls}>Run Command</label>
                  <code className="font-bold text-xs">{project.run_command || '—'}</code>
                </div>
              </div>
            </>
          )}

          {/* 포트 */}
          <div>
            <label className={labelCls}>Port Mapping</label>
            <code className="font-bold text-sm">{project.host_port}:{project.container_port}</code>
            <span className="text-[10px] text-muted-foreground ml-2 opacity-60">(host:container)</span>
          </div>

          {/* 접근 범위 */}
          <div>
            <label className={labelCls}>Access Scope</label>
            <div className="flex items-center gap-1.5">
              {project.access_scope === 'private' && <Lock className="size-3.5 text-muted-foreground" />}
              {project.access_scope === 'school'  && <School className="size-3.5 text-blue-500" />}
              {project.access_scope === 'public'  && <Globe className="size-3.5 text-green-500" />}
              <span className="font-bold text-sm capitalize">{project.access_scope}</span>
            </div>
          </div>

          {/* 리소스 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>CPU Limit</label>
              <div className="flex items-center gap-1.5">
                <Cpu className="size-3.5 text-muted-foreground" />
                <span className="font-bold text-sm">{project.cpu_limit} core(s)</span>
              </div>
            </div>
            <div>
              <label className={labelCls}>Memory Limit</label>
              <div className="flex items-center gap-1.5">
                <MemoryStick className="size-3.5 text-muted-foreground" />
                <span className="font-bold text-sm">{project.memory_limit}</span>
              </div>
            </div>
          </div>

          {/* 환경변수 */}
          {envEntries.length > 0 && (
            <div>
              <label className={labelCls}>Environment Variables</label>
              <div className="space-y-1.5">
                {envEntries.map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-1.5 font-mono text-xs">
                    <span className="font-black text-primary">{k}</span>
                    <span className="text-muted-foreground">=</span>
                    <span className="opacity-70">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 타임스탬프 */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/40">
            <div>
              <label className={labelCls}>Created</label>
              <span className="text-xs font-bold text-muted-foreground">
                {new Date(project.created_at).toLocaleString('ko-KR')}
              </span>
            </div>
            {project.deployed_at && (
              <div>
                <label className={labelCls}>Last Deployed</label>
                <span className="text-xs font-bold text-muted-foreground">
                  {new Date(project.deployed_at).toLocaleString('ko-KR')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 재배포 다이얼로그 */}
      <Dialog open={redeployOpen} onOpenChange={setRedeployOpen}>
        <DialogContent className="max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tighter italic text-xl">Redeploy</DialogTitle>
            <DialogDescription className="text-xs font-bold opacity-60">
              설정을 변경하고 재배포합니다. 잠시 다운타임이 발생합니다.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-5 py-2">
              {project.deploy_type === 'docker' ? (
                <div>
                  <label className={labelCls}>Docker Image</label>
                  <Input
                    placeholder="nginx:latest"
                    value={form.dockerImage}
                    onChange={e => set('dockerImage', e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Branch</label>
                      <Input placeholder="main" value={form.gitBranch} onChange={e => set('gitBranch', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Runtime</label>
                      <Select value={form.runtime} onValueChange={v => set('runtime', v as Runtime)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RUNTIMES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Run Command</label>
                    <Input
                      placeholder="npm start"
                      value={form.runCommand}
                      onChange={e => set('runCommand', e.target.value)}
                    />
                  </div>
                </div>
              )}

              <hr className="border-border/40" />

              <div>
                <label className={labelCls}>Port Mapping</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Host Port</p>
                    <Input type="number" value={form.hostPort} onChange={e => set('hostPort', e.target.value)} />
                  </div>
                  <span className="text-muted-foreground font-black mt-5">:</span>
                  <div className="flex-1">
                    <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Container Port</p>
                    <Input type="number" value={form.containerPort} onChange={e => set('containerPort', e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>Access Scope</label>
                <SegmentedTabs
                  items={[
                    { value: 'private', label: 'Private' },
                    { value: 'school',  label: 'School'  },
                    { value: 'public',  label: 'Public'  },
                  ]}
                  value={form.accessScope}
                  onChange={v => set('accessScope', v as AccessScope)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>CPU Cores</label>
                  <Input placeholder="1" value={form.cpuLimit} onChange={e => set('cpuLimit', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Memory</label>
                  <Select value={form.memoryLimit} onValueChange={v => set('memoryLimit', v as MemoryLimit)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMORY_OPTS.map(m => (
                        <SelectItem key={m} value={m}>
                          {m.endsWith('g') ? `${m.slice(0, -1)} GB` : `${m.slice(0, -1)} MB`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <hr className="border-border/40" />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Environment Variables</label>
                  <Button variant="ghost" size="sm" onClick={addEnvVar} className="h-6 px-2 text-[10px] font-black uppercase gap-1">
                    <Plus className="size-3" /> Add
                  </Button>
                </div>
                {form.envVars.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground opacity-50">환경변수 없음</p>
                ) : (
                  <div className="space-y-2">
                    {form.envVars.map((e, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input placeholder="KEY" value={e.key} onChange={ev => updateEnvVar(i, 'key', ev.target.value)} className="flex-1 font-mono text-xs" />
                        <Input placeholder="VALUE" value={e.value} onChange={ev => updateEnvVar(i, 'value', ev.target.value)} className="flex-1 font-mono text-xs" />
                        <button onClick={() => removeEnvVar(i)} className="text-muted-foreground hover:text-destructive transition-colors text-lg leading-none px-1">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-black uppercase text-[10px]" onClick={() => setRedeployOpen(false)}>취소</Button>
            <Button className="font-black uppercase text-[10px]" onClick={handleRedeploy} disabled={submitting}>
              {submitting ? '요청 중...' : '재배포'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tighter italic">
              <Trash2 className="size-5 text-destructive" /> 프로젝트 삭제
            </DialogTitle>
            <DialogDescription className="text-sm font-bold pt-1">
              컨테이너가 종료되고 프로젝트가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-black uppercase text-[10px]" onClick={() => setDeleteOpen(false)}>취소</Button>
            <Button variant="destructive" className="font-black uppercase text-[10px]" onClick={handleDelete}>삭제하기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

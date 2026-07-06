'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/spinner';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import {
  Plus, Server, Globe, School, Lock, RefreshCw,
  Container, GitBranch, ChevronRight, ShieldAlert,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

type DeployType = 'docker' | 'git';
type AccessScope = 'private' | 'school' | 'public';
type Runtime = 'node20' | 'node18' | 'python311' | 'python39';

const RUNTIMES: { value: Runtime; label: string }[] = [
  { value: 'node20',    label: 'Node.js 20' },
  { value: 'node18',    label: 'Node.js 18' },
  { value: 'python311', label: 'Python 3.11' },
  { value: 'python39',  label: 'Python 3.9' },
];

const STATUS_BADGE: Record<string, { variant: any; label: string }> = {
  pending:  { variant: 'warning',  label: 'Pending'  },
  approved: { variant: 'success',  label: 'Approved' },
  rejected: { variant: 'danger',   label: 'Rejected' },
  deleted:  { variant: 'muted',    label: 'Deleted'  },
};

const SCOPE_ICON: Record<AccessScope, React.ReactNode> = {
  private: <Lock   className="size-3" />,
  school:  <School className="size-3" />,
  public:  <Globe  className="size-3" />,
};

type EnvEntry = { key: string; value: string };

interface FormState {
  name: string;
  description: string;
  deployType: DeployType;
  dockerImage: string;
  gitUrl: string;
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

const DEFAULT_FORM: FormState = {
  name: '',
  description: '',
  deployType: 'docker',
  dockerImage: '',
  gitUrl: '',
  gitBranch: 'main',
  runtime: 'node20',
  runCommand: '',
  containerPort: '80',
  hostPort: '',
  accessScope: 'private',
  cpuLimit: '1',
  memoryLimit: '512m',
  envVars: [],
};

const inputCls = "h-9 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm font-bold outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 transition-colors";
const labelCls = "text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block";

export default function ServerPage() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const fetchProjects = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('cpu_projects')
      .select('*')
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });
    if (error) showError('프로젝트 목록 로드 실패: ' + error.message);
    else setProjects(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && user) fetchProjects();
  }, [authLoading, user]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const addEnvVar = () => set('envVars', [...form.envVars, { key: '', value: '' }]);
  const removeEnvVar = (i: number) => set('envVars', form.envVars.filter((_, idx) => idx !== i));
  const updateEnvVar = (i: number, field: 'key' | 'value', val: string) =>
    set('envVars', form.envVars.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const handleSubmit = async () => {
    if (!user) return;
    if (!form.name.trim()) { showError('프로젝트 이름을 입력해주세요.'); return; }
    if (form.deployType === 'docker' && !form.dockerImage.trim()) { showError('Docker 이미지를 입력해주세요.'); return; }
    if (form.deployType === 'git' && !form.gitUrl.trim()) { showError('Git 저장소 URL을 입력해주세요.'); return; }
    if (!form.hostPort.trim()) { showError('호스트 포트를 입력해주세요.'); return; }

    const hostPort = parseInt(form.hostPort);
    const containerPort = parseInt(form.containerPort);
    if (isNaN(hostPort) || hostPort < 1 || hostPort > 65535) { showError('포트는 1~65535 사이 숫자여야 합니다.'); return; }
    if (isNaN(containerPort) || containerPort < 1 || containerPort > 65535) { showError('컨테이너 포트는 1~65535 사이 숫자여야 합니다.'); return; }

    const envVarsObj: Record<string, string> = {};
    for (const e of form.envVars) {
      if (e.key.trim()) envVarsObj[e.key.trim()] = e.value;
    }

    setSubmitting(true);
    const { error } = await supabase.from('cpu_projects').insert({
      user_id:        user.id,
      user_email:     user.email,
      name:           form.name.trim(),
      description:    form.description.trim(),
      deploy_type:    form.deployType,
      docker_image:   form.deployType === 'docker' ? form.dockerImage.trim() : null,
      git_url:        form.deployType === 'git' ? form.gitUrl.trim() : null,
      git_branch:     form.deployType === 'git' ? (form.gitBranch.trim() || 'main') : null,
      runtime:        form.deployType === 'git' ? form.runtime : null,
      run_command:    form.deployType === 'git' ? form.runCommand.trim() : null,
      container_port: containerPort,
      host_port:      hostPort,
      access_scope:   form.accessScope,
      cpu_limit:      form.cpuLimit.trim() || '1',
      memory_limit:   form.memoryLimit.trim() || '512m',
      env_vars:       envVarsObj,
    });
    setSubmitting(false);

    if (error) {
      if (error.code === '23505') showError('이미 사용 중인 포트입니다.');
      else showError('프로젝트 생성 실패: ' + error.message);
    } else {
      showSuccess('프로젝트가 신청됐습니다. 관리자 승인을 기다려주세요.');
      setOpen(false);
      setForm(DEFAULT_FORM);
      fetchProjects();
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size={56} label="인증 확인 중" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in duration-700">
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

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter italic uppercase">Server Deploy</h1>
          <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest opacity-60">
            남는 CPU 자원으로 가벼운 서버를 배포하세요
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8" onClick={fetchProjects} title="새로고침">
            <RefreshCw className="size-3.5" />
          </Button>
          <Button
            className="font-black text-[10px] uppercase tracking-widest gap-1.5 h-9"
            onClick={() => setOpen(true)}
          >
            <Plus className="size-3.5" /> 새 프로젝트
          </Button>
        </div>
      </div>

      {/* 프로젝트 목록 */}
      {loading ? (
        <div className="py-16 flex items-center justify-center">
          <LoadingSpinner size={48} label="프로젝트 불러오는 중" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed rounded-3xl text-muted-foreground bg-muted/10 pop-in-3d">
          <Server className="size-12 mx-auto mb-4 opacity-20" />
          <p className="font-black uppercase tracking-widest text-sm opacity-50">배포된 프로젝트가 없습니다</p>
          <p className="text-xs mt-2 opacity-40">상단 버튼으로 새 프로젝트를 신청하세요</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map(proj => {
            const badge = STATUS_BADGE[proj.status] || { variant: 'default', label: proj.status };
            const isRunning = proj.status === 'approved' && proj.deployed_at;
            return (
              <Link
                key={proj.id}
                href={`/server/${proj.id}`}
                className="tilt-3d group flex items-center justify-between p-5 border-2 rounded-2xl bg-card hover:border-primary/50 transition-all duration-300"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`p-2.5 rounded-xl border ${isRunning ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-muted border-border/40 text-muted-foreground'}`}>
                    {proj.deploy_type === 'docker' ? <Container className="size-4" /> : <GitBranch className="size-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm uppercase tracking-tight">{proj.name}</span>
                      <Badge variant={badge.variant as any}>{badge.label}</Badge>
                      {isRunning && <span className="size-2 rounded-full bg-emerald-500 animate-pulse inline-block" />}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[10px] font-bold text-muted-foreground opacity-70">
                        {proj.deploy_type === 'docker' ? proj.docker_image : proj.git_url?.replace('https://', '')}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground opacity-50">
                        :{proj.host_port}
                      </span>
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground opacity-50">
                        {SCOPE_ICON[proj.access_scope as AccessScope]}
                        {proj.access_scope}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground opacity-30 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all shrink-0 ml-4" />
              </Link>
            );
          })}
        </div>
      )}

      {/* 새 프로젝트 다이얼로그 */}
      <Dialog open={open} onOpenChange={o => { if (!o) { setOpen(false); setForm(DEFAULT_FORM); } }}>
        <DialogContent className="max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tighter italic text-xl">New Server Project</DialogTitle>
            <DialogDescription className="text-xs font-bold opacity-60">
              관리자 승인 후 자동으로 배포됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* 이름 / 설명 */}
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Project Name *</label>
                <Input placeholder="my-web-server" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  rows={2}
                  placeholder="간단한 설명..."
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  className={`${inputCls} h-auto resize-none`}
                />
              </div>
            </div>

            <hr className="border-border/40" />

            {/* 배포 방식 */}
            <div>
              <label className={labelCls}>Deploy Type *</label>
              <SegmentedTabs
                items={[
                  { value: 'docker', label: 'Docker Image' },
                  { value: 'git',    label: 'Git Repo' },
                ]}
                value={form.deployType}
                onChange={v => set('deployType', v as DeployType)}
              />
            </div>

            {form.deployType === 'docker' ? (
              <div>
                <label className={labelCls}>Docker Image *</label>
                <Input
                  placeholder="nginx:latest  /  python:3.11-slim"
                  value={form.dockerImage}
                  onChange={e => set('dockerImage', e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1 opacity-60">Docker Hub 이미지 이름 (tag 포함)</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Git Repository URL *</label>
                  <Input
                    placeholder="https://github.com/user/repo"
                    value={form.gitUrl}
                    onChange={e => set('gitUrl', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Branch</label>
                    <Input placeholder="main" value={form.gitBranch} onChange={e => set('gitBranch', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Runtime *</label>
                    <select
                      value={form.runtime}
                      onChange={e => set('runtime', e.target.value as Runtime)}
                      className={inputCls}
                    >
                      {RUNTIMES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Run Command</label>
                  <Input
                    placeholder="npm start  /  python app.py"
                    value={form.runCommand}
                    onChange={e => set('runCommand', e.target.value)}
                  />
                </div>
              </div>
            )}

            <hr className="border-border/40" />

            {/* 포트 설정 */}
            <div>
              <label className={labelCls}>Port Mapping *</label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Host Port</p>
                  <Input
                    type="number"
                    placeholder="9000"
                    value={form.hostPort}
                    onChange={e => set('hostPort', e.target.value)}
                  />
                </div>
                <span className="text-muted-foreground font-black mt-5">:</span>
                <div className="flex-1">
                  <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Container Port</p>
                  <Input
                    type="number"
                    placeholder="80"
                    value={form.containerPort}
                    onChange={e => set('containerPort', e.target.value)}
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 opacity-60">
                호스트포트:컨테이너포트 — 앱이 컨테이너 내 몇 번 포트를 쓰는지 확인하세요
              </p>
            </div>

            {/* 접근 범위 */}
            <div>
              <label className={labelCls}>Access Scope *</label>
              <SegmentedTabs
                items={[
                  { value: 'private', label: 'Private' },
                  { value: 'school',  label: 'School' },
                  { value: 'public',  label: 'Public' },
                ]}
                value={form.accessScope}
                onChange={v => set('accessScope', v as AccessScope)}
              />
              <p className="text-[10px] text-muted-foreground mt-1.5 opacity-60">
                {form.accessScope === 'private' && 'Tailscale VPN을 통해 본인만 접근 가능'}
                {form.accessScope === 'school'  && '교내 네트워크 + Tailscale에서 접근 가능'}
                {form.accessScope === 'public'  && '인터넷 어디서나 접근 가능 (방화벽 오픈)'}
              </p>
            </div>

            <hr className="border-border/40" />

            {/* 리소스 제한 */}
            <div>
              <label className={labelCls}>Resource Limits</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">CPU Cores</p>
                  <Input placeholder="1" value={form.cpuLimit} onChange={e => set('cpuLimit', e.target.value)} />
                </div>
                <div>
                  <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Memory</p>
                  <Input placeholder="512m" value={form.memoryLimit} onChange={e => set('memoryLimit', e.target.value)} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 opacity-60">CPU: 코어 수 (0.5, 1, 2…) / 메모리: 512m, 1g, 2g…</p>
            </div>

            <hr className="border-border/40" />

            {/* 환경변수 */}
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
                      <Input
                        placeholder="KEY"
                        value={e.key}
                        onChange={ev => updateEnvVar(i, 'key', ev.target.value)}
                        className="flex-1 font-mono text-xs"
                      />
                      <Input
                        placeholder="VALUE"
                        value={e.value}
                        onChange={ev => updateEnvVar(i, 'value', ev.target.value)}
                        className="flex-1 font-mono text-xs"
                      />
                      <button
                        onClick={() => removeEnvVar(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors text-lg leading-none px-1"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-black uppercase text-[10px]" onClick={() => { setOpen(false); setForm(DEFAULT_FORM); }}>
              취소
            </Button>
            <Button className="font-black uppercase text-[10px]" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '신청 중...' : '신청하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

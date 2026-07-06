'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { LoadingSpinner } from '@/components/ui/spinner';
import {
  ArrowLeft, Plus, Trash2, Container, GitBranch,
  Lock, School, Globe, ShieldAlert,
} from 'lucide-react';

type DeployType = 'docker' | 'git';
type AccessScope = 'private' | 'school' | 'public';
type Runtime = 'node20' | 'node18' | 'python311' | 'python39';

const RUNTIMES: { value: Runtime; label: string }[] = [
  { value: 'node20',    label: 'Node.js 20' },
  { value: 'node18',    label: 'Node.js 18' },
  { value: 'python311', label: 'Python 3.11' },
  { value: 'python39',  label: 'Python 3.9' },
];

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

const labelCls = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block';
const inputCls = 'h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm font-bold outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 transition-colors';
const cardCls = 'rounded-2xl border border-border/60 bg-card p-6 space-y-5';

const SCOPE_OPTS: { value: AccessScope; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'private', label: 'Private',  icon: <Lock   className="size-4" />, desc: 'Tailscale VPN으로 본인만' },
  { value: 'school',  label: 'School',   icon: <School className="size-4" />, desc: '교내 네트워크 + VPN' },
  { value: 'public',  label: 'Public',   icon: <Globe  className="size-4" />, desc: '인터넷 어디서나 접근' },
];

export default function NewServerPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const addEnvVar    = () => set('envVars', [...form.envVars, { key: '', value: '' }]);
  const removeEnvVar = (i: number) => set('envVars', form.envVars.filter((_, idx) => idx !== i));
  const updateEnvVar = (i: number, field: 'key' | 'value', val: string) =>
    set('envVars', form.envVars.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const handleSubmit = async () => {
    if (!user) return;
    if (!form.name.trim())                                         { showError('프로젝트 이름을 입력해주세요.'); return; }
    if (form.deployType === 'docker' && !form.dockerImage.trim()) { showError('Docker 이미지를 입력해주세요.'); return; }
    if (form.deployType === 'git'    && !form.gitUrl.trim())      { showError('Git 저장소 URL을 입력해주세요.'); return; }
    if (!form.hostPort.trim())                                     { showError('호스트 포트를 입력해주세요.'); return; }

    const hostPort      = parseInt(form.hostPort);
    const containerPort = parseInt(form.containerPort);
    if (isNaN(hostPort)      || hostPort < 1      || hostPort > 65535)      { showError('포트는 1~65535 사이 숫자여야 합니다.'); return; }
    if (isNaN(containerPort) || containerPort < 1 || containerPort > 65535) { showError('컨테이너 포트는 1~65535 사이 숫자여야 합니다.'); return; }

    const envVarsObj: Record<string, string> = {};
    for (const e of form.envVars) if (e.key.trim()) envVarsObj[e.key.trim()] = e.value;

    setSubmitting(true);
    const { error } = await supabase.from('cpu_projects').insert({
      user_id:        user.id,
      user_email:     user.email,
      name:           form.name.trim(),
      description:    form.description.trim(),
      deploy_type:    form.deployType,
      docker_image:   form.deployType === 'docker' ? form.dockerImage.trim() : null,
      git_url:        form.deployType === 'git'    ? form.gitUrl.trim()      : null,
      git_branch:     form.deployType === 'git'    ? (form.gitBranch.trim() || 'main') : null,
      runtime:        form.deployType === 'git'    ? form.runtime            : null,
      run_command:    form.deployType === 'git'    ? form.runCommand.trim()  : null,
      container_port: containerPort,
      host_port:      hostPort,
      access_scope:   form.accessScope,
      cpu_limit:      form.cpuLimit.trim()    || '1',
      memory_limit:   form.memoryLimit.trim() || '512m',
      env_vars:       envVarsObj,
    });
    setSubmitting(false);

    if (error) {
      if (error.code === '23505') showError('이미 사용 중인 포트입니다.');
      else showError('프로젝트 생성 실패: ' + error.message);
    } else {
      showSuccess('프로젝트가 신청됐습니다. 관리자 승인을 기다려주세요.');
      router.push('/server');
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

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center size-9 rounded-xl border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border transition-all"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tighter italic uppercase leading-none">New Server Project</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 mt-0.5">
              관리자 승인 후 자동으로 배포됩니다
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="font-black text-[10px] uppercase tracking-widest h-9"
            onClick={() => router.back()}
            disabled={submitting}
          >
            취소
          </Button>
          <Button
            className="font-black text-[10px] uppercase tracking-widest h-9 px-6"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '신청 중…' : '신청하기'}
          </Button>
        </div>
      </div>

      {/* 메인 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* ── 왼쪽: 배포 설정 (3/5) ── */}
        <div className="lg:col-span-3 space-y-6">

          {/* 기본 정보 */}
          <section className={cardCls}>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">프로젝트 기본 정보</h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Project Name *</label>
                <Input
                  placeholder="my-web-server"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  className="h-10"
                />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  rows={3}
                  placeholder="이 서버에 대한 간단한 설명..."
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  className={`${inputCls} h-auto resize-none`}
                />
              </div>
            </div>
          </section>

          {/* 배포 방식 */}
          <section className={cardCls}>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">배포 방식</h2>

            {/* Deploy type 선택 카드 */}
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'docker', label: 'Docker Image', icon: <Container className="size-5" />, desc: 'Docker Hub 이미지로 바로 실행' },
                { value: 'git',    label: 'Git Repo',     icon: <GitBranch  className="size-5" />, desc: 'Git 저장소 클론 후 실행' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => set('deployType', opt.value)}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                    form.deployType === opt.value
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border/60 bg-muted/20 text-muted-foreground hover:border-border'
                  }`}
                >
                  <span className={`mt-0.5 ${form.deployType === opt.value ? 'text-primary' : ''}`}>{opt.icon}</span>
                  <div>
                    <p className="font-black text-sm uppercase tracking-tight">{opt.label}</p>
                    <p className="text-[10px] opacity-60 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Docker 필드 */}
            {form.deployType === 'docker' && (
              <div>
                <label className={labelCls}>Docker Image *</label>
                <Input
                  placeholder="nginx:latest  /  python:3.11-slim"
                  value={form.dockerImage}
                  onChange={e => set('dockerImage', e.target.value)}
                  className="h-10 font-mono"
                />
                <p className="text-[10px] text-muted-foreground mt-1.5 opacity-60">Docker Hub 이미지 이름 (tag 포함)</p>
              </div>
            )}

            {/* Git 필드 */}
            {form.deployType === 'git' && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Git Repository URL *</label>
                  <Input
                    placeholder="https://github.com/user/repo"
                    value={form.gitUrl}
                    onChange={e => set('gitUrl', e.target.value)}
                    className="h-10 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Branch</label>
                    <Input
                      placeholder="main"
                      value={form.gitBranch}
                      onChange={e => set('gitBranch', e.target.value)}
                      className="h-10"
                    />
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
                    className="h-10 font-mono"
                  />
                </div>
              </div>
            )}
          </section>

          {/* 환경변수 */}
          <section className={cardCls}>
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Environment Variables</h2>
              <Button variant="ghost" size="sm" onClick={addEnvVar} className="h-7 px-2 text-[10px] font-black uppercase gap-1">
                <Plus className="size-3" /> Add
              </Button>
            </div>
            {form.envVars.length === 0 ? (
              <div
                onClick={addEnvVar}
                className="border-2 border-dashed border-border/40 rounded-xl py-8 text-center text-muted-foreground cursor-pointer hover:border-border/80 hover:bg-muted/10 transition-all"
              >
                <Plus className="size-5 mx-auto mb-2 opacity-30" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">클릭하여 환경변수 추가</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Key</p>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Value</p>
                  <span />
                </div>
                {form.envVars.map((e, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <Input
                      placeholder="DATABASE_URL"
                      value={e.key}
                      onChange={ev => updateEnvVar(i, 'key', ev.target.value)}
                      className="h-9 font-mono text-xs"
                    />
                    <Input
                      placeholder="값..."
                      value={e.value}
                      onChange={ev => updateEnvVar(i, 'value', ev.target.value)}
                      className="h-9 font-mono text-xs"
                    />
                    <button
                      onClick={() => removeEnvVar(i)}
                      className="flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── 오른쪽: 네트워크 & 리소스 (2/5) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* 포트 설정 */}
          <section className={cardCls}>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Port Mapping</h2>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className={labelCls}>Host Port *</label>
                <Input
                  type="number"
                  placeholder="9000"
                  value={form.hostPort}
                  onChange={e => set('hostPort', e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="pb-1 text-muted-foreground font-black text-lg">:</div>
              <div className="flex-1">
                <label className={labelCls}>Container Port</label>
                <Input
                  type="number"
                  placeholder="80"
                  value={form.containerPort}
                  onChange={e => set('containerPort', e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground opacity-60 leading-relaxed">
              앱이 컨테이너 내 몇 번 포트를 쓰는지 확인하세요.<br />
              호스트 포트는 외부에서 접속하는 포트입니다.
            </p>
          </section>

          {/* 접근 범위 */}
          <section className={cardCls}>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Access Scope</h2>
            <div className="space-y-2">
              {SCOPE_OPTS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => set('accessScope', opt.value)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                    form.accessScope === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border/60 bg-muted/20 hover:border-border'
                  }`}
                >
                  <span className={`${form.accessScope === opt.value ? 'text-primary' : 'text-muted-foreground'}`}>
                    {opt.icon}
                  </span>
                  <div className="min-w-0">
                    <p className={`font-black text-xs uppercase tracking-tight ${form.accessScope === opt.value ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] opacity-50 mt-0.5">{opt.desc}</p>
                  </div>
                  <div className={`ml-auto size-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    form.accessScope === opt.value ? 'border-primary bg-primary' : 'border-border'
                  }`}>
                    {form.accessScope === opt.value && <div className="size-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* 리소스 제한 */}
          <section className={cardCls}>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resource Limits</h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>CPU Cores</label>
                <Input
                  placeholder="1"
                  value={form.cpuLimit}
                  onChange={e => set('cpuLimit', e.target.value)}
                  className="h-10"
                />
                <p className="text-[10px] text-muted-foreground mt-1 opacity-50">0.5, 1, 2 …</p>
              </div>
              <div>
                <label className={labelCls}>Memory</label>
                <Input
                  placeholder="512m"
                  value={form.memoryLimit}
                  onChange={e => set('memoryLimit', e.target.value)}
                  className="h-10"
                />
                <p className="text-[10px] text-muted-foreground mt-1 opacity-50">512m, 1g, 2g …</p>
              </div>
            </div>
          </section>

          {/* 하단 신청 버튼 (모바일용 - lg 이상에서는 top bar 사용) */}
          <div className="lg:hidden flex gap-3">
            <Button variant="outline" className="flex-1 font-black text-[10px] uppercase tracking-widest h-11" onClick={() => router.back()} disabled={submitting}>
              취소
            </Button>
            <Button className="flex-1 font-black text-[10px] uppercase tracking-widest h-11" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '신청 중…' : '신청하기'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

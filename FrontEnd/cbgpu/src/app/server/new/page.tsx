'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BackendPresets from '@/components/deploy/BackendPresets';
import {SERVER_RUNTIMES,legacyServerRuntime,serverGitEnvironment,type ServerRuntime} from '@/lib/serverRuntime';
import {serverDomains} from '@/lib/deployDomains';
import {serverProjectRequest} from '@/lib/deploymentApi';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { formatMemoryLimit } from '@/lib/formatMemoryLimit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { LoadingSpinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Plus, Trash2, Container, GitBranch,
  Lock, School, Globe, ShieldAlert, Layers,
} from 'lucide-react';

type DeployType = 'docker' | 'git' | 'compose';
type AccessScope = 'private' | 'school' | 'public';
type Runtime = ServerRuntime;

const RUNTIMES=SERVER_RUNTIMES;

const MEMORY_OPTS = ['128m', '256m', '512m', '1g', '2g', '4g'] as const;
type MemoryLimit = typeof MEMORY_OPTS[number];

type EnvEntry = { key: string; value: string };

interface FormState {
  name: string;
  description: string;
  deployType: DeployType;
  dockerImage: string;
  gitUrl: string;
  gitBranch: string;
  rootDirectory: string;
  composeFile:string;
  gatewayService:string;
  storageGB:string;
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
  rootDirectory: '.',
  composeFile:'',
  gatewayService:'api-gw',
  storageGB:'40',
  runtime: 'node22',
  runCommand: '',
  containerPort: '80',
  hostPort: '',
  accessScope: 'private',
  cpuLimit: '1',
  memoryLimit: '512m' as MemoryLimit,
  envVars: [],
};

const labelCls = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block';
const inputCls = 'h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm font-bold outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 transition-colors';
const cardCls = 'rounded-2xl border border-border/60 bg-card p-6 space-y-5';

const SCOPE_OPTS: { value: AccessScope; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'private', label: 'Private',  icon: <Lock   className="size-4" />, desc: 'Tailscale VPN 접속자만' },
  { value: 'school',  label: 'School',   icon: <School className="size-4" />, desc: '교내 네트워크 + VPN' },
  { value: 'public',  label: 'Public',   icon: <Globe  className="size-4" />, desc: '인터넷 어디서나 접근' },
];

export default function NewServerPage() {
  const { user, profile, isApproved, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [domainName,setDomainName]=useState(''),[bulkEnv,setBulkEnv]=useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const addEnvVar    = () => set('envVars', [...form.envVars, { key: '', value: '' }]);
  const removeEnvVar = (i: number) => set('envVars', form.envVars.filter((_, idx) => idx !== i));
  const updateEnvVar = (i: number, field: 'key' | 'value', val: string) =>
    set('envVars', form.envVars.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const handleSubmit = async () => {
    if (!user) return;
    if (!profile || profile.id !== user.id) { showError('계정 프로필을 확인할 수 없습니다. 새로고침 후 다시 시도하고, 계속되면 관리자에게 문의해 주세요.'); return; }
    if (!isApproved) { showError('학번 또는 이름 확인이 필요해 배포할 수 없습니다. 프로필에서 정보를 확인해 주세요.'); return; }
    if (domainName&&!/^[a-z][a-z0-9-]{2,34}$/.test(domainName)) {showError('도메인 이름은 영문 소문자로 시작하는 3~35자 영문·숫자·하이픈으로 입력하세요.');return;}
    if (!form.name.trim())                                         { showError('프로젝트 이름을 입력해주세요.'); return; }
    if (form.deployType === 'docker' && !form.dockerImage.trim()) { showError('Docker 이미지를 입력해주세요.'); return; }
    if (form.deployType !== 'docker'    && !form.gitUrl.trim())      { showError('Git 저장소 URL을 입력해주세요.'); return; }
    if (form.deployType==='git'&&/YOUR_PROJECT|YOUR_APP/.test(form.runCommand)){showError('실행 명령의 YOUR_PROJECT 또는 YOUR_APP을 실제 프로젝트 이름으로 바꿔 주세요.');return;}


    const hostPort      = form.hostPort.trim()?parseInt(form.hostPort):null;
    const containerPort = parseInt(form.containerPort);
    if (hostPort!==null&&(isNaN(hostPort)      || hostPort < 1024      || hostPort > 65535))      { showError('포트는 1~65535 사이 숫자여야 합니다.'); return; }
    if (isNaN(containerPort) || containerPort < 1 || containerPort > 65535) { showError('컨테이너 포트는 1~65535 사이 숫자여야 합니다.'); return; }

    const envVarsObj: Record<string, string> = {};
    for (const e of form.envVars) if (e.key.trim()) envVarsObj[e.key.trim()] = e.value;

    try{for(const line of bulkEnv.split('\n')){const text=line.trim();if(!text||text.startsWith('#'))continue;const pos=text.indexOf('=');if(pos<1)throw Error('환경변수는 KEY=value 형식으로 입력하세요.');const key=text.slice(0,pos).trim().replace(/^export\s+/,'');let value=text.slice(pos+1).trim();if((value.startsWith('\"')&&value.endsWith('\"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);envVarsObj[key]=value}}catch(error){showError(error instanceof Error?error.message:'환경변수를 확인해 주세요.');return;}
    let deploymentEnvironment=envVarsObj;try{if(form.deployType!=='docker')deploymentEnvironment=serverGitEnvironment(envVarsObj,form.runtime,form.rootDirectory)}catch(error){showError(error instanceof Error?error.message:'폴더 설정을 확인해 주세요.');return;}
    if(form.deployType==='compose'){const {CBGPU_RUNTIME_PRESET:unused,...values}=deploymentEnvironment;void unused;deploymentEnvironment={...values,CBGPU_DEPLOY_ENGINE:'compose',CBGPU_COMPOSE_FILE:form.composeFile,CBGPU_GATEWAY_SERVICE:form.gatewayService,CBGPU_STORAGE_GB:form.storageGB};}
    setSubmitting(true);
    const { data:created, error } = await serverProjectRequest(undefined,{
      user_id:        user.id,
      user_email:     user.email,
      name:           form.name.trim(),
      description:    form.description.trim(),
      deploy_type:    form.deployType==='compose'?'git':form.deployType,
      docker_image:   form.deployType === 'docker' ? form.dockerImage.trim() : null,
      git_url:        form.deployType !== 'docker'    ? form.gitUrl.trim()      : null,
      git_branch:     form.deployType !== 'docker'    ? (form.gitBranch.trim() || 'main') : null,
      runtime:        form.deployType !== 'docker'    ? legacyServerRuntime(form.runtime)            : null,
      run_command:    form.deployType==='compose'?'docker compose up -d':form.deployType !== 'docker'    ? form.runCommand.trim()  : null,
      container_port: containerPort,
      host_port:      hostPort,
      access_scope:   form.accessScope,
      cpu_limit:      form.cpuLimit.trim()    || '1',
      memory_limit:   form.memoryLimit.trim() || '512m',
      env_vars:       deploymentEnvironment,
    });
    setSubmitting(false);

    if (error) {
      if (error.code === '23505') showError('이미 사용 중인 포트입니다.');
      else if (error.code === '42501') showError('프로젝트 생성 권한을 확인할 수 없습니다. 프로필 승인 상태를 확인해 주세요.');
      else showError('프로젝트 생성 실패: ' + error.message);
    } else {
      if(domainName&&created){try{await serverDomains(created.id,domainName)}catch(error){showError('서버 배포는 시작됐지만 도메인 설정에 실패했습니다. 프로젝트 상세에서 다시 설정하세요. '+(error instanceof Error?error.message:''));router.push('/server/'+created.id);return;}}
      showSuccess('프로젝트를 생성했습니다. 배포가 자동으로 시작됩니다.');
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
    <div className="cb-page-content animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      {/* 상단 헤더 */}
      <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center size-9 rounded-xl border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border transition-all"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tighter italic uppercase leading-none">New Server Project</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 mt-0.5">
              저장하면 승인 없이 자동 배포를 시작합니다
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
            {submitting ? '생성 중…' : '배포 시작'}
          </Button>
        </div>
      </div>

<BackendPresets onSelect={preset=>setForm(current=>({...current,deployType:preset.runtime?'git':'docker',...(preset.runtime?{runtime:preset.runtime,runCommand:preset.command||''}:{}),containerPort:preset.port,memoryLimit:preset.memory}))}/>
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
              <div><label className={labelCls} htmlFor="server-domain-name">Public Domain</label><Input id="server-domain-name" placeholder="my-server" value={domainName} onChange={e=>setDomainName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}/><p className="text-xs text-muted-foreground mt-2 break-all">{domainName||'자동 발급 이름'}.server.cbgpu.com · Public 선택 후 배포되면 연결됩니다.</p></div>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { value: 'docker', label: 'Docker Image', icon: <Container className="size-5" />, desc: 'Docker Hub 이미지로 바로 실행' },
                { value: 'git',    label: 'Git Repo',     icon: <GitBranch  className="size-5" />, desc: 'Git 저장소 클론 후 실행' },
                { value:'compose',label:'Docker Compose',icon:<Layers className="size-5"/>,desc:'DB·Storage와 여러 서비스를 함께 배포' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={()=>setForm(current=>({...current,deployType:opt.value,...(opt.value==='compose'?{containerPort:'8000',cpuLimit:'3',memoryLimit:'4g',accessScope:'public'}:{})}))}
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

            {form.deployType==='compose'&&<div className="rounded-2xl bg-muted/30 border p-4 space-y-4"><p className="text-sm font-semibold">docker compose up -d</p><p className="text-xs text-muted-foreground leading-relaxed">저장소 폴더와 Compose 파일을 지정하세요. DB·Storage 데이터는 코드와 분리된 프로젝트 전용 영구 볼륨에 보존됩니다. 다른 프로젝트나 호스트 파일, Docker 제어 소켓에 접근하는 설정은 허용되지 않습니다.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="text-xs font-medium">Compose File<Input aria-label="Compose 파일" value={form.composeFile} onChange={e=>set('composeFile',e.target.value)} placeholder="compose.yaml / docker-compose.yml 자동 감지"/></label><label className="text-xs font-medium">HTTPS Gateway Service<Input aria-label="Compose 게이트웨이 서비스" value={form.gatewayService} onChange={e=>set('gatewayService',e.target.value)} placeholder="api-gw"/></label></div><label className="block text-xs font-medium">영구 스토리지 (GB)<Input type="number" min="40" max="200" value={form.storageGB} onChange={e=>set('storageGB',e.target.value)}/></label><p className="text-xs text-muted-foreground">컨테이너 포트는 게이트웨이 서비스의 포트(예: 8000)를 입력하세요. 기존 데이터 복원은 별도로 진행해야 합니다.</p></div>}
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
            {form.deployType !== 'docker' && (
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Branch</label>
                    <Input
                      placeholder="main"
                      value={form.gitBranch}
                      onChange={e => set('gitBranch', e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className={form.deployType==='compose'?'hidden':''}>
                    <label className={labelCls}>Runtime *</label>
                    <Select value={form.runtime} onValueChange={v => set('runtime', v as Runtime)}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RUNTIMES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
<div><label className={labelCls} htmlFor="server-root-directory">Root Directory</label><Input id="server-root-directory" value={form.rootDirectory} onChange={e=>set('rootDirectory',e.target.value)} placeholder="services/api"/><p className="text-xs text-muted-foreground mt-2">저장소 안의 폴더를 지정하세요. 이 폴더에서 의존성을 설치하고 실행합니다.</p></div>
                <div className={form.deployType==='compose'?'hidden':''}>
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
            <details className="border rounded-xl p-4"><summary className="text-xs cursor-pointer">.env 여러 항목 한 번에 붙여넣기</summary><label className="sr-only" htmlFor="server-env-bulk">서버 환경변수 .env</label><textarea id="server-env-bulk" className="mt-3 w-full min-h-40 rounded-xl border bg-background p-3 font-mono text-sm" value={bulkEnv} onChange={e=>setBulkEnv(e.target.value)} placeholder={'POSTGRES_PASSWORD=...\nJWT_SECRET=...\nSUPABASE_PUBLIC_URL=https://my-api.server.cbgpu.com'}/><p className="mt-2 text-xs text-muted-foreground">저장소의 .env.example과 README에 필요한 항목을 확인하세요. 비밀 값은 프로젝트 소유자·편집자만 관리할 수 있습니다.</p></details>
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
                <label className={labelCls}>Host Port (자동 할당 가능)</label>
                <Input
                  type="number"
                  placeholder="비워두면 자동 할당"
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
                <Select value={form.memoryLimit} onValueChange={v => set('memoryLimit', v as MemoryLimit)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMORY_OPTS.map(m => (
                      <SelectItem key={m} value={m}>
                        {formatMemoryLimit(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* 하단 신청 버튼 (모바일용 - lg 이상에서는 top bar 사용) */}
          <div className="lg:hidden flex gap-3">
            <Button variant="outline" className="flex-1 font-black text-[10px] uppercase tracking-widest h-11" onClick={() => router.back()} disabled={submitting}>
              취소
            </Button>
            <Button className="flex-1 font-black text-[10px] uppercase tracking-widest h-11" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '생성 중…' : '배포 시작'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

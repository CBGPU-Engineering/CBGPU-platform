'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ComposeStatus from '@/components/deploy/ComposeStatus';
import ProjectDomains from '@/components/deploy/ProjectDomains';
import ProjectTeam from '@/components/deploy/ProjectTeam';
import {serverProjectRequest} from '@/lib/deploymentApi';
import {SERVER_RUNTIMES,legacyServerRuntime,serverGitEnvironment,serverRuntimeOf,serverRootOf,type ServerRuntime} from '@/lib/serverRuntime';
import {serverDomains} from '@/lib/deployDomains';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { formatMemoryLimit } from '@/lib/formatMemoryLimit';
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

type Runtime = ServerRuntime;
type AccessScope = 'private' | 'school' | 'public';

const RUNTIMES=SERVER_RUNTIMES;

const MEMORY_OPTS = ['128m', '256m', '512m', '1g', '2g', '4g'] as const;
type MemoryLimit = typeof MEMORY_OPTS[number];

type EnvEntry = { key: string; value: string };

interface RedeployForm {
  name: string;
  description: string;
  gitUrl: string;
  composeFile: string;
  gatewayService: string;
  storageGB: string;
  dockerImage: string;
  gitBranch: string;
  rootDirectory: string;
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
  const { user, isApproved, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  const [domainSlug,setDomainSlug]=useState(''),[domainDraft,setDomainDraft]=useState(''),[domainSaving,setDomainSaving]=useState(false);
  useEffect(()=>{if(!user||!id)return;let alive=true;void serverDomains().then(data=>{const slug=data.domains?.find(d=>d.project_id===id)?.slug||('server-'+id.slice(0,8));if(alive){setDomainSlug(slug);setDomainDraft(slug)}}).catch(()=>{});return()=>{alive=false}},[id,user]);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [redeployOpen, setRedeployOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<RedeployForm | null>(null);

  const fetchProject = async () => {
    const {data,error}=await serverProjectRequest(id);
    if (error) { showError('프로젝트를 찾을 수 없습니다.'); router.push('/server'); return; }
    setProject(data);
    setLoading(false);
  };

  useEffect(() => {
    if (id && user && !authLoading) fetchProject();
  }, [id, user?.id, authLoading]);

  const openRedeploy = () => {
    if (!project) return;
    const envEntries: EnvEntry[] = Object.entries(project.env_vars || {}).filter(([key])=>!['CBGPU_RUNTIME_PRESET','CBGPU_ROOT_DIRECTORY','CBGPU_DEPLOY_ENGINE','CBGPU_COMPOSE_FILE','CBGPU_GATEWAY_SERVICE','CBGPU_STORAGE_GB'].includes(key)).map(([k, v]) => ({ key: k, value: String(v) }));
    setForm({
      name: project.name||'',
      description: project.description||'',
      gitUrl: project.git_url||'',
      composeFile: project.env_vars?.CBGPU_COMPOSE_FILE||'',
      gatewayService: project.env_vars?.CBGPU_GATEWAY_SERVICE||'',
      storageGB: project.env_vars?.CBGPU_STORAGE_GB||'40',
      dockerImage:   project.docker_image || '',
      gitBranch:     project.git_branch || 'main',
      rootDirectory: serverRootOf(project),
      runtime:       serverRuntimeOf(project),
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

  const handleRedeploy = async (redeploy = true) => {
    if (!form || !project) return;
    if(!form.name.trim()){showError('프로젝트 이름을 입력해 주세요.');return;}
    if (!isApproved) { showError('학번 또는 이름 확인이 필요해 재배포할 수 없습니다. 프로필에서 정보를 확인해 주세요.'); return; }
    const hostPort = parseInt(form.hostPort);
    const containerPort = parseInt(form.containerPort);
    if (isNaN(hostPort)) { showError('포트는 숫자여야 합니다.'); return; }

    const envVarsObj: Record<string, string> = {};
    for (const e of form.envVars) {
      if (e.key.trim()) envVarsObj[e.key.trim()] = e.value;
    }

    let deploymentEnvironment=envVarsObj;try{if(project.deploy_type==='git')deploymentEnvironment=serverGitEnvironment(envVarsObj,form.runtime,form.rootDirectory)}catch(error){showError(error instanceof Error?error.message:'폴더 설정을 확인해 주세요.');return;}
    if(project.env_vars?.CBGPU_DEPLOY_ENGINE==='compose'){const {CBGPU_RUNTIME_PRESET:unused,...values}=deploymentEnvironment;void unused;deploymentEnvironment={...values,CBGPU_DEPLOY_ENGINE:'compose',CBGPU_COMPOSE_FILE:form.composeFile.trim(),CBGPU_GATEWAY_SERVICE:form.gatewayService.trim(),CBGPU_STORAGE_GB:form.storageGB};}
    setSubmitting(true);
    const updates: Record<string, any> = {
      name: form.name.trim(),
      description: form.description.trim(),
      container_port:     containerPort,
      host_port:          hostPort,
      access_scope:       form.accessScope,
      cpu_limit:          form.cpuLimit || '1',
      memory_limit:       form.memoryLimit || '512m',
      env_vars:           deploymentEnvironment,
      ...(redeploy ? {deploy_requested_at: new Date().toISOString()} : {}),
    };

    if (project.deploy_type === 'docker') {
      if (!form.dockerImage.trim()) { showError('이미지를 입력해주세요.'); setSubmitting(false); return; }
      updates.docker_image = form.dockerImage.trim();
    } else {
      updates.git_url = form.gitUrl.trim();
      updates.git_branch  = form.gitBranch.trim() || 'main';
      updates.runtime     = legacyServerRuntime(form.runtime);
      updates.run_command = form.runCommand.trim();
    }

    const {error}=await serverProjectRequest(project.id,updates);
    setSubmitting(false);

    if (error) {
      if (error.code === '23505') showError('이미 사용 중인 포트입니다.');
      else showError('재배포 요청 실패: ' + error.message);
    } else {
      showSuccess(redeploy?'설정을 저장하고 재배포를 요청했습니다.':'설정을 저장했습니다. 다음 배포에 적용됩니다.');
      setRedeployOpen(false);
      fetchProject();
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    const {error}=await serverProjectRequest(project.id,undefined,true);
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

  const isCompose=project.env_vars?.CBGPU_DEPLOY_ENGINE==='compose';
  const isOwner = user?.id === project.user_id;
  const canManage = isOwner || project.collaboration_role==='editor';
  const isRunning = project.status === 'approved' && project.deployed_at;
  const isPublic = project.access_scope === 'public';
  // Public projects are reached through the tunnel URL the daemon records in public_url.
  // Private/school projects are reached directly on the NIC the daemon bound them to.
  const serverHost = project.access_scope === 'private'
    ? (process.env.NEXT_PUBLIC_CPU_SERVER_TAILSCALE_HOST || '100.100.136.37')
    : project.access_scope === 'school'
      ? (process.env.NEXT_PUBLIC_CPU_SERVER_SCHOOL_HOST || '10.138.23.12')
      : null;
  const serverUrl: string | null = isPublic
    ? (`https://${domainSlug||('server-'+project.id.slice(0,8))}.server.cbgpu.com`)
    : serverHost ? `http://${serverHost}:${project.host_port}` : null;

  const STATUS_INFO: Record<string, { icon: React.ReactNode; variant: any; label: string }> = {
    pending:  { icon: <Clock className="size-4" />,         variant: 'warning', label: 'Queued — 배포 대기 중' },
    approved: { icon: <CheckCircle2 className="size-4" />,  variant: 'success', label: isRunning ? '배포 완료' : 'Deploying — 배포 준비 중' },
    rejected: { icon: <XCircle className="size-4" />,       variant: 'danger',  label: 'Rejected' },
    deleted:  { icon: <Trash2 className="size-4" />,        variant: 'muted',   label: 'Deleted' },
  };
  const statusInfo = STATUS_INFO[project.status] || { icon: null, variant: 'default', label: project.status };

  const envEntries = Object.entries(project.env_vars || {}).filter(([key])=>!['CBGPU_RUNTIME_PRESET','CBGPU_ROOT_DIRECTORY','CBGPU_DEPLOY_ENGINE','CBGPU_COMPOSE_FILE','CBGPU_GATEWAY_SERVICE','CBGPU_STORAGE_GB'].includes(key)) as [string,string][];

  return (
    <div className="cb-page-content space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-2xl">
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
              {project.status !== 'deleted' && (
                <Button
                  variant="outline"
                  className="font-black text-[10px] uppercase gap-1.5 h-9"
                  onClick={openRedeploy}
                >
                  <RotateCcw className="size-3.5" /> 설정 수정
                </Button>
              )}
              {isOwner&&(<Button
                variant="destructive"
                className="font-black text-[10px] uppercase gap-1.5 h-9"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-3.5" /> 삭제
              </Button>)}
            </div>
          )}
        </div>
      </div>

      {isOwner&&project.status!=='deleted'&&<section className="rounded-2xl border bg-card p-5 space-y-3"><h2 className="font-semibold text-sm">Server Domain</h2><p className="text-xs text-muted-foreground">Public 서버에 연결됩니다. 기존 Private·School 서버의 접근 범위는 유지됩니다.</p><div className="flex gap-2 flex-wrap"><Input aria-label="서버 도메인 이름" className="max-w-sm" value={domainDraft} onChange={e=>setDomainDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}/><Button disabled={domainSaving||!domainDraft} onClick={async()=>{setDomainSaving(true);try{await serverDomains(project.id,domainDraft);setDomainSlug(domainDraft);showSuccess('서버 도메인을 저장했습니다. HTTPS 인증서는 잠시 후 활성화됩니다.')}catch(e){showError(e instanceof Error?e.message:'도메인 설정 실패')}finally{setDomainSaving(false)}}}>도메인 저장</Button></div><p className="text-xs text-muted-foreground break-all">{domainDraft||'my-server'}.server.cbgpu.com</p></section>}
      {isCompose&&<ComposeStatus id={project.id}/>}
      <ProjectTeam kind="server" id={project.id}/><ProjectDomains kind="server" id={project.id}/>
      {/* 접근 정보 — 실행 중일 때만 */}
      {isRunning && (
        <div className="p-5 rounded-2xl bg-emerald-500/5 border-2 border-emerald-500/20">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3">Access</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 break-all text-sm font-black text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-lg">
              {serverUrl ?? (isPublic ? '공개 주소 발급 중… 잠시 후 새로고침해 주세요' : `포트 ${project.host_port}`)}
            </code>
            {serverUrl && <Button
              variant="ghost"
              size="icon"
              className="size-8 text-emerald-600"
              onClick={() => window.open(serverUrl, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="size-3.5" />
            </Button>}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 opacity-60">
            {project.access_scope === 'private' && '※ Tailscale VPN 연결 시에만 접근 가능합니다'}
            {project.access_scope === 'school'  && '※ 교내 네트워크에서 접근 가능합니다'}
            {project.access_scope === 'public'  && '※ 인터넷 어디서나 접근 가능합니다 (서버가 재시작되면 주소가 바뀔 수 있습니다)'}
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
                  <label className={labelCls}>{isCompose?'Deployment Mode':'Runtime'}</label>
                  <span className="font-bold text-sm">{isCompose?'Docker Compose':RUNTIMES.find(r=>r.value===serverRuntimeOf(project))?.label||serverRuntimeOf(project)}</span>
                </div>
                <div>
                  <label className={labelCls}>Root Directory</label><p className="text-sm font-mono mb-4 break-all">{serverRootOf(project)}</p><label className={labelCls}>Run Command</label>
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
                <span className="font-bold text-sm">{formatMemoryLimit(project.memory_limit)}</span>
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
            <DialogTitle className="font-black uppercase tracking-tighter italic text-xl">서버 설정 수정</DialogTitle>
            <DialogDescription className="text-xs font-bold opacity-60">
              설정만 저장하거나, 변경사항을 저장하고 바로 재배포할 수 있습니다. 재배포 중에는 잠시 연결이 끊길 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-5 py-2">
              <div><label className={labelCls} htmlFor="server-edit-name">프로젝트 이름</label><Input id="server-edit-name" value={form.name} onChange={e=>set('name',e.target.value)} maxLength={100}/></div>
              <div><label className={labelCls} htmlFor="server-edit-description">설명</label><Input id="server-edit-description" value={form.description} onChange={e=>set('description',e.target.value)} maxLength={2000}/></div>
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
                  <div><label className={labelCls} htmlFor="server-edit-git-url">GitHub Repository</label><Input id="server-edit-git-url" value={form.gitUrl} onChange={e=>set('gitUrl',e.target.value)} placeholder="https://github.com/owner/repository"/></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Branch</label>
                      <Input placeholder="main" value={form.gitBranch} onChange={e => set('gitBranch', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>{isCompose?'Deployment Mode':'Runtime'}</label>
                      {isCompose?<p className="text-sm py-2">Docker Compose</p>:<>
                      <Select value={form.runtime} onValueChange={v => set('runtime', v as Runtime)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RUNTIMES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select></>}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="redeploy-root-directory">Root Directory</label><Input id="redeploy-root-directory" value={form?.rootDirectory||'.'} onChange={e=>setForm(current=>current?{...current,rootDirectory:e.target.value}:current)} placeholder="services/api"/><p className="text-xs text-muted-foreground mt-2 mb-4">저장소 안에서 의존성 설치와 실행을 시작할 폴더입니다.</p>{!isCompose&&<><label className={labelCls}>Run Command</label>
                    <Input
                      placeholder="npm start"
                      value={form.runCommand}
                      onChange={e => set('runCommand', e.target.value)}
                    /></>}
                    {isCompose&&<div className="space-y-3"><label className={labelCls} htmlFor="server-edit-compose-file">Compose File</label><Input id="server-edit-compose-file" value={form.composeFile} onChange={e=>set('composeFile',e.target.value)} placeholder="compose.yml (자동 감지)"/><label className={labelCls} htmlFor="server-edit-gateway">Gateway Service</label><Input id="server-edit-gateway" value={form.gatewayService} onChange={e=>set('gatewayService',e.target.value)} placeholder="api-gw"/><label className={labelCls} htmlFor="server-edit-storage">Persistent Storage (GB)</label><Input id="server-edit-storage" type="number" min={40} max={200} value={form.storageGB} onChange={e=>set('storageGB',e.target.value)}/><p className="text-xs text-muted-foreground">재배포해도 기존 데이터 볼륨을 유지합니다.</p></div>}
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
                          {formatMemoryLimit(m)}
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
            <Button variant="outline" className="font-black text-[10px]" onClick={()=>void handleRedeploy(false)} disabled={submitting}>설정만 저장</Button>
            <Button className="font-black uppercase text-[10px]" onClick={()=>void handleRedeploy(true)} disabled={submitting}>
              {submitting ? '요청 중...' : '저장 후 재배포'}
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

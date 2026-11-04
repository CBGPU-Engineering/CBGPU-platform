'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {serverProjectRequest} from '@/lib/deploymentApi';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import {
  Plus, Server, Globe, School, Lock, RefreshCw,
  Container, GitBranch, ChevronRight, ShieldAlert,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

type AccessScope = 'private' | 'school' | 'public';

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

export default function ServerPage() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { showError } = useAlert();
  const router = useRouter();

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    if (!user) return;
    setLoading(true);
    const {data,error}=await serverProjectRequest();
    if (error) showError('프로젝트 목록 로드 실패: ' + error.message);
    else setProjects(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && user) fetchProjects();
  }, [authLoading, user]);

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
    <div className="cb-page-content space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
            onClick={() => router.push('/server/new')}
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

    </div>
  );
}

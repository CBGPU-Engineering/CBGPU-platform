'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';

const OFFICIAL_STUDY_URL = 'https://cbsh.edu-set.com';

export default function AdminStudyPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  const [tokenInput, setTokenInput] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setStatusLoading(false);
      return;
    }

    const res = await fetch('/api/study/admin-token', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json().catch(() => null);
    if (res.ok) setUpdatedAt(data?.updatedAt ?? null);
    setStatusLoading(false);
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      void fetchStatus();
    } else if (!authLoading) {
      setStatusLoading(false);
    }
  }, [authLoading, isAdmin]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      showError('accessToken을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/study/admin-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ accessToken: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? '저장에 실패했습니다.');

      showSuccess('토큰을 저장했습니다. 이제부터 모든 사용자가 이 토큰으로 /study 현황을 조회합니다.');
      setTokenInput('');
      void fetchStatus();
    } catch (err: any) {
      showError(err.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse font-black uppercase tracking-widest text-muted-foreground">Verifying Authority...</div>
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

  return (
    <div className="max-w-md mx-auto space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-black tracking-tighter italic uppercase">자습신청 토큰 관리</h1>
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1 opacity-70">
          여기서 등록한 토큰으로 모든 사용자가 /study 현황을 조회합니다.
        </p>
      </div>

      <div className="text-xs text-muted-foreground rounded-xl border border-border/60 bg-muted/20 p-3 font-medium">
        {statusLoading
          ? '상태 확인 중...'
          : updatedAt
            ? `마지막 갱신: ${new Date(updatedAt).toLocaleString('ko-KR')}`
            : '등록된 토큰이 없습니다. 아래에서 토큰을 등록해주세요.'}
      </div>

      <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside rounded-xl border border-dashed border-border/60 bg-muted/20 p-3">
        <li>
          <a href={OFFICIAL_STUDY_URL} target="_blank" rel="noopener noreferrer" className="underline font-medium">
            공식 사이트
          </a>
          에서 평소처럼 로그인합니다.
        </li>
        <li>F12로 개발자도구를 열고 콘솔(Console) 탭에서 아래 명령을 입력합니다.</li>
        <li className="font-mono text-[11px] bg-background/70 rounded px-2 py-1 select-all break-all">
          localStorage.getItem(&quot;accessToken&quot;)
        </li>
        <li>따옴표를 제외한 출력된 토큰 값을 복사해 아래에 붙여넣습니다.</li>
      </ol>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <Input
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="accessToken 붙여넣기"
          className="font-mono text-xs"
        />
        <Button type="submit" disabled={saving} className="font-black uppercase tracking-widest gap-2">
          <KeyRound className="size-4" /> {saving ? '저장 중...' : '토큰 저장'}
        </Button>
      </form>
    </div>
  );
}

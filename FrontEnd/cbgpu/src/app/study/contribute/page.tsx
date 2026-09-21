'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, KeyRound, Puzzle, Settings, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';

export default function StudyContributorPage() {
  const { user, isApproved, isLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [deviceKey, setDeviceKey] = useState('');
  const [devices, setDevices] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [completed, setCompleted] = useState(false);

  const loadDevices = async () => {
    if (!user) return;
    const { data } = await supabase.from('eduset_contributor_devices')
      .select('id, name, created_at, last_used_at').is('revoked_at', null).order('created_at', { ascending: false });
    setDevices(data ?? []);
  };

  useEffect(() => { void loadDevices(); }, [user]);

  const join = async () => {
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/study/contributor/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ name: navigator.userAgent.includes('Edg/') ? 'Edge 확장 프로그램' : 'Chrome 확장 프로그램' }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? '연결 키 발급에 실패했습니다.');
      setDeviceKey(body.deviceKey);
      await loadDevices();
      showSuccess('기여자 등록과 연결 키 발급이 완료됐습니다.');
    } catch (error: any) {
      showError(error.message ?? String(error));
    } finally {
      setCreating(false);
    }
  };

  const copyExtensionSettingsUrl = async () => {
    await navigator.clipboard.writeText('brave://extensions/?id=jinjaccalgkegednnccohejagnlnfdag');
    showSuccess('Brave 확장 프로그램 설정 주소를 복사했습니다. 주소창에 붙여넣어 주세요.');
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from('eduset_contributor_devices').delete().eq('id', id);
    if (error) showError(error.message);
    else { showSuccess('기기 연결을 해제했습니다.'); await loadDevices(); }
  };

  if (isLoading) return <main className="mx-auto max-w-xl px-4 py-12 text-center text-sm text-muted-foreground">불러오는 중...</main>;
  if (!user) return <main className="mx-auto max-w-xl px-4 py-12 text-center"><p>먼저 CBGPU에 로그인해주세요.</p></main>;

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <div className="flex items-center gap-2"><Puzzle className="size-6 text-primary" /><h1 className="text-3xl font-black tracking-tight">자습 조회 기여자</h1></div>
        <p className="text-sm text-muted-foreground">평소처럼 edu-set에 로그인하면 확장 프로그램이 유효한 조회 토큰을 CBGPU에 자동으로 전달합니다. 비밀번호는 수집하지 않습니다.</p>
      </div>

      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-emerald-500" /><h2 className="font-black">버튼을 순서대로 눌러주세요</h2></div>
        <div className="rounded-xl bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-black">1. Violentmonkey 설치</p>
          <p className="text-xs text-muted-foreground">Chrome, Brave, Edge에서 같은 설치 페이지를 사용합니다.</p>
          <Button asChild variant="outline" className="w-full gap-2">
            <a href="https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag" target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" /> Violentmonkey 설치 페이지</a>
          </Button>
        </div>
        <div className="rounded-xl bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-black">2. CBGPU 연결 키 발급</p>
          <p className="text-xs text-muted-foreground">관리자 승인 없이 즉시 발급됩니다.</p>
          <Button onClick={join} disabled={creating || !isApproved} className="w-full gap-2">
            <KeyRound className="size-4" /> {creating ? '발급 중...' : '기여 신청 및 연결 키 발급'}
          </Button>
          {deviceKey && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-black"><CheckCircle2 className="size-4 text-emerald-500" /> 연결 키가 발급됐습니다</div>
              <p className="text-xs text-muted-foreground">키는 5단계 버튼을 누를 때 스크립트에 자동으로 전달됩니다.</p>
            </div>
          )}
        </div>
        <div className="rounded-xl bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-black">3. 자동 동기화 스크립트 설치</p>
          <p className="text-xs text-muted-foreground">새 탭에서 Violentmonkey 설치 확인 화면이 열리므로 CBGPU 페이지는 유지됩니다.</p>
          <Button asChild variant="outline" className="w-full gap-2">
            <a href="/downloads/cbgpu-eduset-contributor.user.js" target="_blank" rel="noopener noreferrer"><Puzzle className="size-4" /> CBGPU 스크립트 설치</a>
          </Button>
        </div>
        <div className="rounded-xl bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-black">4. Brave에서 사용자 스크립트 허용</p>
          <p className="text-xs text-muted-foreground">Brave는 이 권한이 꺼져 있으면 스크립트 이름에 취소선을 표시합니다. 아래 버튼으로 주소를 복사해 주소창에서 연 다음, Violentmonkey 상세정보의 <b>Allow User Scripts</b>를 켜고 edu-set 탭을 새로고침하세요.</p>
          <Button type="button" variant="outline" onClick={copyExtensionSettingsUrl} className="w-full gap-2"><Settings className="size-4" /> Brave 설정 주소 복사</Button>
        </div>
        <div className="rounded-xl bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-black">5. edu-set 로그인</p>
          <p className="text-xs text-muted-foreground">아래 버튼이 발급된 연결 키를 스크립트에 자동으로 등록합니다. 직접 붙여넣을 필요가 없습니다.</p>
          <Button asChild variant="outline" className="w-full gap-2" aria-disabled={!deviceKey}>
            <a
              href={deviceKey ? `https://cbsh.edu-set.com/signin#cbgpu-key=${encodeURIComponent(deviceKey)}` : '#'}
              target={deviceKey ? '_blank' : undefined}
              rel="noopener noreferrer"
              onClick={(event) => { if (!deviceKey) { event.preventDefault(); showError('먼저 2단계에서 연결 키를 발급해주세요.'); } }}
            ><ExternalLink className="size-4" /> 키 연결하고 edu-set 열기</a>
          </Button>
        </div>
        <div className="rounded-xl bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-black">6. 설치 완료</p>
          <Button type="button" onClick={() => setCompleted(true)} disabled={!deviceKey} className="w-full gap-2">
            <CheckCircle2 className="size-4" /> 설정 완료
          </Button>
          {!deviceKey && <p className="text-xs text-muted-foreground">먼저 2단계에서 연결 키를 발급해주세요.</p>}
        </div>
      </div>

      {completed && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-2">
          <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
          <h2 className="text-xl font-black">설정 완료!</h2>
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
            이제 자습신청 사이트에 로그인하면 자동으로 CBGPU 토큰이 갱신됩니다!
          </p>
        </div>
      )}

      {devices.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground">연결된 기기 {devices.length}대</p>
          {devices.map((device) => (
            <div key={device.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
              <div><p className="font-bold">{device.name}</p><p className="text-xs text-muted-foreground">마지막 동기화: {device.last_used_at ? new Date(device.last_used_at).toLocaleString('ko-KR') : '아직 없음'}</p></div>
              <Button variant="ghost" size="sm" onClick={() => revoke(device.id)}>연결 해제</Button>
            </div>
          ))}
        </div>
      )}
      <Link href="/study" className="block text-center text-sm underline text-muted-foreground">자습신청 조회로 돌아가기</Link>
    </main>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ExternalLink, Puzzle, RefreshCw, Settings, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';

const VIOLENTMONKEY_ID = 'jinjaccalgkegednnccohejagnlnfdag';
type Browser = 'Brave' | 'Edge' | 'Chrome';
type ContributorDevice = { id: string; name: string; created_at: string; last_used_at: string | null };

function detectBrowser(): Browser {
  const agent = navigator.userAgent;
  if (agent.includes('Edg/')) return 'Edge';
  if ('brave' in navigator) return 'Brave';
  return 'Chrome';
}

function extensionDetailsUrl(browser: Browser): string {
  const scheme = browser === 'Brave' ? 'brave' : browser === 'Edge' ? 'edge' : 'chrome';
  return `${scheme}://extensions/?id=${VIOLENTMONKEY_ID}`;
}

export default function StudyContributorPage() {
  const { user, isApproved, isLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [devices, setDevices] = useState<ContributorDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);
  const [pendingSince, setPendingSince] = useState<number | null>(null);
  const [waitingTooLong, setWaitingTooLong] = useState(false);
  const [browser, setBrowser] = useState<Browser>('Chrome');

  useEffect(() => { setBrowser(detectBrowser()); }, []);

  const loadDevices = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('eduset_contributor_devices')
      .select('id, name, created_at, last_used_at').is('revoked_at', null).order('created_at', { ascending: false });
    if (error) showError('연결 상태를 확인하지 못했습니다. 잠시 후 새로고침해 주세요.');
    else setDevices(data ?? []);
    setDevicesLoading(false);
  };

  useEffect(() => { void loadDevices(); }, [user]);

  useEffect(() => {
    if (!pendingDeviceId) return;
    const check = async () => {
      const { data } = await supabase.from('eduset_contributor_devices')
        .select('id, name, created_at, last_used_at').eq('id', pendingDeviceId).maybeSingle();
      if (data?.last_used_at) {
        await loadDevices();
        setPendingDeviceId(null);
        setPendingSince(null);
        setWaitingTooLong(false);
        setShowGuide(false);
        showSuccess('자동 갱신 연결이 확인됐습니다.');
      } else if (pendingSince && Date.now() - pendingSince > 90_000) {
        setWaitingTooLong(true);
      }
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, 4000);
    return () => window.clearInterval(timer);
  }, [pendingDeviceId, pendingSince]);

  const connectAndOpen = async () => {
    // Open synchronously on the click so popup blockers do not discard the tab
    // while the connection key is being created.
    const studyTab = window.open('about:blank', '_blank');
    if (!studyTab) { showError('새 탭이 차단됐습니다. 팝업 차단을 해제하고 다시 눌러주세요.'); return; }
    studyTab.opener = null;
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/study/contributor/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ name: `${browser} 사용자 스크립트` }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? '연결 키 발급에 실패했습니다.');
      setPendingDeviceId(body.deviceId);
      setPendingSince(Date.now());
      setWaitingTooLong(false);
      studyTab.location.replace(`https://cbsh.edu-set.com/signin#cbgpu-key=${encodeURIComponent(body.deviceKey)}`);
      await loadDevices();
    } catch (error: any) {
      studyTab.close();
      showError(error.message ?? String(error));
    } finally {
      setCreating(false);
    }
  };

  const copyExtensionSettingsUrl = async () => {
    try {
      await navigator.clipboard.writeText(extensionDetailsUrl(browser));
      showSuccess(`${browser}의 Violentmonkey 상세정보 주소를 복사했습니다. 새 탭 주소창에 붙여넣어 주세요.`);
    } catch {
      showError('주소를 복사하지 못했습니다. 아래 주소를 길게 눌러 복사해 주세요.');
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm('이 브라우저 연결을 해제할까요? 해제하면 이 브라우저에서는 더 이상 자동 동기화되지 않습니다.')) return;
    const { error } = await supabase.from('eduset_contributor_devices').delete().eq('id', id);
    if (error) showError(error.message);
    else { showSuccess('기기 연결을 해제했습니다.'); await loadDevices(); }
  };

  if (isLoading) return <main className="mx-auto max-w-xl px-4 py-12 text-center text-sm text-muted-foreground">불러오는 중...</main>;
  if (!user) return <main className="mx-auto max-w-xl px-4 py-12 text-center"><p>먼저 CBGPU에 로그인해주세요.</p></main>;

  const syncedDevices = devices.filter((device) => device.last_used_at);
  const latestSync = syncedDevices.map((device) => device.last_used_at!).sort().at(-1);
  const guideVisible = showGuide || (!devicesLoading && syncedDevices.length === 0);

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <div className="flex items-center gap-2"><Puzzle className="size-6 text-primary" /><h1 className="text-3xl font-black tracking-tight">자습 조회 기여자</h1></div>
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-bold text-amber-800 dark:text-amber-300">
          이 설정은 데스크톱 환경에서만 가능합니다. 휴대폰에서는 진행하지 마세요.
        </div>
        <p className="text-sm text-muted-foreground">한 번 연결하면 데스크톱 브라우저에서 자습신청 사이트에 로그인할 때 자동으로 CBGPU가 갱신됩니다. 비밀번호는 가져오지 않습니다.</p>
      </div>

      {devicesLoading ? (
        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">연결 상태 확인 중...</div>
      ) : syncedDevices.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3">
          <div className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-500" /><h2 className="font-black">자동 갱신이 연결돼 있어요</h2></div>
          <p className="text-sm">이제 자습신청 사이트에 로그인하면 자동으로 CBGPU 토큰이 갱신됩니다!</p>
          <p className="text-xs text-muted-foreground">마지막 동기화: {latestSync ? new Date(latestSync).toLocaleString('ko-KR') : '확인 중'}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowGuide(true)}>다른 브라우저도 연결하기</Button>
        </div>
      )}

      {guideVisible && (
      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-emerald-500" /><h2 className="font-black">처음 한 번, 세 단계만 하면 됩니다</h2></div>
        <div className="rounded-xl bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-black">1. Violentmonkey 설치하고 허용하기</p>
          <p className="text-xs text-muted-foreground">아래 버튼을 누른 뒤 새 화면에서 <b>Chrome에 추가</b> 또는 <b>Brave에 추가</b>를 누르세요. 확인창이 뜨면 <b>확장 프로그램 추가</b>를 누르세요.</p>
          <Button asChild variant="outline" className="w-full gap-2">
            <a href="https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag" target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" /> Violentmonkey 설치 페이지</a>
          </Button>
          <p className="pt-2 text-xs text-muted-foreground">설치 후에는 사용자 스크립트를 한 번 허용해야 합니다. 이 스위치만은 브라우저에서 직접 켜야 합니다.</p>
          <div className="flex gap-2" role="group" aria-label="사용 중인 브라우저">
            {(['Chrome', 'Brave', 'Edge'] as const).map((option) => (
              <Button key={option} type="button" size="sm" variant={browser === option ? 'default' : 'outline'} onClick={() => setBrowser(option)} className="flex-1">
                {option}
              </Button>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={copyExtensionSettingsUrl} className="w-full gap-2"><Settings className="size-4" /> 설정 화면 주소 복사</Button>
          <ol className="list-decimal space-y-2 pl-5 text-xs text-muted-foreground">
            <li>위 버튼으로 설정 주소를 복사하세요.</li>
            <li>새 탭의 맨 위 주소창에 붙여넣고 Enter를 누르세요.</li>
            <li><b>사용자 스크립트 허용</b> 또는 <b>Allow User Scripts</b> 스위치를 켜세요.</li>
          </ol>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer underline">스위치가 안 보이나요?</summary>
            <p className="mt-2">브라우저를 최신 버전으로 업데이트해 주세요. 오래된 버전에서는 확장 프로그램 화면 오른쪽 위의 <b>개발자 모드</b>를 켜야 할 수 있습니다.</p>
          </details>
        </div>
        <div className="rounded-xl bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-black">2. CBGPU 스크립트 설치</p>
          <p className="text-xs text-muted-foreground">새 탭이 열리면 그 화면에서 <b>설치</b>를 누르세요.</p>
          <Button asChild variant="outline" className="w-full gap-2">
            <a href="/downloads/cbgpu-eduset-contributor.user.js" target="_blank" rel="noopener noreferrer"><Puzzle className="size-4" /> CBGPU 스크립트 설치</a>
          </Button>
        </div>
        <div className="rounded-xl bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-black">3. 연결하고 자습신청 로그인</p>
          <p className="text-xs text-muted-foreground">버튼을 누르면 CBGPU가 자동으로 연결되고 자습신청 사이트가 새 탭에 열립니다. 평소처럼 로그인하세요. 키를 복사하거나 입력할 필요가 없습니다.</p>
          <Button type="button" onClick={connectAndOpen} disabled={creating || !isApproved || (!!pendingDeviceId && !waitingTooLong)} className="w-full gap-2">
            <ExternalLink className="size-4" /> {creating ? '연결 중...' : '연결하고 자습신청 열기'}
          </Button>
          {pendingDeviceId && !waitingTooLong && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="size-3 animate-spin" /> 자습신청 로그인을 기다리는 중입니다. 성공하면 이 화면이 자동으로 바뀝니다.</p>}
          {pendingDeviceId && waitingTooLong && (
            <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2 text-xs">
              <p className="flex items-center gap-2 font-bold"><AlertTriangle className="size-4" /> 아직 동기화를 확인하지 못했습니다.</p>
              <p>자습신청 사이트에서 로그인을 마쳤는지 확인해 주세요. Violentmonkey의 CBGPU 스크립트 이름에 취소선이 있으면 1단계의 사용자 스크립트 허용 스위치를 다시 확인하세요.</p>
              <p>문제를 고친 뒤 자습신청 탭을 새로고침하면 다시 확인합니다.</p>
            </div>
          )}
        </div>
      </div>
      )}

      {devices.length > 0 && (
        <details className="space-y-2 rounded-xl border border-border/60 p-4">
          <summary className="cursor-pointer text-sm font-bold">연결 관리 · {devices.length}개</summary>
          <div className="mt-3 space-y-2">
          {devices.map((device) => (
            <div key={device.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
              <div><p className="font-bold">{device.name}</p><p className="text-xs text-muted-foreground">마지막 동기화: {device.last_used_at ? new Date(device.last_used_at).toLocaleString('ko-KR') : '아직 없음'}</p></div>
              <Button variant="ghost" size="sm" onClick={() => revoke(device.id)}>연결 해제</Button>
            </div>
          ))}
          </div>
        </details>
      )}
      <Link href="/study" className="block text-center text-sm underline text-muted-foreground">자습신청 조회로 돌아가기</Link>
    </main>
  );
}

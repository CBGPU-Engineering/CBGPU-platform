'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { LogIn, LogOut, DoorOpen, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import {
  getToken, signIn, signOut, getMe, getRooms,
  TURNSTILE_SITE_KEY, type Me, type Room,
} from '@/lib/eduset';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

function useTurnstile(onToken: (token: string) => void, onError: (message: string) => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    let widgetId: string | undefined;
    let cancelled = false;

    const render = () => {
      if (cancelled || !ref.current || !window.turnstile) {
        if (!cancelled) onError('Cloudflare Turnstile 위젯을 초기화하지 못했습니다.');
        return;
      }

      widgetId = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => {
          onToken(token);
          onError('');
        },
        'error-callback': () => {
          onToken('');
          onError('보안 인증이 차단됐습니다. 로컬 환경에서는 우회 모드로 계속할 수 있습니다.');
        },
        'expired-callback': () => {
          onToken('');
          onError('보안 인증이 만료됐습니다. 다시 시도해주세요.');
        },
      });
    };

    if (window.turnstile) {
      render();
    } else {
      const existing = document.getElementById('cf-turnstile-script');
      if (existing) {
        existing.addEventListener('load', render);
      } else {
        const script = document.createElement('script');
        script.id = 'cf-turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.onload = render;
        script.onerror = () => onError('Cloudflare Turnstile 스크립트를 불러오지 못했습니다.');
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [enabled, onError, onToken]);

  return ref;
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { showError } = useAlert();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState('');
  const [loading, setLoading] = useState(false);

  const isLocalHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const allowTurnstileBypass = isLocalHost || process.env.NEXT_PUBLIC_EDUSET_BYPASS_TURNSTILE === 'true';
  const turnstileRef = useTurnstile(
    useCallback((t: string) => setTurnstileToken(t), []),
    useCallback((message: string) => setTurnstileError(message), []),
    !allowTurnstileBypass,
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allowTurnstileBypass && !turnstileToken) {
      showError('보안 인증을 완료해주세요.');
      return;
    }

    setLoading(true);
    try {
      await signIn(id, password, allowTurnstileBypass ? undefined : turnstileToken);
      onSuccess();
    } catch (err: any) {
      showError(err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 max-w-sm mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tighter italic">자습신청</h1>
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
          학생관리시스템(edu-set) 계정으로 로그인
        </p>
      </div>
      <Input placeholder="아이디 또는 이메일" value={id} onChange={e => setId(e.target.value)} autoComplete="username" required />
      <Input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
      {!allowTurnstileBypass && <div ref={turnstileRef} />}
      {allowTurnstileBypass && (
        <p className="text-[10px] text-muted-foreground font-medium rounded-lg border border-dashed border-border/70 bg-muted/20 p-2">
          현재 환경에서는 Turnstile 인증이 막혀서 우회 모드로 진행합니다. 실제 계정 로그인 테스트 시에는 배포 도메인에서 다시 확인해주세요.
        </p>
      )}
      {turnstileError && (
        <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">{turnstileError}</p>
      )}
      <Button type="submit" disabled={loading} className="font-black uppercase tracking-widest gap-2">
        <LogIn className="size-4" /> {loading ? '로그인 중...' : '로그인'}
      </Button>
    </form>
  );
}

export default function StudyPage() {
  const { showError } = useAlert();
  const [me, setMe] = useState<Me | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  const loadAfterLogin = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [meRes, roomsRes] = await Promise.all([getMe(), getRooms()]);
      setMe(meRes);
      setRooms(roomsRes);
      setLoggedIn(true);
    } catch (err: any) {
      setError(err.message ?? String(err));
      setLoggedIn(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getToken()) {
      loadAfterLogin();
    } else {
      setLoading(false);
    }
  }, [loadAfterLogin]);

  const handleSignOut = () => {
    signOut();
    setMe(null);
    setRooms([]);
    setLoggedIn(false);
  };

  if (loading) {
    return (
      <main className="px-4 py-16 flex justify-center">
        <RefreshCw className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="px-4 py-16">
        <LoginForm onSuccess={loadAfterLogin} />
        {error && (
          <div className="flex items-start gap-3 p-3 mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl max-w-sm mx-auto">
            <AlertTriangle className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{error}</p>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="px-4 py-8 space-y-5 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">자습신청</h1>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
            {me?.student ? `${me.student.grade}학년 ${me.student.classNo}반 ${me.student.number}번 ${me.student.name}` : me?.username ?? me?.email}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => loadAfterLogin()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="font-black text-xs uppercase gap-1.5">
            <LogOut className="size-3.5" /> 로그아웃
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rooms.map(room => (
          <div key={room.id} className="flex items-center gap-3 p-4 rounded-2xl border border-border/40 bg-muted/10">
            <DoorOpen className="size-5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-black text-sm">{room.name}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                {room.hasSeats ? `${room.width} x ${room.height}` : '좌석 없음'}
              </p>
            </div>
          </div>
        ))}
        {rooms.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">자습실이 없습니다.</p>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        좌석 선택 및 신청/취소 기능은 다음 단계에서 추가됩니다.
      </p>
    </main>
  );
}

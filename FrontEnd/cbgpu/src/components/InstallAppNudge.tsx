'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Smartphone } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { isNativeApp, onNativeBridgeReady } from '@/lib/nativeBridge';

const DISMISS_KEY = 'cbgpu.installNudgeDismissed';

/** Only makes sense for someone using the site in a real Android browser —
 * already inside the app, or on desktop/iOS where there's nothing to install
 * yet, there's no point nudging. Dismissal persists per browser (localStorage)
 * so it doesn't nag every page load. */
export default function InstallAppNudge() {
  const { user, isLoading } = useAuth();
  const [isNative, setIsNative] = useState(false);
  const [show, setShow] = useState(false);

  // The app injects its bridge asynchronously after the WebView finishes
  // loading, which usually lands AFTER this component's first render — a
  // one-time isNativeApp() check here would almost always read "not native"
  // and show the "install the app" nudge from inside the app itself.
  useEffect(() => {
    if (isNativeApp()) {
      setIsNative(true);
      return;
    }
    return onNativeBridgeReady(() => setIsNative(true));
  }, []);

  useEffect(() => {
    if (isLoading || !user || isNative) {
      setShow(false);
      return;
    }
    if (!/Android/i.test(navigator.userAgent)) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // localStorage unavailable — just show it, worst case it's seen twice
    }
    setShow(true);
  }, [isLoading, user, isNative]);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // best-effort only
    }
  }

  if (!show) return null;

  return (
    // bottom-24: clears the fixed mobile bottom-nav pill (Navbar.tsx) below xl,
    // where it would otherwise sit right on top of it.
    <div className="fixed bottom-24 right-4 xl:bottom-4 z-40 max-w-[280px] animate-in fade-in slide-in-from-bottom-2 duration-500 ease-[var(--ease-spring)]">
      <div className="tilt-3d relative bg-card ring-1 ring-foreground/10 shadow-2xl rounded-2xl p-4 pr-8">
        <button
          onClick={dismiss}
          aria-label="닫기"
          className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-start gap-3">
          <span className="flex items-center justify-center size-9 rounded-xl bg-primary/10 text-primary shrink-0">
            <Smartphone className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black">안드로이드 앱을 설치해보세요</p>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5 mb-2">
              위젯, 알림까지 더 편하게 쓸 수 있어요
            </p>
            <Link
              href="/download"
              className="inline-block text-[11px] font-black uppercase tracking-widest text-primary hover:underline"
            >
              설치 방법 보기 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

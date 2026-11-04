'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { getNativeBridge, onNativeBridgeReady, isNativeAppHint } from '@/lib/nativeBridge';

type AuthContextType = {
  user: User | null;
  profile: any | null;
  isAdmin: boolean;
  is3DPrintManager: boolean;
  /** printer ids this person can actually change the state of (printer_managers mapping) */
  managedPrinterIds: number[];
  isLaserCutManager: boolean;
  /** is_admin이 아니어도 /admin/wakeup(기상송 검토·재생)을 볼 수 있는 별도 권한 */
  isWakeupManager: boolean;
  /** null(기본값)/true = 정상 이용 가능, false = 관리자가 학번/이름 확인이 필요하다고 표시한 상태 */
  isApproved: boolean;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isAdmin: false,
  is3DPrintManager: false,
  managedPrinterIds: [],
  isLaserCutManager: false,
  isWakeupManager: false,
  isApproved: true,
  isLoading: true,
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [managedPrinterIds, setManagedPrinterIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setProfile(data);
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    }
  };

  const fetchManagedPrinters = async (userId: string) => {
    try {
      const { data } = await supabase.from('printer_managers').select('printer_id').eq('user_id', userId);
      setManagedPrinterIds((data || []).map(r => r.printer_id));
    } catch (err) {
      console.error("Managed printers fetch error:", err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await Promise.all([fetchProfile(user.id), fetchManagedPrinters(user.id)]);
    }
  };

  useEffect(() => {
    if (['admin.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'].includes(window.location.hostname)) {
      let cancelled = false;
      let verified = false;
      let expectedUser = '';
      let csrf = '';
      let leaving = false;
      const abort = new AbortController();
      const leave = async () => {
        if (cancelled || leaving) return;
        leaving = true;
        try {
          if (csrf) await fetch('/portal/api/logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: '{}' });
        } finally { if (!cancelled) window.location.replace('/'); }
      };
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!verified || cancelled) return;
        if (!session || session.user.id !== expectedUser) { void leave(); return; }
        setUser(session.user);
      });
      void (async () => {
        try {
          const response = await fetch('/portal/session', { credentials: 'same-origin', cache: 'no-store', signal: abort.signal });
          if (!response.ok) throw new Error('Admin session unavailable');
          const gate = await response.json();
          csrf = typeof gate.csrf_token === 'string' ? gate.csrf_token : '';
          expectedUser = typeof gate.user_id === 'string' ? gate.user_id : '';
          if (!expectedUser || !csrf) { await leave(); return; }
          const { data: existing } = await supabase.auth.getSession();
          if (cancelled) return;
          let session = existing.session;
          // Preserve locally refreshed tokens for the same verified account.
          if (!session || session.user.id !== expectedUser) {
            if (!gate.session?.access_token || !gate.session?.refresh_token) { await leave(); return; }
            const restored = await supabase.auth.setSession({ access_token: gate.session.access_token, refresh_token: gate.session.refresh_token });
            if (restored.error) throw restored.error;
            session = restored.data.session;
          }
          if (!session || session.user.id !== expectedUser) { await leave(); return; }
          if (cancelled) return;
          setUser(session.user);
          await Promise.all([fetchProfile(expectedUser), fetchManagedPrinters(expectedUser)]);
          if (cancelled) return;
          verified = true;
          setIsLoading(false);
        } catch { if (!cancelled) await leave(); }
      })();
      return () => { cancelled = true; abort.abort(); subscription.unsubscribe(); };
    }

    // supabase-js fires onAuthStateChange immediately with whatever's in this
    // WebView's OWN localStorage (often nothing, right after an app restart —
    // that storage doesn't reliably survive one). Inside the native app we
    // hold off declaring "logged out" (isLoading stays true) until the
    // native-session fallback below has had its chance, instead of flashing
    // (or, if that fallback is slow, getting stuck on) AuthGate's "please log
    // in" screen a moment before the real session comes back. isNativeAppHint
    // is readable synchronously (via the ?native=1 the app's WebView always
    // loads with) unlike isNativeApp(), which needs the JS bridge script that
    // only gets injected once the page finishes loading.
    const nativeHint = isNativeAppHint();
    let resolved = false;
    const resolveLoading = () => {
      if (resolved) return;
      resolved = true;
      setIsLoading(false);
    };
    // Never wait forever — an old app build, a slow bridge injection, or a
    // genuinely session-less install should still land on the login screen
    // rather than spin indefinitely.
    const fallbackTimeout = nativeHint ? setTimeout(resolveLoading, 8000) : null;
    let restoringFromNative = false;
    const failedNativeRefreshTokens = new Set<string>();

    const restoreFromNative = async (bridge: NonNullable<ReturnType<typeof getNativeBridge>>) => {
      if (restoringFromNative) return;
      restoringFromNative = true;
      try {
        const { session: persisted } = await bridge.getPersistedSession();
        if (!persisted || failedNativeRefreshTokens.has(persisted.refreshToken)) return;
        const { error } = await supabase.auth.setSession({
          access_token: persisted.accessToken,
          refresh_token: persisted.refreshToken,
        });
        if (error) failedNativeRefreshTokens.add(persisted.refreshToken);
      } catch {
        // An older app build may not implement session restore.
      } finally {
        restoringFromNative = false;
        resolveLoading();
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser || !nativeHint || resolved) {
        resolveLoading();
      }

      // Fetch profile in the background after auth state is known
      if (currentUser) {
        fetchProfile(currentUser.id);
        fetchManagedPrinters(currentUser.id);
      } else {
        setProfile(null);
        setManagedPrinterIds([]);
      }

      // Keep the native app's own Supabase client (used for its home-screen
      // widgets, which this site's session can't reach on its own) in sync.
      const bridge = getNativeBridge();
      if (bridge) {
        if (session) {
          bridge.syncSession({ accessToken: session.access_token, refreshToken: session.refresh_token });
        } else if (event === 'SIGNED_OUT' && nativeHint) {
          // A web refresh can fail after the native client has rotated its
          // refresh token. Give the app's persisted session a chance to win.
          setTimeout(() => { void restoreFromNative(bridge); }, 0);
        }
      }
    });

    // The app injects window.CBGPUNative asynchronously after its WebView
    // finishes loading, which can land after the auth listener above has
    // already fired once — cover that race by syncing again once it's ready.
    const unsubscribeBridge = onNativeBridgeReady(async (bridge) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          bridge.syncSession({ accessToken: session.access_token, refreshToken: session.refresh_token });
          return;
        }
        // This WebView's own localStorage session didn't survive (app
        // restarts don't reliably keep it) — fall back to the native app's
        // own Supabase session, which supabase_flutter persists on its own,
        // so the user isn't forced to log in again every time they reopen it.
        await restoreFromNative(bridge);
      } catch {
        // Older app build without this bridge action, or the persisted
        // refresh token was rejected — just stays logged out.
      } finally {
        resolveLoading();
      }
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeBridge();
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
    };
  }, []);

  // Management controls belong exclusively to the separately authenticated admin host.
  const managementWorkspace = typeof window !== 'undefined' && ['admin.cbgpu.com','manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'].includes(window.location.hostname);
  const value = {
    user,
    profile,
    isAdmin: managementWorkspace && (profile?.is_admin || false),
    is3DPrintManager: managementWorkspace && managedPrinterIds.length > 0,
    managedPrinterIds: managementWorkspace ? managedPrinterIds : [],
    isLaserCutManager: managementWorkspace && (profile?.is_laser_cut_manager || false),
    isWakeupManager: managementWorkspace && (profile?.is_wakeup_manager || false),
    isApproved: profile?.is_approved !== false,
    isLoading,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

/**
 * Connector to the CBGPU Android/iOS app's WebView shell. The app has no UI
 * of its own beyond this site — it just wraps this page in a WebView and
 * injects `window.CBGPUNative` (see cbgpu_app's core/webview_shell.dart)
 * once the page finishes loading, giving the site access to things a
 * browser tab can't do on its own: exact scheduled local notifications, and
 * syncing this site's Supabase session into the app's native client so its
 * home-screen widgets can fetch personalized data.
 *
 * Every method here is a no-op-safe optional chain when running as a plain
 * website — always feature-detect with `isNativeApp()` before showing any
 * native-only UI.
 */

export type AlarmRepeat = 'none' | 'daily' | 'weekdays';

export interface ScheduleAlarmOptions {
  /** Stable id — scheduling again with the same id replaces the previous alarm. */
  id: string;
  title: string;
  body?: string;
  /** ISO 8601 datetime of the first (or, for repeating alarms, next) fire. */
  whenIso: string;
  repeat?: AlarmRepeat;
}

export interface StoredAlarm {
  id: string;
  title: string;
  body: string;
  whenIso: string;
  repeat: AlarmRepeat;
}

export interface NativeBridge {
  readonly isNative: true;
  readonly platform: string;
  scheduleAlarm(opts: ScheduleAlarmOptions): Promise<{ ok: true }>;
  cancelAlarm(id: string): Promise<{ ok: true }>;
  cancelAllAlarms(): Promise<{ ok: true }>;
  listAlarms(): Promise<StoredAlarm[]>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  syncSession(opts: { accessToken: string; refreshToken: string }): Promise<{ ok: true }>;
  clearSession(): Promise<{ ok: true }>;
  /** The app's own Supabase session, kept alive by supabase_flutter across
   * restarts even when this WebView's own localStorage doesn't survive one. */
  getPersistedSession(): Promise<{ session: { accessToken: string; refreshToken: string } | null }>;
}

declare global {
  interface Window {
    CBGPUNative?: NativeBridge;
  }
}

export function getNativeBridge(): NativeBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.CBGPUNative;
}

export function isNativeApp(): boolean {
  return !!getNativeBridge();
}

/**
 * Calls `callback` once the bridge exists. The app injects it asynchronously
 * after the WebView finishes loading, so it's frequently NOT there yet at
 * hydration time even inside the native app — code that only checks
 * `isNativeApp()` once on mount will usually miss it.
 *
 * Returns an unsubscribe function.
 */
export function onNativeBridgeReady(callback: (bridge: NativeBridge) => void): () => void {
  const existing = getNativeBridge();
  if (existing) {
    callback(existing);
    return () => {};
  }
  if (typeof window === 'undefined') return () => {};

  const handler = () => {
    const bridge = getNativeBridge();
    if (bridge) callback(bridge);
  };
  window.addEventListener('cbgpu-native-ready', handler);
  return () => window.removeEventListener('cbgpu-native-ready', handler);
}

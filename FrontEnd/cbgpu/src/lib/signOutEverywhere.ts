import { getNativeBridge } from '@/lib/nativeBridge';
import { supabase } from '@/lib/supabase';

/** Clear the app's persisted login only when the user explicitly signs out. */
export async function signOutEverywhere() {
  const bridge = getNativeBridge();
  if (bridge) await bridge.clearSession();
  return supabase.auth.signOut();
}

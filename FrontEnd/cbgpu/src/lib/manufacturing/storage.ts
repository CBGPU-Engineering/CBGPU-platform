import { supabase } from '@/lib/supabase';

// Best-effort cleanup; a failed delete here should never block the caller's DB update.
export async function deleteManufacturingFile(filePath?: string | null) {
  if (!filePath) return;
  try {
    await supabase.storage.from('manufacturing').remove([filePath]);
  } catch {
    // ignore
  }
}

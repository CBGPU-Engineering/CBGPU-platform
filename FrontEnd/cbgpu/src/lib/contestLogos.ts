import { supabase } from '@/lib/supabase';

export const LOGO_BUCKET = 'contest-logos';
export const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export function logoFileError(file: Pick<File, 'type' | 'size'>) {
  if (!LOGO_TYPES[file.type]) return '로고는 PNG, JPG, WebP 이미지로 올려 주세요.';
  if (!file.size || file.size > 2 * 1024 * 1024) return '로고는 2MB 이하의 이미지로 올려 주세요.';
  return null;
}
export function contestLogoUrl(path: string | null) {
  return path ? supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl : null;
}
export async function uploadContestLogo(file: File, userId: string) {
  const invalid = logoFileError(file);
  if (invalid) throw new Error(invalid);
  const path = `${userId}/${crypto.randomUUID()}.${LOGO_TYPES[file.type]}`;
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}
export async function cleanupContestLogo(path: string | null) {
  if (!path) return;
  try {
    const { error } = await supabase.storage.from(LOGO_BUCKET).remove([path]);
    if (error) console.error('Contest logo cleanup:', error.message);
  } catch (error) { console.error('Contest logo cleanup:', error); }
}

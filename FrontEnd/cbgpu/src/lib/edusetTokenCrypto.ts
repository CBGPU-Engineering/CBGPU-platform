import crypto from 'crypto';

/**
 * 자습신청 토큰을 Supabase에 평문으로 저장하지 않기 위한 AES-256-GCM 암복호화.
 * EDUSET_TOKEN_SECRET은 Supabase와 무관하게 직접 만든 임의의 문자열이면 된다
 * (예: `openssl rand -hex 32`). 이 키는 .env.local에만 존재하고 서버 밖으로 나가지 않는다.
 */
function getKey(): Buffer {
  const secret = process.env.EDUSET_TOKEN_SECRET;
  if (!secret) throw new Error('EDUSET_TOKEN_SECRET 환경변수가 설정되지 않았습니다.');
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptToken(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function getTokenExpiresAt(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload?.exp === 'number' ? new Date(payload.exp * 1000).toISOString() : null;
  } catch {
    return null;
  }
}

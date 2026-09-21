import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptToken } from '@/lib/edusetTokenCrypto';

const EDUSET = 'https://api.cbsh.edu-set.com';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = serviceRoleKey ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: NextRequest) {
  if (!supabase) return NextResponse.json({ message: '서버 동기화 키가 설정되지 않았습니다.' }, { status: 500 });
  const deviceKey = request.headers.get('x-cbgpu-device')?.trim();
  if (!deviceKey?.startsWith('cbgpu_')) return NextResponse.json({ message: '연결 키가 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const accessToken = String(body?.accessToken ?? '').trim().replace(/^Bearer\s+/i, '');
  const parts = accessToken.split('.');
  if (parts.length !== 3) return NextResponse.json({ message: '올바른 edu-set 토큰이 아닙니다.' }, { status: 400 });

  let expiresAt: Date;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number') throw new Error();
    expiresAt = new Date(payload.exp * 1000);
    if (expiresAt.getTime() <= Date.now() + 5 * 60_000) throw new Error();
  } catch {
    return NextResponse.json({ message: '만료됐거나 만료 시각이 없는 토큰입니다.' }, { status: 400 });
  }

  const verify = await fetch(`${EDUSET}/rooms`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!verify.ok) return NextResponse.json({ message: 'edu-set에서 토큰을 거절했습니다.' }, { status: 400 });

  const keyHash = crypto.createHash('sha256').update(deviceKey).digest('hex');
  const { data: accepted, error } = await supabase.rpc('accept_eduset_contribution', {
    p_key_hash: keyHash,
    p_token_enc: encryptToken(accessToken),
    p_expires_at: expiresAt.toISOString(),
  });
  if (error) return NextResponse.json({ message: '토큰 저장에 실패했습니다: ' + error.message }, { status: 500 });
  if (!accepted) return NextResponse.json({ message: '폐기됐거나 올바르지 않은 연결 키입니다.' }, { status: 403 });
  return NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString() });
}

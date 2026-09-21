import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptToken, encryptToken, getTokenExpiresAt } from '@/lib/edusetTokenCrypto';

const EDUSET_BASE_URL = 'https://api.cbsh.edu-set.com';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** 호출자의 Supabase 세션 토큰으로 RLS를 그대로 태워서 본인이 admin인지 확인한다 (서비스 롤 불필요) */
async function requireAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await client
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  return profile?.is_admin ? { user, client } : null;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: '관리자만 접근할 수 있습니다.' }, { status: 403 });
  }

  const { data } = await admin.client
    .from('eduset_settings')
    .select('access_token_enc, updated_at')
    .eq('id', 1)
    .maybeSingle();

  let expiresAt: string | null = null;
  if (data?.access_token_enc) {
    try {
      const token = decryptToken(data.access_token_enc);
      expiresAt = getTokenExpiresAt(token);
    } catch {
      // A legacy/non-JWT token can still be valid. Status reporting must not break token use.
    }
  }

  return NextResponse.json({ updatedAt: data?.updated_at ?? null, expiresAt });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: '관리자만 접근할 수 있습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  let accessToken = String(body?.accessToken ?? '').trim().replace(/^Bearer\s+/i, '');

  if (!accessToken) {
    return NextResponse.json({ message: 'accessToken을 입력해주세요.' }, { status: 400 });
  }

  const verify = await fetch(`${EDUSET_BASE_URL}/rooms`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!verify.ok) {
    return NextResponse.json(
      { message: '자습신청 사이트에서 토큰을 거절했습니다. 공식 사이트에서 다시 로그인해 새 토큰을 받아주세요.' },
      { status: 400 }
    );
  }

  let encrypted: string;
  try {
    encrypted = encryptToken(accessToken);
  } catch (err: any) {
    return NextResponse.json({ message: err.message ?? '토큰 암호화에 실패했습니다.' }, { status: 500 });
  }

  const { error } = await admin.client
    .from('eduset_settings')
    .upsert({ id: 1, access_token_enc: encrypted, updated_at: new Date().toISOString(), updated_by: admin.user.id, expires_at: getTokenExpiresAt(accessToken) });

  if (error) {
    return NextResponse.json({ message: `저장 중 오류가 발생했습니다: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

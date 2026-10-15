import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const AUTH_CACHE_TTL_MS = 60_000;
const MAX_AUTH_CACHE_ENTRIES = 300;
const authCache = new Map<string, number>(); // access token -> 유효 만료 시각 (승인된 경우만 저장)

function jwtSubject(token: string): string | null {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub ?? null;
  } catch {
    return null;
  }
}

/** 로그인 + 승인된 CBGPU 사용자인지 확인한다 (x-cbgpu-auth 헤더의 Supabase 액세스 토큰 기준). */
export async function requireApprovedUser(request: NextRequest) {
  const token = request.headers.get('x-cbgpu-auth')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;

  // 같은 사용자가 화면 하나를 열면 요청이 수십 개 연달아 온다 — 매번 Supabase를 두 번 왕복하지 않도록
  // 승인 확인 결과를 잠깐 기억한다 (관리자가 승인을 취소해도 최대 1분 안에 반영).
  const cachedUntil = authCache.get(token);
  if (cachedUntil && cachedUntil > Date.now()) return true;

  const subject = jwtSubject(token);
  if (!subject) return false;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  // 토큰 검증과 프로필 조회를 순차가 아니라 동시에 보낸다. 프로필 조회는 사용자 토큰으로 RLS를
  // 거치므로 위조된 토큰이면 어차피 거절되고, 아래에서 getUser 결과의 id와도 대조한다.
  const [{ data: { user }, error }, { data: profile, error: profileError }] = await Promise.all([
    client.auth.getUser(token),
    client.from('profiles').select('is_approved').eq('id', subject).maybeSingle(),
  ]);
  // 프로필을 못 읽었거나 행이 없으면 승인 여부를 알 수 없으니 거부한다.
  if (error || !user || user.id !== subject || profileError || !profile) return false;

  // null(기본값)/true는 정상 이용 가능, 관리자가 false로 내린 경우만 막는다
  const approved = profile.is_approved !== false;
  if (approved) {
    authCache.set(token, Date.now() + AUTH_CACHE_TTL_MS);
    while (authCache.size > MAX_AUTH_CACHE_ENTRIES) authCache.delete(authCache.keys().next().value as string);
  }
  return approved;
}

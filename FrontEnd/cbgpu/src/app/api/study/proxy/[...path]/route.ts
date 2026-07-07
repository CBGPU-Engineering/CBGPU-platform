import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptToken } from '@/lib/edusetTokenCrypto';

const BASE_URL = 'https://api.cbsh.edu-set.com';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 이 프록시는 관리자가 등록해둔 공유 토큰(admin 권한)으로 학교 API를 대신 호출한다.
 * 그래서 아무나 호출하면 안 되고, (1) 로그인+승인된 CBGPU 사용자만, (2) 실제 화면에서
 * 쓰는 조회성 엔드포인트만 통과시킨다 — 좌석 점유/해제 같은 쓰기 작업은 현재 어떤 화면에서도
 * 쓰지 않으므로 전부 막는다.
 */
// id는 숫자가 아니라 UUID인 리소스도 있어서(예: 학생 id) 자리표시자는
// 슬래시만 아니면 다 허용한다 — 경로 형태 자체는 여전히 고정돼 있어 안전하다.
const ID = '[^/]+';
const ALLOWED_ROUTES: { method: string; pattern: RegExp }[] = [
  { method: 'GET', pattern: /^\/rooms$/ },
  { method: 'GET', pattern: new RegExp(`^/rooms/${ID}/composition$`) },
  { method: 'GET', pattern: new RegExp(`^/rooms/${ID}/seats/occupations$`) },
  { method: 'GET', pattern: /^\/students$/ },
  { method: 'GET', pattern: new RegExp(`^/students/${ID}$`) },
  { method: 'GET', pattern: new RegExp(`^/users/${ID}$`) },
  { method: 'GET', pattern: /^\/policies\/selfstudy$/ },
  { method: 'POST', pattern: /^\/selfstudy\/search$/ },
];

function getProxyPathname(request: NextRequest): string {
  const pathname = request.nextUrl.pathname.replace(/^\/api\/study\/proxy\/?/, '/');
  return pathname === '/' ? '' : pathname;
}

async function requireApprovedUser(request: NextRequest) {
  const token = request.headers.get('x-cbgpu-auth')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return false;

  const { data: profile } = await client
    .from('profiles')
    .select('is_approved')
    .eq('id', user.id)
    .maybeSingle();

  // null(기본값)/true는 정상 이용 가능, 관리자가 false로 내린 경우만 막는다
  return profile?.is_approved !== false;
}

let cachedToken: { value: string | null; fetchedAt: number } | null = null;
const TOKEN_CACHE_TTL_MS = 60_000;

/** 관리자가 등록해둔 자습신청 토큰을 가져온다. 모든 방문자가 이 토큰으로 조회한다. */
async function getSharedToken(): Promise<string | null> {
  if (cachedToken && Date.now() - cachedToken.fetchedAt < TOKEN_CACHE_TTL_MS) {
    return cachedToken.value;
  }

  const { data } = await supabase
    .from('eduset_settings')
    .select('access_token_enc')
    .eq('id', 1)
    .maybeSingle();

  let value: string | null = null;
  if (data?.access_token_enc) {
    try {
      value = decryptToken(data.access_token_enc);
    } catch {
      value = null;
    }
  }

  cachedToken = { value, fetchedAt: Date.now() };
  return value;
}

export async function GET(request: NextRequest) {
  return proxyRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

async function proxyRequest(request: NextRequest) {
  const pathname = getProxyPathname(request);
  const allowed = ALLOWED_ROUTES.some(
    (r) => r.method === request.method && r.pattern.test(pathname)
  );
  if (!allowed) {
    return NextResponse.json({ message: '지원하지 않는 요청입니다.' }, { status: 403 });
  }

  if (!(await requireApprovedUser(request))) {
    return NextResponse.json({ message: '로그인 후 승인된 계정만 조회할 수 있습니다.' }, { status: 401 });
  }

  const targetUrl = new URL(`${pathname}${request.nextUrl.search}`, BASE_URL);
  const token = await getSharedToken();

  if (!token) {
    return NextResponse.json(
      { message: '관리자가 아직 자습신청 토큰을 등록하지 않았습니다.' },
      { status: 503 }
    );
  }

  const body = request.method === 'GET' ? undefined : await request.text();

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-jwt': token,
    },
    body,
  });

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

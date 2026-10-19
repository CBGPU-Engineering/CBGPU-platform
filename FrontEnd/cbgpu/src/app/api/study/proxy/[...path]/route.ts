import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptToken } from '@/lib/edusetTokenCrypto';
import { requireApprovedUser } from '@/lib/studyAuth';

// 함수가 기본값(iad1, 미국 동부)에서 돌면 Supabase·학교 API(둘 다 한국 근처) 왕복마다 태평양을 건넌다.
export const preferredRegion = 'icn1';

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
// EduSet IDs are numeric or UUID-like. Reject encoded separators and dot
// segments before constructing a URL with the shared administrator token.
const ID = '[A-Za-z0-9_-]+';
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

const MAX_CACHE_ENTRIES = 300;

function trimCache<K, V>(cache: Map<K, V>) {
  while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as K);
}

let cachedToken: { value: string | null; fetchedAt: number } | null = null;
const TOKEN_CACHE_TTL_MS = 60_000;

function getResponseContentType(headers: Headers): string {
  // Some upstream responses contain the Content-Type header more than once.
  // Fetch joins duplicate values with a comma, but that joined value is not a
  // valid media type and runtimes such as Deno reject it when constructing the
  // downstream response. Only forward the first complete media type.
  const value = headers.get('content-type');
  return value?.split(',')[0].trim() || 'application/json';
}

/** 관리자가 등록해둔 자습신청 토큰을 가져온다. 모든 방문자가 이 토큰으로 조회한다. */
async function getSharedToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh && cachedToken && Date.now() - cachedToken.fetchedAt < TOKEN_CACHE_TTL_MS) {
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

type UpstreamResult = { status: number; body: string; contentType: string };

// 모든 방문자가 같은 공유 토큰으로 같은 데이터를 보므로 응답을 사용자와 무관하게 공유한다.
// 방 구성·학생 목록·정책은 거의 안 바뀌어서 오래, 신청 현황(search/occupations)만 짧게 둔다.
// 같은 요청이 동시에 여러 개 오면 하나만 학교 API로 보내고 나머지는 그 결과를 기다린다.
const responseCache = new Map<string, { expires: number; promise: Promise<UpstreamResult> }>();
const STATIC_TTL_MS = 5 * 60_000;
const LIVE_TTL_MS = 15_000;
const MAX_BODY_CHARS = 1_000;

function ttlFor(pathname: string) {
  return pathname === '/selfstudy/search' || pathname.endsWith('/seats/occupations') ? LIVE_TTL_MS : STATIC_TTL_MS;
}

async function callUpstream(request: NextRequest, targetUrl: URL, body: string | undefined): Promise<UpstreamResult> {
  const token = await getSharedToken();
  if (!token) {
    return { status: 503, body: JSON.stringify({ message: '관리자가 아직 자습신청 토큰을 등록하지 않았습니다.' }), contentType: 'application/json' };
  }

  const send = (accessToken: string) => fetch(targetUrl, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'x-jwt': accessToken,
    },
    body,
  });

  let upstream = await send(token);
  // An admin may have replaced an expired token while this server instance still has
  // the old value cached. Refresh from Supabase and retry once so the fix is immediate.
  if (upstream.status === 401) {
    const refreshedToken = await getSharedToken(true);
    if (refreshedToken && refreshedToken !== token) upstream = await send(refreshedToken);
  }

  return { status: upstream.status, body: await upstream.text(), contentType: getResponseContentType(upstream.headers) };
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
  const body = request.method === 'GET' ? undefined : await request.text();
  if (body && body.length > MAX_BODY_CHARS) {
    return NextResponse.json({ message: '요청이 너무 큽니다.' }, { status: 413 });
  }

  const key = `${request.method} ${pathname}${request.nextUrl.search}\n${body ?? ''}`;
  const forceFresh = request.headers.get('x-cbgpu-fresh') === '1'; // 사용자가 직접 새로고침을 눌렀을 때
  const cached = responseCache.get(key);

  let promise: Promise<UpstreamResult>;
  if (!forceFresh && cached && cached.expires > Date.now()) {
    promise = cached.promise;
  } else {
    promise = callUpstream(request, targetUrl, body);
    const entry = { expires: Date.now() + ttlFor(pathname), promise };
    responseCache.set(key, entry);
    trimCache(responseCache);
    // 실패 응답이나 예외는 기억하지 않는다 — 다음 요청이 바로 다시 시도한다.
    promise.then(
      (result) => { if (result.status !== 200 && responseCache.get(key) === entry) responseCache.delete(key); },
      () => { if (responseCache.get(key) === entry) responseCache.delete(key); },
    );
  }

  const result = await promise;
  return new NextResponse(result.body, {
    status: result.status,
    headers: { 'Content-Type': result.contentType, 'Cache-Control': 'no-store' },
  });
}

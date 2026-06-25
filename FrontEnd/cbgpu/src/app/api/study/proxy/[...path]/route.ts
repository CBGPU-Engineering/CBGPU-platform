import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptToken } from '@/lib/edusetTokenCrypto';

const BASE_URL = 'https://api.cbsh.edu-set.com';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-jwt, x-study-token',
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function getProxyPath(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/^\/api\/study\/proxy\/?/, '/');
  const path = pathname === '/' ? '' : pathname;
  return `${path}${request.nextUrl.search}`;
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

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  return proxyRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request);
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request);
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request);
}

async function proxyRequest(request: NextRequest) {
  const targetPath = getProxyPath(request);
  const targetUrl = new URL(targetPath, BASE_URL);
  const token = await getSharedToken();

  if (!token) {
    return new NextResponse(
      JSON.stringify({ message: '관리자가 아직 자습신청 토큰을 등록하지 않았습니다.' }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();

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
      ...CORS_HEADERS,
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

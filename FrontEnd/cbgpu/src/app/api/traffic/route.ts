import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { readJsonBody, WindowRateLimiter } from '@/lib/requestSecurity';
const limits = new WindowRateLimiter(120, 60_000);

export async function POST(request: NextRequest) {
  if (request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') return new NextResponse(null, { status: 204 });
  if (!['https://cbgpu.com', 'http://localhost:3000', 'http://127.0.0.1:3000'].includes(request.headers.get('origin') || '')) return new NextResponse(null, { status: 403 });
  const key = process.env.CBGPU_TRAFFIC_SECRET;
  if (!key) return new NextResponse(null, { status: 204 });
  if (!limits.allow(request.headers.get('cf-connecting-ip') || 'local')) return new NextResponse(null, { status: 429 });
  try {
    const body = await readJsonBody(request, 1024) as { path?: unknown };
    if (typeof body?.path !== 'string' || !body.path.startsWith('/') || body.path.length > 500 || /^\/(api|backend|_next)(\/|$)/.test(body.path)) return new NextResponse(null, { status: 400 });
    const saved = request.cookies.get('cbgpu-visitor')?.value;
    const visitorId = saved && /^[a-f0-9-]{36}$/.test(saved) ? saved : crypto.randomUUID();
    const day = new Date().toISOString().slice(0, 10);
    const visitor = crypto.createHmac('sha256', key).update(day + ':' + visitorId).digest('hex');
    const result = await fetch('http://127.0.0.1:3400/internal/traffic', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cbgpu-ingest-key': key }, body: JSON.stringify({ visitor }), signal: AbortSignal.timeout(1500), cache: 'no-store' });
    const response = new NextResponse(null, { status: result.ok ? 204 : 503 });
    if (result.ok && !saved) response.cookies.set('cbgpu-visitor', visitorId, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30 * 86400, path: '/' });
    return response;
  } catch { return new NextResponse(null, { status: 204 }); }
}

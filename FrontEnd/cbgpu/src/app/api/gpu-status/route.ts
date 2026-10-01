import { NextResponse } from 'next/server';
import { fetchGpuEndpoints } from '@/lib/gpuEndpoints';

export const dynamic = 'force-dynamic';

async function ping(url: string): Promise<'online' | 'offline'> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    const r = await fetch(url, { method: 'GET', signal: ac.signal, redirect: 'follow' });
    clearTimeout(t);
    return r.ok ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}

export async function GET() {
  const endpoints = await fetchGpuEndpoints();
  const results = await Promise.all(
    endpoints.map(async g => ({ id: g.gpu_id, status: await ping(g.public_url), url: g.public_url }))
  );
  return NextResponse.json({ gpus: results, checkedAt: new Date().toISOString() });
}

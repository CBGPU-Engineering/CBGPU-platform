import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GPUS = [
  { id: 1, url: 'https://valley-cst-syntax-serum.trycloudflare.com' },
  { id: 2, url: 'https://lakes-signatures-utility-entering.trycloudflare.com' },
  { id: 3, url: 'https://preparation-barbara-ocean-physics.trycloudflare.com' },
  { id: 4, url: 'https://bite-tabs-dual-integrated.trycloudflare.com' },
];

async function ping(url: string): Promise<'online' | 'offline'> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    const r = await fetch(url, { method: 'HEAD', signal: ac.signal, redirect: 'follow' });
    clearTimeout(t);
    return r.status < 500 ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}

export async function GET() {
  const results = await Promise.all(
    GPUS.map(async g => ({ id: g.id, status: await ping(g.url), url: g.url }))
  );
  return NextResponse.json({ gpus: results, checkedAt: new Date().toISOString() });
}

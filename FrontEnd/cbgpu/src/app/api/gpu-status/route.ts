import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GPUS = [
  { id: 1, url: 'https://tonight-rep-admit-cooperation.trycloudflare.com' },
  { id: 2, url: 'https://nearest-situations-elite-tools.trycloudflare.com' },
  { id: 3, url: 'https://expressions-invention-investments-consortium.trycloudflare.com' },
  { id: 4, url: 'https://september-notification-pants-whatever.trycloudflare.com' },
];

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
  const results = await Promise.all(
    GPUS.map(async g => ({ id: g.id, status: await ping(g.url), url: g.url }))
  );
  return NextResponse.json({ gpus: results, checkedAt: new Date().toISOString() });
}

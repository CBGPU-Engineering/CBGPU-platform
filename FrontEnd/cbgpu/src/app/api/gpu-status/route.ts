import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GPUS = [
  { id: 1, url: 'https://bbb1f73aa6bd31.lhr.life' },
  { id: 2, url: 'https://109a33522c2e35.lhr.life' },
  { id: 3, url: 'https://ccb4e81a1e065b.lhr.life' },
  { id: 4, url: 'https://d145edf2d1b8f1.lhr.life' },
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

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GPUS = [
  { id: 1, url: 'https://9742905062627d.lhr.life' },
  { id: 2, url: 'https://9d1383bf1b937c.lhr.life' },
  { id: 3, url: 'https://e82966052c9da3.lhr.life' },
  { id: 4, url: 'https://5144016024ce2b.lhr.life' },
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

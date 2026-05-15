import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FEEDS = {
  notice: 'https://school.cbe.go.kr/rss/cbs-h/M010401',
  letter: 'https://school.cbe.go.kr/rss/cbs-h/M010403',
  schedule: 'https://school.cbe.go.kr/rss/cbs-h/M010407',
} as const;

function extract(tag: string, xml: string): string {
  return (
    xml.match(new RegExp(`<${tag}><\\!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))?.[1] ||
    xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1] ||
    ''
  ).trim();
}

function parseRSS(xml: string) {
  const items: { title: string; link: string; pubDate: string; author: string }[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    const title = extract('title', b);
    const link = extract('link', b) || extract('guid', b);
    const pubDate = extract('pubDate', b);
    const author = extract('author', b);
    if (title) items.push({ title, link, pubDate, author });
  }
  return items;
}

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get('type') || 'notice') as keyof typeof FEEDS;
  const url = FEEDS[type] ?? FEEDS.notice;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CBGPU/1.0)' },
      next: { revalidate: 600 },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const xml = await res.text();
    return NextResponse.json({ items: parseRSS(xml) });
  } catch (e) {
    return NextResponse.json({ items: [], error: String(e) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Keeps the existing YouTube player working after a Spotify catalogue selection. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const key = process.env.YOUTUBE_API_KEY;
  if (!q || q.length > 180) return NextResponse.json({ message: '곡 정보가 올바르지 않아요.' }, { status: 400 });
  if (!key) return NextResponse.json({ message: 'YouTube 재생 검색이 설정되지 않았어요.' }, { status: 503 });
  try {
    const params = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '1', q: `${q} official audio`, key });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    const data = await response.json();
    const videoId = data.items?.[0]?.id?.videoId;
    if (!response.ok || !videoId) return NextResponse.json({ message: 'YouTube 재생 영상을 찾지 못했어요.' }, { status: 502 });
    return NextResponse.json({ videoId });
  } catch {
    return NextResponse.json({ message: 'YouTube 재생 영상을 찾지 못했어요.' }, { status: 502 });
  }
}

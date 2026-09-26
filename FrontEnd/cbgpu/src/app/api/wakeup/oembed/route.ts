import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Thin server-side proxy for YouTube's oEmbed endpoint — lets the request
 * form show the real title/channel/thumbnail before someone submits a link,
 * without depending on the browser's CORS behavior toward youtube.com. */
export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('videoId');
  if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) {
    return NextResponse.json({ message: '올바른 영상 ID가 아니에요.' }, { status: 400 });
  }

  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json({ message: '해당 영상을 찾을 수 없어요. 공개된 유튜브 링크인지 확인해 주세요.' }, { status: 404 });
    }
    const data = await res.json();
    return NextResponse.json({
      title: data.title,
      channelTitle: data.author_name,
      thumbnailUrl: data.thumbnail_url,
    });
  } catch {
    return NextResponse.json({ message: '유튜브 정보를 가져오지 못했어요.' }, { status: 502 });
  }
}

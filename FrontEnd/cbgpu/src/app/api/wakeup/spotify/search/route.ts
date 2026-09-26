import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyAppToken, spotifyApi } from '@/lib/spotify';

export const dynamic = 'force-dynamic';

type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  artists?: { name: string }[];
  album?: { images?: { url: string }[] };
  external_urls?: { spotify?: string };
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length > 100) return NextResponse.json({ message: '검색어를 입력해 주세요.' }, { status: 400 });
  try {
    const token = await getSpotifyAppToken();
    // Spotify Search currently permits at most 10 results per request.
    const response = await spotifyApi(`/search?${new URLSearchParams({ q, type: 'track', limit: '10', market: 'KR' })}`, token);
    if (!response.ok) return NextResponse.json({ message: 'Spotify 검색에 실패했어요.' }, { status: 502 });
    const data = await response.json();
    const items = ((data.tracks?.items ?? []) as SpotifyTrack[]).map((track) => ({
      id: track.id,
      uri: track.uri,
      title: track.name,
      artists: (track.artists ?? []).map((artist) => artist.name).join(', '),
      thumbnailUrl: track.album?.images?.[1]?.url ?? track.album?.images?.[0]?.url ?? null,
      spotifyUrl: track.external_urls?.spotify,
    }));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ message: 'Spotify 검색 설정이 필요해요.' }, { status: 503 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSpotifyAppToken, spotifyApi } from '@/lib/spotify';
import { WAKEUP_CATALOG_TRACK_IDS } from '@/lib/wakeupCatalog';

export const dynamic = 'force-dynamic';

async function isManager(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: { user } } = await client.auth.getUser(token);
  if (!user) return false;
  const { data } = await client.from('profiles').select('is_admin,is_wakeup_manager').eq('id', user.id).maybeSingle();
  return !!(data?.is_admin || data?.is_wakeup_manager);
}

export async function POST(request: NextRequest) {
  if (!(await isManager(request))) return NextResponse.json({ message: '기상송 담당자 권한이 필요해요.' }, { status: 403 });
  const youtubeKey = process.env.YOUTUBE_API_KEY;
  if (!youtubeKey) return NextResponse.json({ message: 'YouTube 설정이 필요해요.' }, { status: 503 });
  const body = await request.json().catch(() => null);
  const count = Math.min(Math.max(Number(body?.count) || 0, 0), 8);
  const usedUris = new Set(Array.isArray(body?.usedUris) ? body.usedUris.filter((uri: unknown): uri is string => typeof uri === 'string') : []);
  if (!count) return NextResponse.json({ items: [] });
  try {
    const token = await getSpotifyAppToken();
    const catalog = [...WAKEUP_CATALOG_TRACK_IDS];
    // Spotify's development mode rejects the batch /tracks endpoint but
    // permits an individual /tracks/{id} lookup. Shuffle IDs and resolve
    // only until the requested number of verified slots has been filled.
    for (let index = catalog.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [catalog[index], catalog[swap]] = [catalog[swap], catalog[index]];
    }
    const items: any[] = [];
    for (const trackId of catalog) {
      if (items.length === count) break;
      const trackResponse = await spotifyApi(`/tracks/${trackId}?market=KR`, token);
      if (!trackResponse.ok) continue;
      const track = await trackResponse.json().catch(() => null);
      if (!track?.uri || usedUris.has(track.uri)) continue;
      const yt = await fetch(`https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '1', q: `${track.name} ${track.artists?.[0]?.name ?? ''} official audio`, key: youtubeKey })}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
      const videoId = (await yt.json().catch(() => null))?.items?.[0]?.id?.videoId;
      if (!videoId) continue;
      items.push({ id: null, isFiller: true, _key: `ai-${track.id}`, title: track.name, thumbnail_url: track.album?.images?.[1]?.url ?? null, youtube_video_id: videoId, spotify_uri: track.uri, spotify_url: track.external_urls?.spotify, status: 'approved' });
      usedUris.add(track.uri);
    }
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ message: '추천곡 목록을 채우지 못했어요. 다시 시도해 주세요.' }, { status: 502 });
  }
}

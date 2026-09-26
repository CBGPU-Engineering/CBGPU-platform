import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSpotifyAppToken, spotifyApi } from '@/lib/spotify';

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
  const key = process.env.NVIDIA_API_KEY;
  const youtubeKey = process.env.YOUTUBE_API_KEY;
  if (!key || !youtubeKey) return NextResponse.json({ message: 'AI 또는 YouTube 설정이 필요해요.' }, { status: 503 });
  const body = await request.json().catch(() => null);
  const count = Math.min(Math.max(Number(body?.count) || 0, 0), 8);
  const songs = Array.isArray(body?.songs) ? body.songs.slice(0, 8).map((song: unknown) => typeof song === 'string' ? song.slice(0, 160) : '').filter(Boolean) : [];
  if (!count) return NextResponse.json({ items: [] });
  try {
    const token = await getSpotifyAppToken();
    const items: any[] = [];
    const usedUris = new Set<string>();
    // One recommendation at a time: each accepted song becomes context for
    // the next request, keeping the final eight varied rather than a batch of
    // near-identical suggestions.
    for (let attempt = 0; items.length < count && attempt < count * 5; attempt++) {
      const context = [...songs, ...items.map(item => `${item.title} — AI 추천곡`)].join(' | ') || 'none';
      const ai = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'google/diffusiongemma-26b-a4b-it', messages: [{ role: 'system', content: 'Recommend exactly one upbeat wake-up song. Return ONLY JSON: {"title":"...","artist":"..."}. No markdown.' }, { role: 'user', content: `Already in this morning lineup: ${context}. Give one different song that complements it.` }], max_tokens: 100, stream: false }), signal: AbortSignal.timeout(25_000), cache: 'no-store' });
      if (!ai.ok) continue;
      const aiData = await ai.json().catch(() => null);
      const raw = aiData?.choices?.[0]?.message?.content;
      let pick: { title?: unknown; artist?: unknown } | null = null;
      try { pick = typeof raw === 'string' ? JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '')) : null; } catch { continue; }
      if (typeof pick?.title !== 'string' || typeof pick?.artist !== 'string') continue;
      const search = await spotifyApi(`/search?${new URLSearchParams({ q: `track:${pick.title} artist:${pick.artist}`, type: 'track', limit: '1', market: 'KR' })}`, token);
      const track = (await search.json().catch(() => null))?.tracks?.items?.[0];
      if (!track?.uri || usedUris.has(track.uri)) continue;
      const yt = await fetch(`https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '1', q: `${track.name} ${track.artists?.[0]?.name ?? ''} official audio`, key: youtubeKey })}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
      const videoId = (await yt.json().catch(() => null))?.items?.[0]?.id?.videoId;
      if (!videoId) continue;
      items.push({ id: null, isFiller: true, _key: `ai-${track.id}`, title: track.name, thumbnail_url: track.album?.images?.[1]?.url ?? null, youtube_video_id: videoId, spotify_uri: track.uri, spotify_url: track.external_urls?.spotify, status: 'approved' });
      usedUris.add(track.uri);
    }
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ message: 'AI 추천곡을 만들지 못했어요. 다시 시도해 주세요.' }, { status: 502 });
  }
}

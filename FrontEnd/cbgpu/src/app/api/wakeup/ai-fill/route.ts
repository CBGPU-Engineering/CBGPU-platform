import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  const body = await request.json().catch(() => null);
  const count = Math.min(Math.max(Number(body?.count) || 0, 0), 8);
  const usedUris = new Set(Array.isArray(body?.usedUris) ? body.usedUris.filter((uri: unknown): uri is string => typeof uri === 'string') : []);
  if (!count) return NextResponse.json({ items: [] });
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ message: '로그인이 필요해요.' }, { status: 401 });
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await client.from('wakeup_songs')
      .select('id,title,channel_title,thumbnail_url,spotify_track_id,spotify_uri,spotify_url')
      .gte('created_at', since)
      .in('status', ['approved', 'playing', 'played'])
      .not('spotify_uri', 'is', null)
      .limit(500);
    if (error) return NextResponse.json({ message: '최근 신청곡을 불러오지 못했어요.' }, { status: 502 });
    const unique = new Map<string, any>();
    for (const song of data ?? []) if (song.spotify_uri && !usedUris.has(song.spotify_uri)) unique.set(song.spotify_uri, song);
    const catalog = [...unique.values()];
    if (!catalog.length) return NextResponse.json({ message: '최근 30일 안에 자동 채움에 사용할 Spotify 신청곡이 없어요.' }, { status: 400 });
    for (let index = catalog.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [catalog[index], catalog[swap]] = [catalog[swap], catalog[index]];
    }
    const items: any[] = [];
    for (const track of catalog) {
      if (items.length === count) break;
      items.push({ ...track, id: null, isFiller: true, _key: `recent-${track.spotify_track_id ?? track.spotify_uri}`, youtube_video_id: '', status: 'approved' });
      usedUris.add(track.spotify_uri);
    }
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ message: '추천곡 목록을 채우지 못했어요. 다시 시도해 주세요.' }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { spotifyApi } from '@/lib/spotify';

export const dynamic = 'force-dynamic';

async function requireManager(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: { user } } = await client.auth.getUser(token);
  if (!user) return false;
  const { data } = await client.from('profiles').select('is_admin, is_wakeup_manager').eq('id', user.id).maybeSingle();
  return !!(data?.is_admin || data?.is_wakeup_manager);
}

export async function POST(request: NextRequest) {
  if (!(await requireManager(request))) return NextResponse.json({ message: '기상송 담당자 권한이 필요해요.' }, { status: 403 });
  const refreshToken = (await cookies()).get('wakeup_spotify_refresh')?.value;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!refreshToken || !clientId) return NextResponse.json({ message: '먼저 Spotify 계정을 연결해 주세요.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.slice(0, 100) : '';
  const tracks = Array.isArray(body?.tracks) ? [...new Set(body.tracks.filter((track: unknown) => typeof track === 'string' && /^spotify:track:[A-Za-z0-9]+$/.test(track)))].slice(0, 100) : [];
  if (!name || tracks.length === 0) return NextResponse.json({ message: '플레이리스트에 넣을 Spotify 곡이 없어요.' }, { status: 400 });
  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken }), cache: 'no-store' });
  const token = await tokenResponse.json().catch(() => null);
  if (!tokenResponse.ok || !token?.access_token) return NextResponse.json({ message: 'Spotify 연결이 만료됐어요. 다시 연결해 주세요.' }, { status: 401 });
  const playlistResponse = await spotifyApi('/me/playlists', token.access_token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description: 'CBGPU 기상송 신청곡', public: true }) });
  const playlist = await playlistResponse.json().catch(() => null);
  if (!playlistResponse.ok || !playlist?.id) return NextResponse.json({ message: 'Spotify 플레이리스트 생성에 실패했어요.' }, { status: 502 });
  const addResponse = await spotifyApi(`/playlists/${playlist.id}/items`, token.access_token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uris: tracks }) });
  if (!addResponse.ok) return NextResponse.json({ message: '플레이리스트는 만들었지만 곡 추가에 실패했어요.' }, { status: 502 });
  return NextResponse.json({ id: playlist.id, url: playlist.external_urls?.spotify });
}

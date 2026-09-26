import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { spotifyRedirectUri } from '@/lib/spotifyRedirect';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const fail = (reason: string) => NextResponse.redirect(new URL(`/admin/wakeup?spotify=${reason}`, request.url));
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const saved = (await cookies()).get('wakeup_spotify_oauth')?.value;
  let oauth: { state: string; verifier: string } | null = null;
  try { oauth = saved ? JSON.parse(saved) : null; } catch { /* invalid cookie */ }
  if (!code || !oauth || oauth.state !== state) return fail('failed');
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) return fail('not-configured');
  const redirectUri = spotifyRedirectUri(request.url);
  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: oauth.verifier }),
    cache: 'no-store',
  });
  const token = await tokenResponse.json().catch(() => null);
  if (!tokenResponse.ok || !token?.refresh_token) return fail('failed');
  const response = NextResponse.redirect(new URL('/admin/wakeup?spotify=connected', request.url));
  response.cookies.set('wakeup_spotify_refresh', token.refresh_token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 180, path: '/' });
  response.cookies.delete('wakeup_spotify_oauth');
  return response;
}

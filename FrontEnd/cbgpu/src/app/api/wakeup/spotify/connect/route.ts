import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { spotifyRedirectUri } from '@/lib/spotifyRedirect';

export const dynamic = 'force-dynamic';

const b64url = (value: Buffer) => value.toString('base64url');

export async function GET(request: Request) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL('/admin/wakeup?spotify=not-configured', request.url));
  const state = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(64));
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const redirectUri = spotifyRedirectUri(request.url);
  const authorize = new URL('https://accounts.spotify.com/authorize');
  authorize.search = new URLSearchParams({
    client_id: clientId, response_type: 'code', redirect_uri: redirectUri, state,
    code_challenge_method: 'S256', code_challenge: challenge,
    scope: 'playlist-modify-public playlist-modify-private',
  }).toString();
  const response = NextResponse.redirect(authorize);
  response.cookies.set('wakeup_spotify_oauth', JSON.stringify({ state, verifier }), { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return response;
}

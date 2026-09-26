type SpotifyToken = { access_token: string; expires_in: number };

let appToken: { value: string; expiresAt: number } | null = null;

function credentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify API credentials are not configured.');
  return { clientId, clientSecret };
}

/** A short-lived app token used only for public catalogue searches. */
export async function getSpotifyAppToken() {
  if (appToken && appToken.expiresAt > Date.now() + 60_000) return appToken.value;
  const { clientId, clientSecret } = credentials();
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Spotify token request failed.');
  const token = await response.json() as SpotifyToken;
  appToken = { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
  return token.access_token;
}

export async function spotifyApi(path: string, accessToken: string, init: RequestInit = {}) {
  return fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...init.headers },
    cache: 'no-store',
  });
}

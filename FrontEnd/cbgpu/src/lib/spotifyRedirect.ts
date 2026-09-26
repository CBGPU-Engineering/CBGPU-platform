/** Must exactly match one of the Redirect URIs registered in Spotify Dashboard. */
export function spotifyRedirectUri(requestUrl: string) {
  return process.env.SPOTIFY_REDIRECT_URI || new URL('/api/wakeup/spotify/callback', requestUrl).toString();
}

/** Pulls the video id out of the handful of URL shapes people actually paste
 * (watch, youtu.be, shorts, already-an-embed-link). Returns null for
 * anything else rather than guessing. */
export function extractYoutubeId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (u.pathname === '/watch') return u.searchParams.get('v');
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
    if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null;
  }
  return null;
}

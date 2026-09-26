/** Shared between /wakeup (read-only lineup preview) and /admin/wakeup
 * (actual playback) so both always agree on what fills a day's remaining
 * slots — a day is always exactly SONGS_PER_DAY entries. */
export const SONGS_PER_DAY = 8;

const FILLER_VIDEO_ID = 'gFx-NjTw3sM';

export function makeFillerSong(index: number) {
  return {
    id: null,
    isFiller: true as const,
    title: "Claude's Plan (자동 채움)",
    thumbnail_url: `https://i.ytimg.com/vi/${FILLER_VIDEO_ID}/hqdefault.jpg`,
    youtube_video_id: FILLER_VIDEO_ID,
    status: 'approved' as const,
    _key: `filler-${index}`,
  };
}

/** Pads `songs` (assumed already sorted oldest-first) up to SONGS_PER_DAY
 * with filler entries — the same fixed lineup size shown on /wakeup and
 * actually played from /admin/wakeup. */
export function withFiller<T>(songs: T[]): (T | ReturnType<typeof makeFillerSong>)[] {
  const padded: (T | ReturnType<typeof makeFillerSong>)[] = [...songs];
  while (padded.length < SONGS_PER_DAY) padded.push(makeFillerSong(padded.length));
  return padded;
}

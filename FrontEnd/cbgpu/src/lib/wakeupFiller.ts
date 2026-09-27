/** Shared between /wakeup (read-only lineup preview) and /admin/wakeup
 * (actual playback) so both always agree on what fills a day's remaining
 * slots — a day is always exactly SONGS_PER_DAY entries. */
export const SONGS_PER_DAY = 8;

export function makeFillerSong(index: number) {
  return {
    id: null,
    isFiller: true as const,
    title: 'AI 추천곡 자동 채움',
    thumbnail_url: null,
    youtube_video_id: '',
    status: 'approved' as const,
    _key: `filler-${index}`,
  };
}

/** Spreads `fillerSongs` evenly among `realSongs` instead of piling them all
 * at the end — a lineup that's mostly filler used to play as "every real
 * request back-to-back, then five auto-fill songs in a row"; this makes the
 * two kinds alternate roughly evenly across the day's SONGS_PER_DAY slots. */
export function arrangeLineup<T, F>(realSongs: T[], fillerSongs: F[]): (T | F)[] {
  const real = realSongs.slice(0, SONGS_PER_DAY);
  const filler = fillerSongs.slice(0, Math.max(0, SONGS_PER_DAY - real.length));
  const total = real.length + filler.length;
  const result: (T | F)[] = [];
  let realIndex = 0;
  let fillerIndex = 0;
  for (let slot = 0; slot < total; slot++) {
    const fillerExpectedByNow = Math.round(((slot + 1) * filler.length) / total);
    if (fillerIndex < fillerExpectedByNow) result.push(filler[fillerIndex++]);
    else result.push(real[realIndex++]);
  }
  return result;
}

/** Pads `songs` (assumed already sorted oldest-first) up to SONGS_PER_DAY
 * with placeholder filler entries, spread evenly rather than clumped at the
 * end — the same fixed lineup size shown on /wakeup and actually played
 * from /admin/wakeup (which arranges its own, already-chosen filler tracks
 * with arrangeLineup directly). */
export function withFiller<T>(songs: T[]): (T | ReturnType<typeof makeFillerSong>)[] {
  const real = songs.slice(0, SONGS_PER_DAY);
  const fillerCount = SONGS_PER_DAY - real.length;
  const filler = Array.from({ length: fillerCount }, (_, i) => makeFillerSong(i));
  return arrangeLineup(real, filler);
}

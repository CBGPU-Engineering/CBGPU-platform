'use client';

import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatContestDate, remainingTime } from '@/lib/contests';

/** Anchor to server time and a monotonic clock so changing the device clock cannot change the countdown. */
export function useContestClock() {
  const [now, setNow] = useState<number | null>(null);
  const [syncError, setSyncError] = useState(false);
  useEffect(() => {
    let disposed = false;
    let anchor: { server: number; monotonic: number } | null = null;
    let syncing = false;
    const sync = async () => {
      if (syncing) return;
      syncing = true;
      const started = performance.now();
      try {
        const { data, error } = await supabase.rpc('contest_server_time');
        const received = performance.now();
        if (disposed) return;
        const server = new Date(data).getTime();
        if (error || typeof data !== 'string' || !Number.isFinite(server)) throw error || new Error('Invalid server time');
        anchor = { server: server + (received - started) / 2, monotonic: received };
        setNow(anchor.server);
        setSyncError(false);
      } catch {
        if (!disposed) setSyncError(true);
      } finally { syncing = false; }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void sync(); };
    void sync();
    const refresh = setInterval(() => void sync(), 30000);
    const tick = setInterval(() => { if (anchor) setNow(anchor.server + performance.now() - anchor.monotonic); }, 250);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      disposed = true;
      clearInterval(refresh);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, []);
  return { now, syncError };
}

export default function ContestClock({ endsAt, isOpen, now, syncError }: {
  endsAt: string | null; isOpen: boolean; now: number | null; syncError: boolean;
}) {
  const closed = !isOpen || (!!endsAt && now !== null && new Date(endsAt).getTime() <= now);
  return (
    <div className={`rounded-2xl border p-4 ${closed ? 'border-border bg-muted/40' : 'border-primary/20 bg-primary/5'}`}>
      <p className="flex items-center gap-2 text-sm font-bold"><Clock3 className="size-4" />{!isOpen ? '호스트가 접수를 중지했어요' : !endsAt ? '상시 접수 중' : now === null ? '서버 시각 확인 중…' : remainingTime(endsAt, now)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{formatContestDate(endsAt)}</p>
      <p className="mt-2 text-xs text-muted-foreground">{syncError ? '서버 시각 재확인 중이에요. 연결되면 자동으로 동기화해요.' : '서버 시각 기준 · 30초마다 동기화'}</p>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Clock3, ShieldCheck } from 'lucide-react';
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
  const seconds = endsAt && now !== null ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000)) : 0;
  const units = [{ label: '일', value: Math.floor(seconds / 86400) }, { label: '시간', value: Math.floor(seconds / 3600) % 24 }, { label: '분', value: Math.floor(seconds / 60) % 60 }, { label: '초', value: seconds % 60 }];
  return (
    <div className="contest-countdown" data-closed={closed}>
      <p className="flex items-center gap-2 text-xs font-semibold"><Clock3 className="size-4" />{!isOpen ? '호스트가 접수를 중지했어요' : closed ? '마감되었어요' : !endsAt ? '상시 접수 중' : now === null ? '서버 시각 확인 중…' : '제출 마감까지 남은 시간'}</p>
      {isOpen && endsAt && now !== null && !closed && <div role="timer" aria-live="off" className="mt-5"><span className="sr-only">{remainingTime(endsAt, now)}</span><div aria-hidden="true" className="flex gap-2">{units.map(unit => <div key={unit.label} className="contest-time-unit"><strong>{String(unit.value).padStart(2, '0')}</strong><span>{unit.label}</span></div>)}</div></div>}
      <div className="mt-5 border-t border-current/10 pt-4"><p className="text-xs font-semibold">제출 마감</p><p className="mt-1 text-xs leading-relaxed opacity-70">{formatContestDate(endsAt)}</p></div>
      <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed opacity-65"><ShieldCheck className="mt-0.5 size-3 shrink-0" />{syncError ? '서버 시각 재확인 중이에요. 연결되면 자동으로 동기화해요.' : '서버 시각 기준 · 30초마다 동기화'}</p>
    </div>
  );
}

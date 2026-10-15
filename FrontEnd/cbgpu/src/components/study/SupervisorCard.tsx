'use client';

import { useEffect, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Duty = { type: string; teacher: string };
type Supervisors = { date: string | null; duties: Duty[] | null };

const todayKst = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());

/**
 * 오늘의 자습 감독. 서버가 스케줄에 맞춰 외부 스크립트에서 가져와 Supabase에 저장해 두므로, 여기서는 그
 * 저장된 값을 읽기만 한다 (모든 사용자가 같은 값을 보고, 접속은 외부 호출에 영향을 주지 않는다).
 * 오늘 값이 아직 없거나 읽기에 실패하면 카드를 그리지 않는다 — 자습 현황을 보는 데 꼭 필요한 정보가 아니라서
 * 에러 문구로 화면을 어지럽히지 않는다.
 */
export default function SupervisorCard() {
  const [data, setData] = useState<Supervisors | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from('study_supervisors').select('duty_date, date_label, duties').eq('id', 1).maybeSingle()
      .then(({ data: row }) => {
        // 어제 값은 오늘의 감독이 아니므로 보여주지 않는다.
        if (!cancelled && row && row.duty_date === todayKst()) setData({ date: row.date_label || null, duties: row.duties ?? [] });
      }, () => {});
    return () => { cancelled = true; };
  }, []);

  if (!data?.duties) return null;

  return (
    <section aria-label="오늘의 자습 감독" className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserCheck className="size-5" aria-hidden /></div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">오늘의 자습 감독{data.date ? ` · ${data.date}` : ''}</p>
        {data.duties.length ? (
          <ul className="mt-1.5 space-y-1">
            {data.duties.map((duty, index) => (
              <li key={`${duty.type}-${index}`} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                {duty.type && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">{duty.type}</span>}
                <span className="font-black">{duty.teacher} 선생님</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm font-bold text-muted-foreground">오늘은 자습 감독이 없어요.</p>
        )}
      </div>
    </section>
  );
}

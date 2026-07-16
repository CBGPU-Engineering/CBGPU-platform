'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { Badge } from '@/components/ui/badge';
import { startOfWeek, endOfWeek, addWeeks, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarDays, Lock, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WeeklyGPUCard({ id, name }: { id: number; name: string }) {
  const { showError, showSuccess } = useAlert();
  const { isApproved } = useAuth();
  const [selectedWeeks, setSelectedWeeks] = useState<Date[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvedReservations, setApprovedReservations] = useState<any[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    fetchApprovedReservations();
  }, [id]);

  const fetchApprovedReservations = async () => {
    const { data } = await supabase
      .from('reservations')
      .select('start_time, end_time, user_email')
      .eq('gpu_id', id)
      .eq('status', 'approved')
      .gte('end_time', new Date().toISOString())
      .order('start_time', { ascending: true });
    if (data) setApprovedReservations(data);
  };

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const mon = startOfWeek(addWeeks(new Date(), i), { weekStartsOn: 1 });
    const sun = endOfWeek(addWeeks(new Date(), i), { weekStartsOn: 1 });
    return { mon, sun };
  });

  /** 그 주에 걸친 승인된 예약이 있으면(조기 종료로 일부만 썼어도) 실제 남은 기간만 계산한다.
   * 겹치는 예약들의 종료 시각 중 가장 늦은 것 이후부터를 신청 가능 구간으로 본다 — 조기
   * 종료로 비게 된 뒷부분을 다른 사람이 신청할 수 있게 하기 위함. */
  const getWeekAvailability = (mon: Date, sun: Date) => {
    const overlapping = approvedReservations.filter(res => {
      const s = parseISO(res.start_time);
      const e = parseISO(res.end_time);
      return s < sun && e > mon;
    });
    if (overlapping.length === 0) return { taken: false, availableFrom: mon };

    const latestEnd = overlapping.reduce((max, res) => {
      const e = parseISO(res.end_time);
      return e > max ? e : max;
    }, mon);

    const availableFrom = latestEnd > mon ? latestEnd : mon;
    return { taken: availableFrom >= sun, availableFrom };
  };

  const isWeekTaken = (mon: Date, sun: Date) => getWeekAvailability(mon, sun).taken;

  const toggleWeek = (mon: Date) => {
    setSelectedWeeks(prev => {
      const exists = prev.some(d => d.getTime() === mon.getTime());
      return exists ? prev.filter(d => d.getTime() !== mon.getTime()) : [...prev, mon];
    });
  };

  const handleSubmit = async () => {
    if (!isApproved) {
      showError('학번 또는 이름 확인이 필요해 예약할 수 없습니다. 프로필에서 정보를 확인해 주세요.'); return;
    }
    if (selectedWeeks.length === 0) { showError('주차를 선택해 주세요.'); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showError('로그인이 필요합니다.'); return; }

    setIsSubmitting(true);
    try {
      const { data: existing, error: checkError } = await supabase
        .from('reservations')
        .select('id, start_time, end_time')
        .eq('gpu_id', id)
        .eq('status', 'approved')
        .gte('end_time', new Date().toISOString());

      if (checkError) throw checkError;

      // 선택된 주를 날짜 순으로 정렬
      const sorted = [...selectedWeeks].sort((a, b) => a.getTime() - b.getTime());

      // 연속된 주끼리 하나의 그룹으로 병합
      const groups: { start: Date; end: Date }[] = [];
      let groupStart = startOfWeek(sorted[0], { weekStartsOn: 1 });
      groupStart.setHours(0, 0, 0, 0);
      let groupEnd = endOfWeek(sorted[0], { weekStartsOn: 1 });
      groupEnd.setHours(23, 59, 59, 999);

      for (let i = 1; i < sorted.length; i++) {
        const prevMon = startOfWeek(sorted[i - 1], { weekStartsOn: 1 });
        const curMon = startOfWeek(sorted[i], { weekStartsOn: 1 });
        const daysDiff = Math.round((curMon.getTime() - prevMon.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff === 7) {
          // 연속 — 현재 그룹 끝을 연장
          groupEnd = endOfWeek(sorted[i], { weekStartsOn: 1 });
          groupEnd.setHours(23, 59, 59, 999);
        } else {
          // 비연속 — 현재 그룹 저장 후 새 그룹 시작
          groups.push({ start: new Date(groupStart), end: new Date(groupEnd) });
          groupStart = startOfWeek(sorted[i], { weekStartsOn: 1 });
          groupStart.setHours(0, 0, 0, 0);
          groupEnd = endOfWeek(sorted[i], { weekStartsOn: 1 });
          groupEnd.setHours(23, 59, 59, 999);
        }
      }
      groups.push({ start: new Date(groupStart), end: new Date(groupEnd) });

      // 충돌 체크 및 레코드 생성
      const records = [];
      for (const { start, end } of groups) {
        // 이 구간 맨 앞에 이미 승인된 예약이 걸쳐 있으면(조기 종료로 일부만 쓰고 끝난 경우 등)
        // 전체 기간을 막지 않고, 그 예약이 끝난 시점 이후 남은 기간만 신청 구간으로 좁힌다.
        let adjustedStart = start;
        const overlappingAtStart = existing?.filter(res => {
          const s = new Date(res.start_time);
          const e = new Date(res.end_time);
          return s <= adjustedStart && e > adjustedStart;
        });
        if (overlappingAtStart && overlappingAtStart.length > 0) {
          const latestEnd = overlappingAtStart.reduce((max, r) => {
            const e = new Date(r.end_time);
            return e > max ? e : max;
          }, adjustedStart);
          if (latestEnd > adjustedStart) adjustedStart = latestEnd;
        }

        if (adjustedStart >= end) {
          setIsSubmitting(false);
          showError(`${format(start, 'M월 d일', { locale: ko })} 주는 남은 기간이 없습니다.`); return;
        }

        const hasConflict = existing?.some(res => {
          const s = new Date(res.start_time);
          const e = new Date(res.end_time);
          return adjustedStart < e && end > s;
        });

        if (hasConflict) {
          setIsSubmitting(false);
          showError(`${format(start, 'M월 d일', { locale: ko })} 주에는 이미 확정된 예약이 있습니다.`); return;
        }

        records.push({
          gpu_id: id,
          user_id: user.id,
          user_email: user.email,
          start_time: adjustedStart.toISOString(),
          end_time: end.toISOString(),
          status: 'pending',
        });
      }

      const { error } = await supabase.from('reservations').insert(records);
      if (error) throw error;
      const totalWeeks = selectedWeeks.length;
      showSuccess(`GPU #${id} ${totalWeeks}주(${records.length}건) 예약 신청이 완료되었습니다!`);
      setSelectedWeeks([]);
      fetchApprovedReservations();
    } catch (err: any) {
      showError('예약 실패: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="tilt-3d overflow-hidden border-border bg-card hover:border-primary group shadow-lg flex flex-col h-full rounded-[28px]">
      <CardHeader className="p-0 overflow-hidden relative">
        <div className="relative w-full h-32">
          <Image
            src="/img/rtx5000.jpg"
            alt="GPU"
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div className="absolute top-2 right-2">
          <Button
            variant="secondary"
            size="xs"
            className="text-[10px] font-black h-6 bg-background/80 backdrop-blur-sm shadow-sm"
            onClick={() => setShowSchedule(!showSchedule)}
          >
            {showSchedule ? 'CLOSE SCHEDULE' : 'VIEW CALENDAR'}
          </Button>
        </div>
        <div className="absolute top-2 left-2">
          <span className="text-[9px] font-black px-2 py-0.5 rounded bg-violet-500/80 text-white backdrop-blur-sm">
            WEEKLY
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4 flex-grow">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold italic tracking-tighter">GPU #{id}</h3>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">RTX5000</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="success">Ready</Badge>
            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-violet-500/10 text-violet-600 border border-violet-500/20">주 단위 예약</span>
          </div>
        </div>

        {showSchedule ? (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1">
              <CalendarDays className="size-3" /> 확정된 예약
            </p>
            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {approvedReservations.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/50 italic pl-1">No approved reservations</p>
              ) : (
                approvedReservations.map((res, i) => (
                  <div key={i} className="text-[10px] p-2.5 bg-muted/30 rounded-xl border border-border/30">
                    <div className="flex justify-between font-black">
                      <span>
                        {format(parseISO(res.start_time), 'M/d (eee)', { locale: ko })}
                        <span className="mx-1 opacity-40">–</span>
                        {format(parseISO(res.end_time), 'M/d (eee)', { locale: ko })}
                      </span>
                      <span className="text-emerald-600">Approved</span>
                    </div>
                    <p className="text-muted-foreground truncate mt-0.5">{res.user_email}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2 animate-in fade-in duration-300">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">예약할 주차 선택</p>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {weeks.map(({ mon, sun }, i) => {
                const { taken, availableFrom } = getWeekAvailability(mon, sun);
                const partial = !taken && availableFrom.getTime() > mon.getTime();
                const isSelected = selectedWeeks.some(d => d.getTime() === mon.getTime());

                return (
                  <button
                    key={i}
                    disabled={taken}
                    onClick={() => !taken && toggleWeek(mon)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all duration-200',
                      taken
                        ? 'opacity-40 cursor-not-allowed bg-muted/20 border-border/30'
                        : isSelected
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border/50 hover:border-primary/50 hover:bg-muted/30 active:scale-[0.98]'
                    )}
                  >
                    <div>
                      <p className="text-[11px] font-black">
                        {format(mon, 'M월 d일', { locale: ko })}
                        <span className="mx-1 opacity-40">–</span>
                        {format(sun, 'M월 d일 (eee)', { locale: ko })}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {i === 0 ? '이번 주' : `${i}주 후`}
                      </p>
                      {partial && (
                        <p className="text-[9px] text-amber-600 font-bold mt-0.5">
                          {format(availableFrom, 'M/d HH:mm', { locale: ko })}부터 신청 가능(조기 종료로 일부 남음)
                        </p>
                      )}
                    </div>
                    {taken ? (
                      <Lock className="size-3.5 text-muted-foreground shrink-0" />
                    ) : isSelected ? (
                      <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                    ) : (
                      <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || selectedWeeks.length === 0 || showSchedule}
          className="w-full font-bold py-5 transition-all active:scale-95 text-xs"
        >
          {isSubmitting
            ? '신청 중...'
            : selectedWeeks.length > 0
            ? `${selectedWeeks.length}주 예약 신청하기`
            : '주차를 선택하세요'}
        </Button>
      </CardFooter>
    </Card>
  );
}

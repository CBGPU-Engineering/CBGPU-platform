'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { startOfWeek, endOfWeek, addWeeks, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarDays, Lock, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WeeklyGPUCard({ id, name }: { id: number; name: string }) {
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);
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

  const isWeekTaken = (mon: Date, sun: Date) =>
    approvedReservations.some(res => {
      const s = parseISO(res.start_time);
      const e = parseISO(res.end_time);
      return s < sun && e > mon;
    });

  const handleSubmit = async () => {
    if (!selectedWeekStart) return toast.error('주차를 선택해 주세요.');

    const mon = startOfWeek(selectedWeekStart, { weekStartsOn: 1 });
    mon.setHours(0, 0, 0, 0);
    const sun = endOfWeek(selectedWeekStart, { weekStartsOn: 1 });
    sun.setHours(23, 59, 59, 999);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error('로그인이 필요합니다.');

    setIsSubmitting(true);
    try {
      const { data: existing, error: checkError } = await supabase
        .from('reservations')
        .select('id, start_time, end_time')
        .eq('gpu_id', id)
        .eq('status', 'approved');

      if (checkError) throw checkError;

      const hasConflict = existing?.some(res => {
        const s = new Date(res.start_time);
        const e = new Date(res.end_time);
        return mon < e && sun > s;
      });

      if (hasConflict) {
        setIsSubmitting(false);
        return toast.error('해당 주에는 이미 확정된 예약이 있습니다.');
      }

      const { error } = await supabase.from('reservations').insert({
        gpu_id: id,
        user_id: user.id,
        user_email: user.email,
        start_time: mon.toISOString(),
        end_time: sun.toISOString(),
        status: 'pending',
      });

      if (error) throw error;
      toast.success(`GPU #${id} 주간 예약 신청이 완료되었습니다!`);
      setSelectedWeekStart(null);
      fetchApprovedReservations();
    } catch (err: any) {
      toast.error('예약 실패: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="overflow-hidden border-border bg-card hover:border-primary transition-all group shadow-lg flex flex-col h-full">
      <CardHeader className="p-0 overflow-hidden relative">
        <img
          src="/img/rtx5000.jpg"
          alt="GPU"
          className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
        />
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
            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">READY</span>
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
                const taken = isWeekTaken(mon, sun);
                const isSelected =
                  selectedWeekStart !== null &&
                  startOfWeek(selectedWeekStart, { weekStartsOn: 1 }).getTime() === mon.getTime();

                return (
                  <button
                    key={i}
                    disabled={taken}
                    onClick={() => setSelectedWeekStart(taken ? null : mon)}
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
          disabled={isSubmitting || !selectedWeekStart || showSchedule}
          className="w-full font-bold py-5 transition-all active:scale-95 text-xs"
        >
          {isSubmitting
            ? '신청 중...'
            : selectedWeekStart
            ? `${format(selectedWeekStart, 'M월 d일', { locale: ko })} 주 예약 신청`
            : '주차를 선택하세요'}
        </Button>
      </CardFooter>
    </Card>
  );
}

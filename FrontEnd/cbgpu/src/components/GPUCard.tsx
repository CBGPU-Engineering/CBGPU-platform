'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format, isSameDay, parseISO, addDays, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function GPUCard({ id, name }: { id: number; name: string }) {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [approvedReservations, setApprovedReservations] = useState<any[]>([]);

  useEffect(() => {
    fetchApprovedReservations();
  }, [id]);

  const fetchApprovedReservations = async () => {
    const now = new Date();
    const { data, error } = await supabase
      .from('reservations')
      .select('start_time, end_time, user_email')
      .eq('gpu_id', id)
      .eq('status', 'approved')
      .gte('end_time', now.toISOString())
      .order('start_time', { ascending: true });

    if (!error) {
      setApprovedReservations(data || []);
    }
  };

  const handleRequest = async () => {
    if (showSchedule && (!startTime || !endTime)) {
      setShowSchedule(false);
      return toast.info('예약 시간을 선택해 주세요.');
    }

    if (!startTime || !endTime) {
      return toast.error('시작 시간과 종료 시간을 모두 선택해 주세요.');
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      return toast.error('종료 시간은 시작 시간보다 늦어야 합니다.');
    }

    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) {
      return toast.error('GPU #1은 최대 7일까지만 예약 가능합니다. 장기 사용은 GPU #2~4의 주 단위 예약을 이용해 주세요.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error('로그인이 필요합니다.');

    setIsSubmitting(true);

    try {
      const { data: existingReservations, error: checkError } = await supabase
        .from('reservations')
        .select('id, start_time, end_time')
        .eq('gpu_id', id)
        .eq('status', 'approved')
        .gte('end_time', new Date().toISOString());

      if (checkError) throw checkError;

      const hasConflict = existingReservations?.some((res) => {
        const resStart = new Date(res.start_time);
        const resEnd = new Date(res.end_time);
        return (start < resEnd && end > resStart);
      });

      if (hasConflict) {
        setIsSubmitting(false);
        return toast.error('해당 시간에는 이미 확정된 예약이 있습니다.');
      }

      const { error } = await supabase
        .from('reservations')
        .insert({ 
            gpu_id: id, 
            user_id: user.id, 
            user_email: user.email,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            status: 'pending' 
        });

      if (error) throw error;

      toast.success(`GPU #${id} 예약 신청이 완료되었습니다!`);
      setStartTime('');
      setEndTime('');
      fetchApprovedReservations();
    } catch (error: any) {
      console.error('Reservation Error:', error);
      toast.error('예약 실패: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const next7Days = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));
  
  const getReservationsForDay = (day: Date) => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    
    return approvedReservations.filter(res => {
      const resStart = parseISO(res.start_time);
      const resEnd = parseISO(res.end_time);
      return resStart <= dayEnd && resEnd >= dayStart;
    });
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
                {showSchedule ? "CLOSE SCHEDULE" : "VIEW CALENDAR"}
            </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 space-y-4 flex-grow">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold italic tracking-tighter">GPU #{id}</h3>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">RTX5000</p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">READY</span>
          </div>
        </div>

        {showSchedule ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="max-h-60 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              {next7Days.map((day, idx) => {
                const dayReservations = getReservationsForDay(day);
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {format(day, 'MMM d (eee)', { locale: ko })}
                      </span>
                      <div className="h-[1px] flex-grow bg-border/50"></div>
                    </div>
                    {dayReservations.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground/50 italic pl-2">No reservations</p>
                    ) : (
                      dayReservations.map((res, i) => {
                        const s = parseISO(res.start_time);
                        const e = parseISO(res.end_time);
                        const isStart = isSameDay(s, day);
                        const isEnd = isSameDay(e, day);
                        
                        return (
                          <div key={i} className="text-[10px] p-2 bg-muted/30 rounded-lg border border-border/30 hover:bg-muted/50 transition-colors">
                            <div className="flex justify-between font-bold text-foreground">
                              <span>
                                {isStart ? format(s, 'HH:mm') : '00:00'} - {isEnd ? format(e, 'HH:mm') : '23:59'}
                              </span>
                              {!isStart && !isEnd && <span className="text-[8px] bg-primary/20 text-primary px-1 rounded">ALL DAY</span>}
                              <span className="text-[9px] text-muted-foreground uppercase opacity-70">Approved</span>
                            </div>
                            <p className="text-muted-foreground truncate mt-0.5">{res.user_email}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">사용 시작</label>
              <Input 
                type="datetime-local" 
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-background cursor-pointer h-9 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">사용 종료 <span className="text-primary/60 normal-case">(최대 7일)</span></label>
              <Input
                type="datetime-local"
                value={endTime}
                min={startTime || undefined}
                max={startTime ? new Date(new Date(startTime).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16) : undefined}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-background cursor-pointer h-9 text-xs"
              />
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button 
          onClick={handleRequest} 
          disabled={isSubmitting}
          className="w-full font-bold py-5 transition-all active:scale-95 text-xs"
        >
          {isSubmitting ? '신청 중...' : '예약 신청하기'}
        </Button>
      </CardFooter>
    </Card>
  );
}
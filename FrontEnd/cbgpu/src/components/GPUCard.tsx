'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { Badge } from '@/components/ui/badge';
import { format, isSameDay, parseISO, addDays, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';

const DURATION_PRESETS = [
  { label: '1시간', hours: 1 },
  { label: '3시간', hours: 3 },
  { label: '6시간', hours: 6 },
  { label: '12시간', hours: 12 },
  { label: '1일', hours: 24 },
  { label: '2일', hours: 48 },
  { label: '3일', hours: 72 },
  { label: '7일', hours: 168 },
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const NEXT_14_DAYS = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i));

function combineDateHour(day: Date, hour: number): Date {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export default function GPUCard({ id, name }: { id: number; name: string }) {
  const { showAlert, showError, showSuccess } = useAlert();
  const { isApproved } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [selectedHour, setSelectedHour] = useState(() => Math.min(23, new Date().getHours() + 1));
  const [durationHours, setDurationHours] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [approvedReservations, setApprovedReservations] = useState<any[]>([]);

  const start = combineDateHour(selectedDate, selectedHour);
  const end = new Date(start.getTime() + durationHours * 3600000);

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
    if (!isApproved) {
      showError('학번 또는 이름 확인이 필요해 예약할 수 없습니다. 프로필에서 정보를 확인해 주세요.'); return;
    }

    if (showSchedule) {
      setShowSchedule(false);
      showAlert('예약 시간을 확인해 주세요.', 'info'); return;
    }

    if (start <= new Date()) {
      showError('시작 시간은 현재 시간보다 늦어야 합니다.'); return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showError('로그인이 필요합니다.'); return; }

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
        showError('해당 시간에는 이미 확정된 예약이 있습니다.'); return;
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

      showSuccess(`GPU #${id} 예약 신청이 완료되었습니다!`);
      setDurationHours(3);
      fetchApprovedReservations();
    } catch (error: any) {
      console.error('Reservation Error:', error);
      showError('예약 실패: ' + error.message);
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
            <Badge variant="success">Ready</Badge>
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
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">사용 시작일</label>
              <div className="flex gap-1.5 overflow-x-auto py-1.5 -mx-1 px-1">
                {NEXT_14_DAYS.map((day, i) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const dayHasReservation = approvedReservations.some((res) => {
                    const s = parseISO(res.start_time);
                    const e = parseISO(res.end_time);
                    return s <= endOfDay(day) && e >= startOfDay(day);
                  });
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={`flex flex-col items-center gap-0.5 shrink-0 px-2.5 py-1.5 rounded-xl border text-center transition-all active:scale-95 ${
                        isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border/50 hover:bg-muted/30'
                      }`}
                    >
                      <span className="text-[9px] font-bold opacity-70">{i === 0 ? '오늘' : i === 1 ? '내일' : format(day, 'eee', { locale: ko })}</span>
                      <span className="text-xs font-black">{format(day, 'M/d')}</span>
                      <span className={`size-1 rounded-full ${dayHasReservation ? (isSelected ? 'bg-primary-foreground' : 'bg-primary') : 'bg-transparent'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">시작 시각</label>
              <div className="flex gap-1.5 overflow-x-auto py-1.5 -mx-1 px-1">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSelectedHour(h)}
                    className={`shrink-0 px-3 py-1.5 rounded-xl border text-xs font-black transition-all active:scale-95 ${
                      selectedHour === h ? 'border-primary bg-primary text-primary-foreground' : 'border-border/50 hover:bg-muted/30'
                    }`}
                  >
                    {String(h).padStart(2, '0')}:00
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">사용 시간 <span className="text-primary/60 normal-case">(최대 7일)</span></label>
              <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.hours}
                    type="button"
                    onClick={() => setDurationHours(p.hours)}
                    className={`px-2 py-1.5 rounded-xl border text-[11px] font-black transition-all active:scale-95 ${
                      durationHours === p.hours ? 'border-primary bg-primary text-primary-foreground' : 'border-border/50 hover:bg-muted/30'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-muted-foreground bg-muted/30 rounded-xl py-2 px-3">
              <span>{format(start, 'M/d(eee) HH:mm', { locale: ko })}</span>
              <span className="opacity-40">→</span>
              <span>{format(end, 'M/d(eee) HH:mm', { locale: ko })}</span>
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
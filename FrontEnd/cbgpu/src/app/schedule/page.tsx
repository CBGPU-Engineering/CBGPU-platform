'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isToday,
  format, parseISO,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

const GPU_COLORS: Record<number, { bg: string; text: string; border: string; dot: string }> = {
  1: { bg: 'bg-blue-500/15',    text: 'text-blue-600',    border: 'border-blue-500/30',    dot: 'bg-blue-500' },
  2: { bg: 'bg-violet-500/15',  text: 'text-violet-600',  border: 'border-violet-500/30',  dot: 'bg-violet-500' },
  3: { bg: 'bg-emerald-500/15', text: 'text-emerald-600', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  4: { bg: 'bg-orange-500/15',  text: 'text-orange-600',  border: 'border-orange-500/30',  dot: 'bg-orange-500' },
};

export default function SchedulePage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [reservations, setReservations] = useState<any[]>([]);
  const [selected, setSelected] = useState<Date | null>(null);

  useEffect(() => {
    const fetchReservations = async () => {
      const { data } = await supabase
        .from('reservations')
        .select('id, gpu_id, start_time, end_time, status, profiles:user_id(full_name, student_id)')
        .eq('status', 'approved')
        .order('start_time', { ascending: true });
      if (data) setReservations(data);
    };
    fetchReservations();
  }, []);

  // Build calendar grid (Mon–Sun)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const getReservationsForDay = (day: Date) => {
    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
    return reservations.filter(res => {
      const s = parseISO(res.start_time);
      const e = parseISO(res.end_time);
      return s <= dayEnd && e >= dayStart;
    });
  };

  const selectedDayReservations = selected ? getReservationsForDay(selected) : [];

  const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter italic uppercase flex items-center gap-3">
            <CalendarDays className="size-8" /> Schedule
          </h1>
          <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest opacity-60">
            GPU 예약 현황 캘린더
          </p>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4].map(id => (
            <div key={id} className={cn('flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full border', GPU_COLORS[id].bg, GPU_COLORS[id].text, GPU_COLORS[id].border)}>
              <span className={cn('size-2 rounded-full', GPU_COLORS[id].dot)} />
              GPU #{id}
            </div>
          ))}
        </div>
      </div>

      {/* Calendar + Detail */}
      <div className="flex gap-4 items-start">
      <div className="flex-1 min-w-0 border-2 rounded-3xl overflow-hidden bg-card shadow-xl">
        {/* Month Nav */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="text-lg font-black uppercase tracking-tighter">
            {format(currentMonth, 'yyyy년 M월', { locale: ko })}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b">
          {WEEKDAYS.map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const dayRes = getReservationsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selected?.toDateString() === day.toDateString();
            const isTodayDate = isToday(day);

            return (
              <button
                key={i}
                onClick={() => setSelected(isSelected ? null : day)}
                className={cn(
                  'min-h-[80px] p-2 text-left border-b border-r transition-all',
                  !isCurrentMonth && 'opacity-25',
                  isSelected && 'bg-primary/5 ring-2 ring-inset ring-primary/30',
                  !isSelected && 'hover:bg-muted/30',
                  (i + 1) % 7 === 0 && 'border-r-0',
                )}
              >
                <span className={cn(
                  'text-xs font-black inline-flex items-center justify-center w-6 h-6 rounded-full mb-1',
                  isTodayDate && 'bg-primary text-primary-foreground',
                  !isTodayDate && isCurrentMonth && 'text-foreground',
                )}>
                  {format(day, 'd')}
                </span>
                <div className="flex flex-wrap gap-0.5">
                  {dayRes.map((res, j) => {
                    const c = GPU_COLORS[res.gpu_id];
                    return (
                      <span key={j} className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-md border', c.bg, c.text, c.border)}>
                        #{res.gpu_id}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      </div>{/* end calendar */}

        {/* Detail panel */}
        <div className={cn(
          'w-64 shrink-0 border-2 rounded-3xl bg-card shadow-xl transition-all duration-300 overflow-hidden',
          selected ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}>
          {selected && (
            <>
              <div className="px-5 py-4 border-b-2">
                <p className="font-black uppercase tracking-tighter text-sm">
                  {format(selected, 'M월 d일 (eee)', { locale: ko })}
                </p>
                <p className="text-[10px] text-muted-foreground font-bold opacity-60 uppercase tracking-widest">예약 현황</p>
              </div>
              <div className="p-4 space-y-3">
                {selectedDayReservations.length === 0 ? (
                  <p className="text-muted-foreground font-bold text-xs opacity-50 py-4 text-center">예약 없음</p>
                ) : (
                  selectedDayReservations.map((res) => {
                    const c = GPU_COLORS[res.gpu_id];
                    return (
                      <div key={res.id} className={cn('p-3 rounded-2xl border-2', c.bg, c.border)}>
                        <div className={cn('text-xs font-black mb-1.5', c.text)}>GPU #{res.gpu_id}</div>
                        <div className="text-[11px] font-bold space-y-0.5 text-foreground">
                          <p>{res.profiles?.full_name || '—'}</p>
                          <p className="opacity-60">{res.profiles?.student_id || '—'}</p>
                          <p className="opacity-40 text-[10px]">
                            {format(parseISO(res.start_time), 'M/d')} – {format(parseISO(res.end_time), 'M/d')}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

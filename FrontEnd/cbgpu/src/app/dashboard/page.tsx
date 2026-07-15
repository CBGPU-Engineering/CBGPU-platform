'use client';

import { useEffect, useState, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import GPUCard from '@/components/GPUCard';
import WeeklyGPUCard from '@/components/WeeklyGPUCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { RefreshCw, Trash2, Copy, Key, AlertTriangle, StopCircle, Bell, BellOff, Download, Wifi, WifiOff, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
  format, parseISO,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const GPU_COLORS: Record<number, { bg: string; text: string; border: string; dot: string }> = {
  1: { bg: 'bg-blue-500/15',    text: 'text-blue-600',    border: 'border-blue-500/30',    dot: 'bg-blue-500' },
  2: { bg: 'bg-violet-500/15',  text: 'text-violet-600',  border: 'border-violet-500/30',  dot: 'bg-violet-500' },
  3: { bg: 'bg-emerald-500/15', text: 'text-emerald-600', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  4: { bg: 'bg-orange-500/15',  text: 'text-orange-600',  border: 'border-orange-500/30',  dot: 'bg-orange-500' },
};
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

export default function Dashboard() {
  const { user } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [myReservations, setMyReservations] = useState<any[]>([]);
  const [gpuPasswords, setGpuPasswords] = useState<{[key: number]: string}>({});
  const [loading, setLoading] = useState(true);
  const [justFinished, setJustFinished] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedRes, setSelectedRes] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; status: string } | null>(null);
  const [endTarget, setEndTarget] = useState<string | null>(null);
  const [currentHost, setCurrentHost] = useState<string>('100.89.196.43');
  const [connectionMode, setConnectionMode] = useState<'internal' | 'public'>('internal');
  const [gpuStatus, setGpuStatus] = useState<Record<number, 'online'|'offline'|'checking'>>({1:'checking',2:'checking',3:'checking',4:'checking'});
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');
  const [statsData, setStatsData] = useState<{gpu_id: number; hours: number}[]>([]);

  // ── 캘린더 (구 /schedule 통합) ────────────────────────────────────────────
  const [selectedGpuId, setSelectedGpuId] = useState(1);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarReservations, setCalendarReservations] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [clientToday, setClientToday] = useState<Date | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarJustFinished, setCalendarJustFinished] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  useEffect(() => { setClientToday(new Date()); }, []);

  // 캘린더에 보이는 달(그리드 범위)만 가져온다 — 예약이 쌓일수록 전체를 매번
  // 긁어오면 느려지고, 어차피 화면엔 이 범위 밖 데이터는 쓰이지 않는다.
  useEffect(() => {
    const fetchCalendar = async () => {
      setCalendarLoading(true);
      const { data } = await supabase
        .from('reservations')
        .select('id, gpu_id, start_time, end_time, status, profiles:user_id(full_name, student_id)')
        .eq('status', 'approved')
        .lt('start_time', gridEnd.toISOString())
        .gt('end_time', gridStart.toISOString())
        .order('start_time', { ascending: true });
      if (data) setCalendarReservations(data);
      setCalendarLoading(false);
      setCalendarJustFinished(true);
      setTimeout(() => setCalendarJustFinished(false), 600);
    };
    fetchCalendar();
  }, [gridStart.getTime(), gridEnd.getTime()]);
  const calendarDays: Date[] = [];
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) calendarDays.push(cursor);

  const getReservationsForDay = (day: Date) => {
    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
    return calendarReservations.filter(res => {
      const s = parseISO(res.start_time);
      const e = parseISO(res.end_time);
      return s <= dayEnd && e >= dayStart;
    });
  };
  const selectedDayReservations = selectedDay ? getReservationsForDay(selectedDay) : [];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname);

      if (isIP) {
        setCurrentHost(hostname);
        setConnectionMode('internal');
      } else if (hostname.includes('trycloudflare.com')) {
        setConnectionMode('public');
      }
    }
  }, []);

  const effectiveHost = '10.138.24.219';

  const stableHost = 'cbshoj.tail0701ea.ts.net'; // 변경된 실제 Tailscale 도메인 주소

  const gpus = [
    {
      id: 1,
      name: "RTX5000",
      username: "gpu1",
      jupyterhubUrl: connectionMode === 'public' ? `https://bbb1f73aa6bd31.lhr.life` : `http://${effectiveHost}:8001`
    },
    {
      id: 2,
      name: "RTX5000",
      username: "gpu2",
      jupyterhubUrl: connectionMode === 'public' ? `https://109a33522c2e35.lhr.life` : `http://${effectiveHost}:8002`
    },
    {
      id: 3,
      name: "RTX5000",
      username: "gpu3",
      jupyterhubUrl: connectionMode === 'public' ? `https://ccb4e81a1e065b.lhr.life` : `http://${effectiveHost}:8003`
    },
    {
      id: 4,
      name: "RTX5000",
      username: "gpu4",
      jupyterhubUrl: connectionMode === 'public' ? `https://d145edf2d1b8f1.lhr.life` : `http://${effectiveHost}:8004`
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  /** 승인된 예약이 있는 GPU의 비밀번호만 가져온다 — get_active_gpu_password RPC가
   * 호출자의 승인된 예약을 서버(DB)에서 직접 확인한 뒤에만 비밀번호를 돌려준다.
   * (supabase_security_hardening_migration.sql 적용 후 gpus 테이블 직접 SELECT는
   * 관리자만 가능하도록 막혀 있어, 전체 GPU 비밀번호가 클라이언트로 내려가지 않는다.) */
  const fetchGpuPasswords = async () => {
    if (!user) { setGpuPasswords({}); return; }
    const { data: myApproved } = await supabase
      .from('reservations')
      .select('gpu_id')
      .eq('user_id', user.id)
      .eq('status', 'approved');

    const gpuIds = [...new Set((myApproved ?? []).map((r: any) => r.gpu_id))];
    if (gpuIds.length === 0) { setGpuPasswords({}); return; }

    const entries = await Promise.all(
      gpuIds.map(async (gpuId) => {
        const { data } = await supabase.rpc('get_active_gpu_password', { p_gpu_id: gpuId });
        return [gpuId, data as string | null] as const;
      })
    );
    const map: {[key: number]: string} = {};
    entries.forEach(([id, password]) => { if (password) map[id] = password; });
    setGpuPasswords(map);
  };

  const fetchMyReservations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) setMyReservations(data || []);
    setLoading(false);
    setJustFinished(true);
    setTimeout(() => setJustFinished(false), 600);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      const { error, count } = await supabase
        .from('reservations')
        .delete({ count: 'exact' })
        .eq('id', cancelTarget.id);

      if (error) throw error;
      if (!count || count === 0) throw new Error("삭제 권한이 없거나 이미 삭제된 예약입니다.");
      showSuccess("예약이 취소됐습니다.");
      setCancelTarget(null);
      fetchMyReservations();
    } catch (err: any) {
      showError("취소 실패: " + err.message);
    }
  };

  const handleEndSession = async () => {
    if (!endTarget) return;
    const { error } = await supabase
      .from('reservations')
      .update({ end_time: new Date().toISOString() })
      .eq('id', endTarget);
    if (error) {
      showError("세션 종료 실패: " + error.message);
    } else {
      showSuccess("세션이 종료됐습니다.");
      setEndTarget(null);
      setSelectedRes(null);
      fetchMyReservations();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess("클립보드에 복사됐습니다.");
  };

  // ── GPU 실시간 상태 ──────────────────────────────────────────────────────────
  const checkGpuStatus = async () => {
    setGpuStatus({1:'checking',2:'checking',3:'checking',4:'checking'});
    try {
      const res = await fetch('/api/gpu-status');
      const data = await res.json();
      const map: Record<number, 'online'|'offline'> = {};
      data.gpus.forEach((g: {id:number;status:'online'|'offline'}) => { map[g.id] = g.status; });
      setGpuStatus(map);
    } catch { setGpuStatus({1:'offline',2:'offline',3:'offline',4:'offline'}); }
  };

  // ── iCal 내보내기 ──────────────────────────────────────────────────────────
  const exportIcal = () => {
    if (!myReservations.length) { showError('예약이 없습니다.'); return; }
    const fmtDt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
    const events = myReservations.map(r => [
      'BEGIN:VEVENT',
      `DTSTART:${fmtDt(r.start_time)}`,
      `DTEND:${fmtDt(r.end_time)}`,
      `SUMMARY:GPU ${r.gpu_id} 예약 — CBGPU`,
      `UID:cbgpu-${r.id}@cbgpu.vercel.app`,
      'END:VEVENT',
    ].join('\r\n')).join('\r\n');
    const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CBGPU//KO','CALSCALE:GREGORIAN',
      'X-WR-CALNAME:CBGPU 예약','X-WR-TIMEZONE:Asia/Seoul', events,'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    a.download = 'cbgpu-reservations.ics';
    a.click();
    showSuccess('iCal 파일이 다운로드됩니다.');
  };

  // ── Push 알림 ──────────────────────────────────────────────────────────────
  const requestNotif = async () => {
    if (!('Notification' in window)) { showError('이 브라우저는 알림을 지원하지 않습니다.'); return; }
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === 'granted') showSuccess('알림이 활성화됐습니다. 예약 10분 전에 알림이 옵니다.');
    else showError('알림 권한이 거부됐습니다.');
  };

  // ── GPU 통계 ───────────────────────────────────────────────────────────────
  const fetchStats = async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data } = await supabase.from('reservations').select('gpu_id, start_time, end_time').gte('start_time', since);
    if (!data) return;
    const map: Record<number, number> = {1:0,2:0,3:0,4:0};
    data.forEach((r: any) => {
      const h = (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 3600000;
      if (r.gpu_id >= 1 && r.gpu_id <= 4) map[r.gpu_id] += h;
    });
    setStatsData([1,2,3,4].map(id => ({ gpu_id: id, hours: Math.round(map[id] * 10) / 10 })));
  };

  // push 알림 체크
  useEffect(() => {
    if (!('Notification' in window)) return;
    setNotifPerm(Notification.permission);
    const t = setInterval(() => {
      if (Notification.permission !== 'granted') return;
      myReservations.forEach((r: any) => {
        const start = new Date(r.start_time).getTime();
        const diff = start - Date.now();
        if (diff > 0 && diff < 10 * 60 * 1000) {
          new Notification(`GPU ${r.gpu_id} 예약 시작 10분 전`, {
            body: `${new Date(r.start_time).toLocaleTimeString('ko-KR')} 시작`,
            icon: '/favicon.ico',
          });
        }
      });
    }, 60000);
    return () => clearInterval(t);
  }, [myReservations]);

  useEffect(() => {
    if (user) {
      fetchMyReservations();
      fetchGpuPasswords();
      checkGpuStatus();
      fetchStats();
      const subscription = supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchMyReservations())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gpus' }, () => fetchGpuPasswords())
        .subscribe();
      return () => { supabase.removeChannel(subscription); };
    } else {
      checkGpuStatus();
    }
  }, [user]);

  return (
    <div className="space-y-12 md:space-y-20 transition-colors duration-500">
      <section>
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase">GPU</h1>
            <div className="h-1 w-20 bg-primary rounded-full"></div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[1,2,3,4].map(id => {
              const st = gpuStatus[id];
              return (
                <div key={id} className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-lg border border-border/40">
                  {st === 'checking'
                    ? <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                    : st === 'online'
                    ? <Wifi className="size-3 text-green-500" />
                    : <WifiOff className="size-3 text-destructive" />
                  }
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    GPU{id} {st === 'checking' ? '...' : st === 'online' ? 'ON' : 'OFF'}
                  </span>
                </div>
              );
            })}
            <Button variant="ghost" size="icon" className="size-7" onClick={checkGpuStatus} title="새로고침">
              <RefreshCw className="size-3" />
            </Button>
          </div>
        </div>

        {/* 전체 GPU 예약 현황 캘린더 — 구 /schedule, 누구나 볼 수 있게 항상 공개 */}
        {calendarLoading || calendarJustFinished ? (
          <div className="py-16 flex items-center justify-center">
            <LoadingSpinner done={calendarJustFinished} size={56} label="예약 현황 불러오는 중" />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-4 items-start">
            <div className="w-full md:flex-1 md:min-w-0 border-2 rounded-3xl overflow-hidden bg-card shadow-xl">
              <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b-2">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="size-4" />
                </Button>
                <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                  <CalendarDays className="size-4 opacity-50" />
                  {format(currentMonth, 'yyyy년 M월', { locale: ko })}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 px-4 md:px-6 py-2 border-b bg-muted/20">
                {[1, 2, 3, 4].map(id => (
                  <button
                    key={id}
                    onClick={() => setSelectedGpuId(id)}
                    className={cn('flex items-center gap-1.5 text-[10px] font-black px-2 py-0.5 rounded-full border transition-all',
                      GPU_COLORS[id].bg, GPU_COLORS[id].text, GPU_COLORS[id].border,
                      selectedGpuId === id && 'ring-2 ring-offset-1 ring-primary/40')}
                  >
                    <span className={cn('size-1.5 rounded-full', GPU_COLORS[id].dot)} />
                    GPU #{id}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-7 border-b">
                {WEEKDAYS.map(d => (
                  <div key={d} className="py-2 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((day, i) => {
                  const dayRes = getReservationsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDay?.toDateString() === day.toDateString();
                  const isTodayDate = clientToday ? isSameDay(day, clientToday) : false;

                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={cn(
                        'min-h-[56px] md:min-h-[80px] p-1 md:p-2 text-left border-b border-r transition-all',
                        !isCurrentMonth && 'opacity-25',
                        isSelected && 'bg-primary/5 ring-2 ring-inset ring-primary/30',
                        !isSelected && 'hover:bg-muted/30',
                        (i + 1) % 7 === 0 && 'border-r-0',
                      )}
                    >
                      <span className={cn(
                        'text-[10px] md:text-xs font-black inline-flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full mb-1',
                        isTodayDate && 'bg-primary text-primary-foreground',
                        !isTodayDate && isCurrentMonth && 'text-foreground',
                      )}>
                        {format(day, 'd')}
                      </span>
                      <div className="flex flex-wrap gap-0.5">
                        {dayRes.map((res, j) => {
                          const c = GPU_COLORS[res.gpu_id];
                          return (
                            <Fragment key={j}>
                              <span className={cn('md:hidden size-1.5 rounded-full mt-0.5', c.dot)} />
                              <span className={cn('hidden md:inline text-[9px] font-black px-1.5 py-0.5 rounded-md border', c.bg, c.text, c.border)}>
                                #{res.gpu_id}
                              </span>
                            </Fragment>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={cn(
              'w-full md:w-64 md:shrink-0 border-2 rounded-3xl bg-card shadow-xl transition-all duration-300 overflow-hidden',
              selectedDay ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}>
              {selectedDay && (
                <>
                  <div className="px-5 py-4 border-b-2">
                    <p className="font-black uppercase tracking-tighter text-sm">
                      {format(selectedDay, 'M월 d일 (eee)', { locale: ko })}
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
                          <div key={res.id} className="relative pl-4 pr-3 py-3 rounded-2xl border border-border/40 bg-card overflow-hidden tilt-3d transition-all">
                            <span className={cn('absolute inset-y-0 left-0 w-1', c.dot)} />
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
        )}
      </section>

      <hr className="border-border transition-colors duration-500" />

      {/* 예약하기 + My Reservations를 나란히 — 박스 그리드 대신 하나씩 집중해서 예약하고,
          넓은 화면의 가로 공간을 살려 예약 폼 옆에서 바로 내 예약 현황을 확인한다 */}
      <section className="lg:flex lg:gap-10 lg:items-start pb-20">
        <div className="lg:w-[420px] lg:shrink-0 space-y-6 mb-10 lg:mb-0">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase italic">예약하기</h2>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">GPU를 선택하고 예약을 신청하세요</p>
          </div>
          <SegmentedTabs
            items={[1,2,3,4].map(id => ({ value: String(id), label: `GPU #${id}` }))}
            value={String(selectedGpuId)}
            onChange={(v) => setSelectedGpuId(Number(v))}
          />
          <div>
            {selectedGpuId === 1
              ? <GPUCard key={1} id={1} name="RTX5000" />
              : <WeeklyGPUCard key={selectedGpuId} id={selectedGpuId} name="RTX5000" />}
          </div>
        </div>

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[30vh] text-center space-y-4">
          <h2 className="text-2xl font-black uppercase italic">Authentication Required</h2>
          <p className="text-muted-foreground">Please sign in to view your reservations.</p>
        </div>
      ) : (
      <div className="flex-1 min-w-0">
        <div className="flex justify-end mb-6">
          <SegmentedTabs
            items={[
              { value: 'internal', label: 'Internal (Local)' },
              { value: 'public', label: 'Public (Global)' },
            ]}
            value={connectionMode}
            onChange={(v) => setConnectionMode(v as 'internal' | 'public')}
            className="bg-muted p-1 rounded-lg shadow-inner border border-border/50"
          />
        </div>

        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div className="flex flex-col">
            <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase italic">My Reservations</h2>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Manage your active sessions</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={exportIcal} className="font-black text-[10px] uppercase gap-1.5 h-8">
              <Download className="size-3" /> iCal
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={notifPerm === 'granted' ? undefined : requestNotif}
              className={`font-black text-[10px] uppercase gap-1.5 h-8 ${notifPerm === 'granted' ? 'text-green-500 border-green-500/30' : ''}`}
            >
              {notifPerm === 'granted' ? <Bell className="size-3" /> : <BellOff className="size-3" />}
              {notifPerm === 'granted' ? '알림 ON' : '알림 설정'}
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchMyReservations} className="hover:bg-primary/10 font-bold uppercase text-[10px] gap-2 h-8">
              <RefreshCw className="size-3" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* GPU 점유율 통계 */}
        {statsData.length > 0 && (
          <div className="mb-8 p-4 bg-muted/20 border border-border/40 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">GPU 점유율 (최근 30일)</p>
              <Button variant="ghost" size="icon" className="size-6" onClick={fetchStats}><RefreshCw className="size-2.5" /></Button>
            </div>
            <div className="space-y-2">
              {statsData.map(s => {
                const max = Math.max(...statsData.map(d => d.hours), 1);
                const pct = max > 0 ? (s.hours / max) * 100 : 0;
                return (
                  <div key={s.gpu_id} className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-muted-foreground w-10 shrink-0">GPU {s.gpu_id}</span>
                    <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-muted-foreground w-12 text-right shrink-0">{s.hours}h</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading || justFinished ? (
          <div className="py-16 flex items-center justify-center">
            <LoadingSpinner done={justFinished} size={56} label="예약 내역 불러오는 중" />
          </div>
        ) : myReservations.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-3xl text-muted-foreground transition-colors duration-500 font-medium bg-muted/10 pop-in-3d">
            <p style={{ fontFamily: 'Tossface', fontSize: 64, lineHeight: 1 }} className="mb-3">💻</p>
            No active reservations found.
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6">
            {myReservations.map((res) => {
              const start = new Date(res.start_time);
              const end = new Date(res.end_time);
              const isStarted = currentTime >= start;
              const isEnded = currentTime > end;
              const isApproved = res.status === 'approved';
              const isRejected = res.status === 'rejected';
              const isPending = res.status === 'pending';
              const canStart = isApproved && isStarted && !isEnded;

              const gpuInfo = gpus.find(g => g.id === res.gpu_id);
              const password = gpuPasswords[res.gpu_id];

              return (
                <div key={res.id} className="group flex flex-col p-5 md:p-6 border rounded-2xl bg-card shadow-sm hover:shadow-xl hover:border-primary/50 transition-all duration-500">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full">
                    <div className="space-y-2 mb-4 md:mb-0 w-full md:w-auto">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-lg md:text-xl font-black text-primary italic tracking-tighter">GPU #{res.gpu_id}</span>
                        {isPending && <Badge variant="warning">Pending</Badge>}
                        {isRejected && <Badge variant="danger">Rejected</Badge>}
                        {isApproved && !isStarted && <Badge variant="default">Upcoming</Badge>}
                        {isApproved && isStarted && !isEnded && <Badge variant="success">Active Now</Badge>}
                        {isApproved && isEnded && <Badge variant="muted">Finished</Badge>}
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground font-bold bg-muted/50 inline-block px-2 py-1 rounded-md">
                        {start.toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        <span className="mx-2 opacity-30">→</span>
                        {end.toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                      {(isPending || (isApproved && !isStarted)) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCancelTarget({ id: res.id, status: res.status })}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                      <Button
                        className="flex-grow md:flex-grow-0 min-w-[140px] md:min-w-[180px] font-black px-8 transition-all duration-300 uppercase italic text-[11px] h-11 gap-2"
                        variant={canStart ? "default" : "secondary"}
                        disabled={!canStart}
                        onClick={() => setSelectedRes(selectedRes?.id === res.id ? null : res)}
                      >
                        {isRejected ? "Access Denied" : isApproved && !isStarted ? "Waiting" : isApproved && isEnded ? "Session Ended" : isApproved ? (selectedRes?.id === res.id ? "Close Guide" : "Start Session") : "Under Review"}
                      </Button>
                    </div>
                  </div>

                  {/* Credentials & Guide Panel */}
                  {selectedRes?.id === res.id && canStart && (
                    <div className="mt-6 p-6 bg-muted/30 border-2 border-dashed border-primary/20 rounded-2xl animate-in slide-in-from-top-4 duration-500">
                      <div className="space-y-4 max-w-sm">
                        <h3 className="flex items-center gap-2 font-black uppercase tracking-tighter italic text-primary">
                          <Key className="size-4" /> Access Credentials
                        </h3>
                        <div className="flex flex-col gap-1.5 p-4 bg-background border rounded-xl shadow-inner">
                          <span className="text-[10px] font-black uppercase opacity-50 tracking-widest">Password</span>
                          <div className="flex items-center justify-between">
                            <code className={password ? "text-lg font-black text-blue-500 tracking-wider" : "text-sm font-bold text-muted-foreground animate-pulse"}>
                              {password || "비밀번호 준비 중..."}
                            </code>
                            {password && (
                              <Button variant="ghost" size="icon" onClick={() => copyToClipboard(password)} className="h-8 w-8 hover:bg-primary/10">
                                <Copy className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-bold leading-tight px-1 italic">
                          ※ 이 비밀번호는 예약된 시간에만 유효하며, 세션 종료 후 자동 무효화됩니다.
                        </p>
                        {gpuInfo?.jupyterhubUrl && (
                          <Button
                            asChild
                            className="w-full font-black text-[10px] uppercase tracking-widest h-11 border-2 hover:bg-foreground hover:text-background transition-all"
                            variant="outline"
                          >
                            <a href={gpuInfo.jupyterhubUrl} target="_blank" rel="noopener noreferrer">
                              Open Jupyter Notebook
                            </a>
                          </Button>
                        )}
                        <Button
                          className="w-full font-black text-[10px] uppercase tracking-widest h-11 gap-2"
                          variant="destructive"
                          onClick={() => setEndTarget(res.id)}
                        >
                          <StopCircle className="size-4" /> 사용 중단
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
      </section>

      <Dialog open={!!endTarget} onOpenChange={(open) => { if (!open) setEndTarget(null); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tighter italic">
              <StopCircle className="size-5 text-destructive" />
              사용 중단
            </DialogTitle>
            <DialogDescription className="text-sm font-bold pt-1">
              지금 세션을 종료하시겠습니까? 컨테이너가 초기화되며 작업 내용이 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-black uppercase text-[10px]" onClick={() => setEndTarget(null)}>
              돌아가기
            </Button>
            <Button variant="destructive" className="font-black uppercase text-[10px]" onClick={handleEndSession}>
              종료하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tighter italic">
              <AlertTriangle className="size-5 text-destructive" />
              Cancel Reservation
            </DialogTitle>
            <DialogDescription className="text-sm font-bold pt-1">
              {cancelTarget?.status === 'approved'
                ? "이 예약은 이미 승인된 상태입니다. 정말 취소하시겠습니까?"
                : "예약을 취소하시겠습니까?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-black uppercase text-[10px]" onClick={() => setCancelTarget(null)}>
              돌아가기
            </Button>
            <Button variant="destructive" className="font-black uppercase text-[10px]" onClick={handleCancel}>
              취소하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

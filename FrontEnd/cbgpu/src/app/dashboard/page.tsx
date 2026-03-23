'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import GPUCard from '@/components/GPUCard';
import WeeklyGPUCard from '@/components/WeeklyGPUCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/useAuth';
import { toast } from 'sonner';
import { RefreshCw, Trash2, Copy, Key, AlertTriangle, StopCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

export default function Dashboard() {
  const { user } = useAuth();
  const [myReservations, setMyReservations] = useState<any[]>([]);
  const [gpuPasswords, setGpuPasswords] = useState<{[key: number]: string}>({});
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedRes, setSelectedRes] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; status: string } | null>(null);
  const [endTarget, setEndTarget] = useState<string | null>(null);

  const gpus = [
    { id: 1, name: "RTX5000", username: "gpu1", host: "10.138.26.144", port: 8001, jupyterhubUrl: "http://10.138.26.144:8001" },
    { id: 2, name: "RTX5000", username: "gpu2", host: "10.138.26.144", port: 8002, jupyterhubUrl: "http://10.138.26.144:8002" },
    { id: 3, name: "RTX5000", username: "gpu3", host: "10.138.26.144", port: 8003, jupyterhubUrl: "http://10.138.26.144:8003" },
    { id: 4, name: "RTX5000", username: "gpu4", host: "10.138.26.144", port: 8004, jupyterhubUrl: "http://10.138.26.144:8004" },
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchGpuPasswords = async () => {
    const { data } = await supabase.from('gpus').select('id, password');
    if (data) {
      const map: {[key: number]: string} = {};
      data.forEach((gpu: any) => { map[gpu.id] = gpu.password; });
      setGpuPasswords(map);
    }
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
      toast.success("Reservation cancelled.");
      setCancelTarget(null);
      fetchMyReservations();
    } catch (err: any) {
      toast.error("Failed to cancel: " + err.message);
    }
  };

  const handleEndSession = async () => {
    if (!endTarget) return;
    const { error } = await supabase
      .from('reservations')
      .update({ end_time: new Date().toISOString() })
      .eq('id', endTarget);
    if (error) {
      toast.error("Failed to end session: " + error.message);
    } else {
      toast.success("Session ended.");
      setEndTarget(null);
      setSelectedRes(null);
      fetchMyReservations();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  useEffect(() => {
    if (user) {
      fetchMyReservations();
      fetchGpuPasswords();
      const subscription = supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchMyReservations())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gpus' }, () => fetchGpuPasswords())
        .subscribe();
      return () => { supabase.removeChannel(subscription); };
    }
  }, [user]);

  if (!user && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <h2 className="text-2xl font-black uppercase italic">Authentication Required</h2>
        <p className="text-muted-foreground">Please sign in to view your reservations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 md:space-y-20 transition-colors duration-500">
      <section>
        <div className="flex flex-col items-center md:items-start mb-8 gap-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase">GPU Clusters</h1>
          <div className="h-1 w-20 bg-primary rounded-full"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {gpus.map((gpu) => (
            gpu.id === 1
              ? <GPUCard key={gpu.id} id={gpu.id} name={gpu.name} />
              : <WeeklyGPUCard key={gpu.id} id={gpu.id} name={gpu.name} />
          ))}
        </div>
      </section>

      <hr className="border-border transition-colors duration-500" />

      <section className="pb-20">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col">
            <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase italic">My Reservations</h2>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Manage your active sessions</p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchMyReservations} className="hover:bg-primary/10 font-bold uppercase text-[10px] gap-2">
            <RefreshCw className="size-3" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 w-full bg-muted animate-pulse rounded-2xl"></div>
            ))}
          </div>
        ) : myReservations.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-3xl text-muted-foreground transition-colors duration-500 font-medium bg-muted/10">
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
                        {isPending && <span className="bg-amber-500/10 text-amber-600 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-amber-500/20">Pending</span>}
                        {isRejected && <span className="bg-destructive/10 text-destructive text-[9px] font-black uppercase px-2 py-0.5 rounded border border-destructive/20">Rejected</span>}
                        {isApproved && !isStarted && <span className="bg-blue-500/10 text-blue-600 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-blue-500/20">Upcoming</span>}
                        {isApproved && isStarted && !isEnded && <span className="bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-emerald-500/20">Active Now</span>}
                        {isApproved && isEnded && <span className="bg-slate-500/10 text-slate-600 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-slate-500/20">Finished</span>}
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground font-bold bg-muted/50 inline-block px-2 py-1 rounded-md">
                        {start.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        <span className="mx-2 opacity-30">→</span>
                        {end.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
                            className="w-full font-black text-[10px] uppercase tracking-widest h-11 border-2 hover:bg-foreground hover:text-background transition-all"
                            variant="outline"
                            onClick={() => window.open(gpuInfo.jupyterhubUrl, '_blank', 'noopener,noreferrer')}
                          >
                            Open Jupyter Notebook — {gpuInfo.jupyterhubUrl}
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

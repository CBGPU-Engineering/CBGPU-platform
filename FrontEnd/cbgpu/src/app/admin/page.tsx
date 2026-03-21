'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { ShieldAlert, CheckCircle2, XCircle, Clock, Undo2 } from 'lucide-react';

export default function AdminPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchReservations = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        profiles:user_id (
          full_name,
          student_id
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
        console.error("Data Load Error:", error);
        toast.error("Failed to load data.");
    } else {
        setReservations(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchReservations();
    }
  }, [authLoading, isAdmin]);

  function generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(x => chars[x % chars.length]).join('');
  }

  async function updateStatus(id: string, newStatus: 'approved' | 'rejected' | 'pending', gpuId?: number) {
    if (newStatus === 'approved' && gpuId !== undefined) {
      const password = generatePassword();
      const { error: gpuError } = await supabase
        .from('gpus')
        .upsert({ id: gpuId, password }, { onConflict: 'id' });
      if (gpuError) {
        toast.error("Failed to generate credentials: " + gpuError.message);
        return;
      }
    }

    const { error } = await supabase
      .from('reservations')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
        toast.error("Action failed: " + error.message);
    } else {
        toast.success(`Status updated to ${newStatus}.`);
        fetchReservations();
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse font-black uppercase tracking-widest text-muted-foreground">Verifying Authority...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in duration-700">
        <div className="bg-destructive/10 p-8 rounded-full ring-8 ring-destructive/5">
          <ShieldAlert className="w-16 h-16 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase">Access Denied</h1>
          <p className="text-muted-foreground text-lg max-w-md font-bold uppercase opacity-70">
            Administrator privileges required.
          </p>
        </div>
        <Button onClick={() => router.push('/')} variant="outline" className="font-black px-10 h-12 uppercase tracking-widest border-2 hover:bg-foreground hover:text-background transition-all">
          Return Home
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <section>
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter italic uppercase">Admin Control</h1>
            <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest opacity-60">Review and manage GPU reservation requests</p>
          </div>
          <div className="h-1 flex-grow bg-muted rounded-full hidden md:block opacity-20"></div>
        </div>

        <div className="border-2 rounded-3xl bg-card overflow-hidden shadow-2xl transition-all">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-b-2">
                  <TableHead className="font-black uppercase text-[10px] tracking-widest py-5 px-6">Applicant</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">GPU Unit</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">Time Frame</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">Status</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest py-5 px-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-20 animate-pulse font-bold text-muted-foreground">Loading Records...</TableCell></TableRow>
                ) : reservations.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-20 font-bold text-muted-foreground opacity-50">No pending requests found.</TableCell></TableRow>
                ) : (
                  reservations.map((res) => {
                    const start = new Date(res.start_time);
                    const end = new Date(res.end_time);
                    const isEnded = new Date() > end;
                    const dateOptions: Intl.DateTimeFormatOptions = {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    };

                    return (
                      <TableRow key={res.id} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                        <TableCell className="py-5 px-6">
                          <div className="flex flex-col">
                            <span className="font-black text-sm uppercase tracking-tight">{res.profiles?.full_name || 'Unknown'}</span>
                            <span className="text-[10px] text-muted-foreground font-bold opacity-70">{res.profiles?.student_id || res.user_email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-black italic text-primary">GPU #{res.gpu_id}</TableCell>
                        <TableCell className="text-[11px] font-bold leading-tight py-5">
                          <div className="bg-muted/50 px-3 py-2 rounded-xl inline-block border border-border/50">
                            {start.toLocaleString('ko-KR', dateOptions)} <br/>
                            <span className="opacity-30 mx-1">to</span> {end.toLocaleString('ko-KR', dateOptions)}
                          </div>
                        </TableCell>
                        <TableCell className="py-5">
                          {res.status === 'pending' && (
                            <div className="flex items-center gap-1.5 text-amber-500 font-black text-[10px] uppercase bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                              <Clock className="size-3" /> Pending
                            </div>
                          )}
                          {res.status === 'approved' && (
                            <div className="flex items-center gap-1.5 text-emerald-500 font-black text-[10px] uppercase bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="size-3" /> Approved
                            </div>
                          )}
                          {res.status === 'rejected' && (
                            <div className="flex items-center gap-1.5 text-red-500 font-black text-[10px] uppercase bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
                              <XCircle className="size-3" /> Rejected
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right py-5 px-6">
                          <div className="flex justify-end gap-2">
                            {isEnded ? (
                              <span className="text-[10px] font-black uppercase opacity-30 px-4">Session Finished</span>
                            ) : res.status === 'pending' ? (
                              <>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase h-8 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" onClick={() => updateStatus(res.id, 'approved', res.gpu_id)}>Approve</Button>
                                <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase h-8 px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" onClick={() => updateStatus(res.id, 'rejected')}>Reject</Button>
                              </>
                            ) : (
                              <Button size="sm" variant="outline" className="font-black text-[10px] uppercase h-8 px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" onClick={() => updateStatus(res.id, 'pending')}>
                                <Undo2 className="size-3" /> Reset
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </div>
  );
}

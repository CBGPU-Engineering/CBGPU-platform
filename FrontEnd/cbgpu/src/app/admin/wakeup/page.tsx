'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ShieldAlert, Check, X, Trash2, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import { PersonSearchSelect } from '@/components/manufacturing/PersonSearchSelect';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';

export default function AdminWakeupPage() {
  const { isAdmin, isWakeupManager, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();
  const canManage = isAdmin || isWakeupManager;

  const [pending, setPending] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── 기상송 담당자 지정 (진짜 사이트 관리자만) ────────────────────────────
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [newManagerId, setNewManagerId] = useState('');

  const fetchManagers = async () => {
    if (!isAdmin) return;
    const [allRes, managersRes] = await Promise.all([
      supabase.from('profiles').select('id, student_id, full_name').order('student_id'),
      supabase.from('profiles').select('id, student_id, full_name').eq('is_wakeup_manager', true).order('student_id'),
    ]);
    if (!allRes.error) setAllProfiles(allRes.data || []);
    if (!managersRes.error) setManagers(managersRes.data || []);
  };

  const addManager = async () => {
    if (!newManagerId) return;
    const { error } = await supabase.from('profiles').update({ is_wakeup_manager: true }).eq('id', newManagerId);
    if (error) showError('지정 실패: ' + error.message);
    else { showSuccess('기상송 담당자로 지정했어요.'); setNewManagerId(''); fetchManagers(); }
  };

  const removeManager = async (id: string) => {
    const { error } = await supabase.from('profiles').update({ is_wakeup_manager: false }).eq('id', id);
    if (error) showError('해제 실패: ' + error.message);
    else { showSuccess('담당자 지정을 해제했어요.'); fetchManagers(); }
  };

  const fetchAll = async () => {
    const [pendingRes, queueRes] = await Promise.all([
      supabase.from('wakeup_songs').select('*, profiles:user_id (full_name, student_id)').eq('status', 'pending').order('created_at', { ascending: true }),
      supabase.from('wakeup_songs').select('*, profiles:user_id (full_name, student_id)').eq('status', 'approved').order('created_at', { ascending: true }),
    ]);
    if (!pendingRes.error) setPending(pendingRes.data || []);
    if (!queueRes.error) setQueue(queueRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && canManage) { fetchAll(); fetchManagers(); }
    else if (!authLoading) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canManage]);

  const approve = async (id: string) => {
    const { error } = await supabase.from('wakeup_songs').update({ status: 'approved' }).eq('id', id);
    if (error) showError('승인 실패: ' + error.message);
    else { showSuccess('승인했어요.'); fetchAll(); }
  };

  const reject = async (id: string) => {
    const { error } = await supabase.from('wakeup_songs').update({ status: 'rejected', reject_reason: rejectReason.trim() || null }).eq('id', id);
    if (error) showError('거절 실패: ' + error.message);
    else { showSuccess('거절했어요.'); setRejectingId(null); setRejectReason(''); fetchAll(); }
  };

  const removeFromQueue = async (id: string) => {
    const { error } = await supabase.from('wakeup_songs').delete().eq('id', id);
    if (error) showError('삭제 실패: ' + error.message);
    else { showSuccess('대기열에서 뺐어요.'); fetchAll(); }
  };

  if (authLoading || loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoadingSpinner size={48} /></div>;
  }

  if (!canManage) {
    return (
      <div className="max-w-sm mx-auto mt-16 text-center space-y-4">
        <ShieldAlert className="size-12 mx-auto text-destructive" />
        <p className="font-bold">관리자 또는 기상송 담당자만 볼 수 있는 페이지예요.</p>
        <Button onClick={() => router.push('/')}>홈으로</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-10">
      <h1 className="text-3xl font-black italic tracking-tighter">기상송 관리</h1>

      {isAdmin && (
        <section className="space-y-3 rounded-[28px] border border-border/60 bg-card p-5">
          <div className="flex items-center gap-2"><UserCog className="size-5 text-primary" /><h2 className="text-lg font-black">담당자 지정</h2></div>
          <div className="flex gap-2">
            <PersonSearchSelect candidates={allProfiles.filter(p => !managers.some(m => m.id === p.id))} value={newManagerId} onChange={setNewManagerId} />
            <Button onClick={addManager} disabled={!newManagerId}>추가</Button>
          </div>
          {managers.length > 0 && (
            <ul className="space-y-1.5">
              {managers.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm bg-muted/50 rounded-xl px-3 py-2">
                  <span className="font-bold">{m.full_name || 'Unknown'} <span className="text-muted-foreground opacity-60">({m.student_id || '-'})</span></span>
                  <Button size="icon-sm" variant="ghost" onClick={() => removeManager(m.id)} aria-label="담당자 해제"><X className="size-4 text-destructive" /></Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-black">검토 대기 ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-muted-foreground">검토할 신청이 없어요.</p>}
        {pending.map((song) => (
          <div key={song.id} className="rounded-2xl bg-card ring-1 ring-border/60 p-3 space-y-2">
            <div className="flex items-center gap-3">
              {song.thumbnail_url && <Image src={song.thumbnail_url} alt={song.title} width={72} height={54} className="rounded-lg object-cover shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{song.title}</p>
                <p className="text-xs text-muted-foreground truncate">{song.channel_title} · {song.profiles?.full_name} ({song.profiles?.student_id})</p>
                {song.message && <p className="text-xs italic text-muted-foreground truncate">&quot;{song.message}&quot;</p>}
              </div>
            </div>
            {rejectingId === song.id ? (
              <div className="flex gap-2">
                <Input placeholder="거절 사유 (선택)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="flex-1" />
                <Button size="sm" variant="destructive" onClick={() => reject(song.id)}>거절 확정</Button>
                <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setRejectReason(''); }}>취소</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => approve(song.id)} className="flex-1"><Check className="size-3.5 mr-1" /> 승인</Button>
                <Button size="sm" variant="destructive" onClick={() => setRejectingId(song.id)} className="flex-1"><X className="size-3.5 mr-1" /> 거절</Button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2"><h2 className="text-lg font-black">대기열</h2><Badge variant="default">{queue.length}곡</Badge></div>
        {queue.length === 0 && <p className="text-sm text-muted-foreground">대기열이 비어 있어요.</p>}
        {queue.map((song, i) => (
          <div key={song.id} className="flex items-center gap-3 rounded-2xl bg-card ring-1 ring-border/60 p-3">
            <span className="text-xs font-black text-muted-foreground w-4">{i + 1}</span>
            {song.thumbnail_url && <Image src={song.thumbnail_url} alt={song.title} width={56} height={42} className="rounded-lg object-cover shrink-0" />}
            <p className="text-sm font-bold truncate flex-1">{song.title}</p>
            <Button size="icon-sm" variant="ghost" onClick={() => removeFromQueue(song.id)} aria-label="대기열에서 제거"><Trash2 className="size-4 text-destructive" /></Button>
          </div>
        ))}
      </section>
    </div>
  );
}

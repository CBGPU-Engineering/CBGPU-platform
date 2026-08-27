'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Model3MFViewer } from '@/components/manufacturing/Model3MFViewer';
import { LocateStudentButton } from '@/components/manufacturing/LocateStudentButton';
import {
  ArrowLeft, Download, CheckCircle2, Clock, XCircle, Boxes, Printer, Trash2, PackageCheck,
} from 'lucide-react';

const labelCls = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block';

const STATUS_INFO: Record<string, { icon: React.ReactNode; variant: any; label: string }> = {
  pending:  { icon: <Clock className="size-4" />,        variant: 'warning', label: '승인 대기' },
  accepted: { icon: <Boxes className="size-4" />,         variant: 'default', label: '대기열' },
  queued:   { icon: <Boxes className="size-4" />,         variant: 'default', label: '대기열' },
  printing: { icon: <Printer className="size-4" />,       variant: 'success', label: '프린팅 중' },
  done:     { icon: <CheckCircle2 className="size-4" />,  variant: 'success', label: '완료' },
  rejected: { icon: <XCircle className="size-4" />,       variant: 'danger',  label: '거절됨' },
  canceled: { icon: <Trash2 className="size-4" />,        variant: 'muted',   label: '취소됨' },
};

export default function PrintJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  const [job, setJob] = useState<any>(null);
  const [requester, setRequester] = useState<{ full_name: string | null; student_id: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const fetchJob = async () => {
    const { data, error } = await supabase.from('print_jobs').select('*, manager:manager_id(full_name, student_id), preferred_printer:preferred_printer_id(name)').eq('id', id).single();
    if (error) { showError('신청 내역을 찾을 수 없습니다.'); router.push('/manufacturing'); return; }
    setJob(data);
    setLoading(false);
    if (data.file_path) {
      const { data: signed } = await supabase.storage.from('manufacturing').createSignedUrl(data.file_path, 3600);
      setDownloadUrl(signed?.signedUrl || null);
    }
    if (data.user_id !== user?.id) {
      const { data: profile } = await supabase.from('profiles').select('full_name, student_id').eq('id', data.user_id).maybeSingle();
      setRequester(profile);
    }
  };

  useEffect(() => { if (id) fetchJob(); }, [id]);

  const handleCancel = async () => {
    const { error } = await supabase.from('print_jobs').update({ status: 'canceled' }).eq('id', job.id);
    if (error) showError('취소 실패: ' + error.message);
    else { showSuccess('신청이 취소됐습니다.'); setCancelOpen(false); fetchJob(); }
  };

  const handleMarkDelivered = async () => {
    const { error } = await supabase.from('print_jobs').update({ delivered_at: new Date().toISOString() }).eq('id', job.id);
    if (error) showError('처리 실패: ' + error.message);
    else { showSuccess('전달 완료로 표시했습니다.'); fetchJob(); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size={56} label="불러오는 중" />
      </div>
    );
  }

  if (!job) return null;

  const isOwner = user?.id === job.user_id;
  const statusInfo = STATUS_INFO[job.status] || { icon: null, variant: 'default', label: job.status };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-2xl">
      <div>
        <button
          onClick={() => router.push('/manufacturing')}
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-3" /> Back
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-3xl font-black tracking-tighter italic uppercase">3D 프린팅 신청</h1>
              <Badge variant={statusInfo.variant} icon={statusInfo.icon}>{statusInfo.label}</Badge>
              {job.status === 'done' && job.delivered_at && (
                <Badge variant="success" icon={<PackageCheck className="size-3" />}>전달 완료</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-bold opacity-70">{job.file_name || '파일 없음'}</p>
          </div>

          {isOwner && job.status === 'pending' && (
            <Button variant="destructive" className="font-black text-[10px] uppercase gap-1.5 h-9" onClick={() => setCancelOpen(true)}>
              <Trash2 className="size-3.5" /> 신청 취소
            </Button>
          )}
          {!isOwner && job.status === 'done' && !job.delivered_at && (
            <div className="flex items-center gap-2">
              <LocateStudentButton studentId={requester?.student_id} studentName={requester?.full_name} />
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase gap-1.5 h-9" onClick={handleMarkDelivered}>
                <PackageCheck className="size-3.5" /> 가져다 줌
              </Button>
            </div>
          )}
        </div>
      </div>

      {downloadUrl && job.file_name?.toLowerCase().endsWith('.3mf') && (
        <Model3MFViewer src={downloadUrl} />
      )}

      <div className="border-2 rounded-3xl overflow-hidden bg-card">
        <div className="px-6 py-4 border-b-2 bg-muted/20">
          <p className="font-black uppercase tracking-widest text-xs">Details</p>
        </div>
        <div className="p-6 grid gap-5">
          {requester && (
            <div>
              <label className={labelCls}>신청자</label>
              <span className="font-bold text-sm">{requester.full_name || 'Unknown'} {requester.student_id ? `(${requester.student_id})` : ''}</span>
            </div>
          )}
          <div>
            <label className={labelCls}>모드</label>
            <span className="font-bold text-sm">{job.mode === 'beginner' ? '초보자 (담당자가 슬라이싱)' : '고급자 (본인이 직접 슬라이싱한 파일 제출)'}</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>수량</label>
              <span className="font-bold text-sm">{job.quantity}개</span>
            </div>
            <div>
              <label className={labelCls}>플레이트 수</label>
              <span className="font-bold text-sm">
                {job.plate_count}개{job.plate_count > 1 && job.status === 'printing' ? ` (${job.plates_completed}개 완료)` : ''}
              </span>
            </div>
            <div>
              <label className={labelCls}>재질</label>
              <span className="font-bold text-sm">{job.material || '상관없음'}</span>
            </div>
            <div>
              <label className={labelCls}>색상</label>
              <span className="font-bold text-sm">{job.color || '상관없음'}</span>
            </div>
          </div>
          {job.purpose && (
            <div>
              <label className={labelCls}>사용 목적</label>
              <p className="text-sm font-bold whitespace-pre-wrap">{job.purpose}</p>
            </div>
          )}
          {job.preferred_printer?.name && (
            <div>
              <label className={labelCls}>희망 프린터</label>
              <span className="font-bold text-sm">{job.preferred_printer.name}</span>
            </div>
          )}
          {job.manager?.full_name && (
            <div>
              <label className={labelCls}>담당자</label>
              <span className="font-bold text-sm">{job.manager.full_name} {job.manager.student_id ? `(${job.manager.student_id})` : ''}</span>
            </div>
          )}
          {job.status === 'rejected' && job.reject_reason && (
            <div>
              <label className={labelCls}>거절 사유</label>
              <p className="text-sm font-bold text-destructive whitespace-pre-wrap">{job.reject_reason}</p>
            </div>
          )}
          {downloadUrl && (
            <div>
              <label className={labelCls}>모델 파일</label>
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
                <Download className="size-3.5" /> {job.file_name}
              </a>
            </div>
          )}
          {job.notes && (
            <div>
              <label className={labelCls}>메모</label>
              <p className="text-sm font-bold whitespace-pre-wrap">{job.notes}</p>
            </div>
          )}
          {job.printer_id && (
            <div>
              <label className={labelCls}>프린터</label>
              <span className="font-bold text-sm">프린터 {job.printer_id}</span>
            </div>
          )}
          {job.estimated_end_at && job.status === 'printing' && (
            <div>
              <label className={labelCls}>예상 완료 시각</label>
              <span className="font-bold text-sm">{new Date(job.estimated_end_at).toLocaleString('ko-KR')}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/40">
            <div>
              <label className={labelCls}>신청일</label>
              <span className="text-xs font-bold text-muted-foreground">{new Date(job.created_at).toLocaleString('ko-KR')}</span>
            </div>
            {job.completed_at && (
              <div>
                <label className={labelCls}>완료일</label>
                <span className="text-xs font-bold text-muted-foreground">{new Date(job.completed_at).toLocaleString('ko-KR')}</span>
              </div>
            )}
            {job.collected_at && (
              <div>
                <label className={labelCls}>회수일</label>
                <span className="text-xs font-bold text-muted-foreground">{new Date(job.collected_at).toLocaleString('ko-KR')}</span>
              </div>
            )}
            {job.delivered_at && (
              <div>
                <label className={labelCls}>전달일</label>
                <span className="text-xs font-bold text-muted-foreground">{new Date(job.delivered_at).toLocaleString('ko-KR')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="신청 취소"
        description="이 3D 프린팅 신청을 취소합니다. 되돌릴 수 없습니다."
        confirmLabel="취소하기"
        onConfirm={handleCancel}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}

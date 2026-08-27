'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/spinner';
import { locateStudentNow, LocationResult } from '@/lib/manufacturing/locateStudent';
import { MapPin } from 'lucide-react';

/** Lets a manager check where a requester probably is right now (via the school
 * timetable during class hours, or today's self-study room assignments otherwise),
 * so they can go hand over a finished print/cut in person. */
export function LocateStudentButton({ studentId, studentName }: { studentId?: string | null; studentName?: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LocationResult | null>(null);
  const [errored, setErrored] = useState(false);

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);
    setErrored(false);
    try {
      const r = await locateStudentNow(studentId);
      setResult(r);
      if (!r) setErrored(true);
    } catch {
      setResult(null);
      setErrored(true);
    }
    setLoading(false);
  };

  return (
    <>
      <Button size="sm" variant="outline" className="font-black text-[10px] uppercase gap-1.5" onClick={handleOpen}>
        <MapPin className="size-3.5" /> 지금 위치 확인
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tighter italic text-xl">{studentName || '신청자'} 위치</DialogTitle>
            <DialogDescription className="text-xs font-bold opacity-60">현재 시각 기준 예상 위치입니다.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {loading ? (
              <div className="flex justify-center py-6"><LoadingSpinner size={36} label="위치 확인 중" /></div>
            ) : errored || !result ? (
              <p className="text-sm font-bold text-muted-foreground text-center py-4">
                학번 정보가 없거나 위치를 확인하지 못했습니다.
              </p>
            ) : result.kind === 'class' ? (
              <div className="space-y-2 text-center">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  {result.period ? `일과시간 · ${result.period}교시${result.subject ? ` (${result.subject})` : ''}` : '자습 시간 외'}
                </p>
                <p className="text-2xl font-black">{result.identity.grade}학년 {result.identity.classNo}반 교실</p>
                <p className="text-[10px] text-muted-foreground opacity-60">이동수업이 아니라면 이 교실에 있을 가능성이 높습니다.</p>
              </div>
            ) : result.kind === 'selfstudy' ? (
              <div className="space-y-2 text-center">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">자습 시간 · {result.period}교시</p>
                <p className="text-2xl font-black">{result.roomName}{result.seatName ? ` · ${result.seatName}` : ''}</p>
              </div>
            ) : (
              <p className="text-sm font-bold text-muted-foreground text-center py-4">
                현재 {result.period}교시 자습 시간이지만, 신청 내역이 없습니다.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

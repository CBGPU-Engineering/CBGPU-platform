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
        <MapPin className="size-3.5" />  Locate requester
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tighter italic text-xl">{studentName || "Requester"}  location</DialogTitle>
            <DialogDescription className="text-xs font-bold opacity-60">Estimated location based on the current time.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {loading ? (
              <div className="flex justify-center py-6"><LoadingSpinner size={36} label="Locating requester" /></div>
            ) : errored || !result ? (
              <p className="text-sm font-bold text-muted-foreground text-center py-4">

                Student ID or location information is unavailable.
              </p>
            ) : result.kind === 'class' ? (
              <div className="space-y-2 text-center">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  {result.period ? `School hours · period ${result.period}${result.subject ? ` (${result.subject})` : ''}` : "Outside self-study hours"}
                </p>
                <p className="text-2xl font-black">Grade {result.identity.grade}, Class {result.identity.classNo} classroom</p>
                <p className="text-[10px] text-muted-foreground opacity-60">The student may be in this classroom unless attending a different class.</p>
              </div>
            ) : result.kind === 'selfstudy' ? (
              <div className="space-y-2 text-center">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Self-study · {result.period}period</p>
                <p className="text-2xl font-black">{result.roomName}{result.seatName ? ` · ${result.seatName}` : ''}</p>
              </div>
            ) : (
              <p className="text-sm font-bold text-muted-foreground text-center py-4">

                It is currently self-study period {result.period}, but no request was found.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

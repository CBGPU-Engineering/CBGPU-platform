'use client';
import Image from 'next/image';
import { X } from 'lucide-react';

type PrinterStatus = 'idle' | 'printing' | 'done' | 'maintenance';

/** Printer card image — overlays status on the real product photo
 * (public/img/bambu-x1c.png): full color only while printing, grayscale
 * otherwise (idle/maintenance), plus a big X when marked broken. */
export function PrinterVisual({ status }: { status: PrinterStatus }) {
  const inUse = status === 'printing';

  return (
    <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-muted/20">
      {inUse && (
        <div className="absolute inset-0 bg-emerald-500/25 blur-2xl printer-glow" />
      )}
      <Image
        src="/img/bambu-x1c.png"
        alt="Bambu Lab X1 Carbon"
        fill
        sizes="(max-width: 768px) 50vw, 220px"
        className={`relative object-contain p-2 transition-all duration-300 ${inUse ? '' : 'grayscale opacity-70'}`}
      />
      {status === 'maintenance' && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/10">
          <X className="size-16 text-destructive drop-shadow-lg" strokeWidth={3.5} />
        </div>
      )}
    </div>
  );
}

import Image from 'next/image';

/** Generic modern-smartphone bezel (no particular brand) around a screenshot
 * — CSS only, no device-frame image asset needed. Titanium-ish gradient
 * frame + a dynamic-island-style cutout reads as an actual device rather
 * than "a black rounded rectangle", which a flat bg-neutral-900 frame with a
 * tiny punch-hole dot did not. */
export function PhoneMockup({
  src, alt, className = '', width = 260,
}: { src: string; alt: string; className?: string; width?: number }) {
  return (
    <div className={`relative mx-auto ${className}`} style={{ width }}>
      <div className="relative rounded-[3rem] bg-gradient-to-br from-neutral-600 via-neutral-800 to-black p-[3px] shadow-[0_35px_60px_-20px_rgba(0,0,0,0.45)]">
        <div className="relative rounded-[calc(3rem-3px)] bg-black p-2 ring-1 ring-white/10">
          <div className="relative rounded-[2.1rem] overflow-hidden bg-black aspect-[9/19.5]">
            <Image src={src} alt={alt} fill sizes="300px" className="object-cover object-top" />
            {/* subtle glass sheen */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
            {/* dynamic-island-style cutout */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-16 h-5 rounded-full bg-black ring-1 ring-white/10" />
          </div>
        </div>
      </div>
      {/* side buttons */}
      <div className="absolute right-0 top-24 w-[3px] h-11 bg-gradient-to-b from-neutral-600 to-neutral-900 rounded-l" />
      <div className="absolute left-0 top-20 w-[3px] h-7 bg-gradient-to-b from-neutral-600 to-neutral-900 rounded-r" />
      <div className="absolute left-0 top-28 w-[3px] h-11 bg-gradient-to-b from-neutral-600 to-neutral-900 rounded-r" />
    </div>
  );
}

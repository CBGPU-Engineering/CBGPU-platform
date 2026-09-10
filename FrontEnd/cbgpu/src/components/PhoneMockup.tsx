import Image from 'next/image';

/** Generic modern-smartphone bezel (no particular brand) around a screenshot
 * — CSS only, no device-frame image asset needed. */
export function PhoneMockup({
  src, alt, className = '', width = 260,
}: { src: string; alt: string; className?: string; width?: number }) {
  return (
    <div className={`relative mx-auto ${className}`} style={{ width }}>
      <div className="relative rounded-[2.5rem] bg-neutral-900 p-2.5 shadow-2xl">
        <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-[9/19.5]">
          <Image src={src} alt={alt} fill sizes="260px" className="object-cover object-top" />
          {/* punch-hole camera */}
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 size-2.5 rounded-full bg-black ring-1 ring-white/10" />
        </div>
      </div>
      {/* side buttons */}
      <div className="absolute right-0 top-24 w-[3px] h-10 bg-neutral-900 rounded-l" />
      <div className="absolute left-0 top-20 w-[3px] h-6 bg-neutral-900 rounded-r" />
      <div className="absolute left-0 top-28 w-[3px] h-10 bg-neutral-900 rounded-r" />
    </div>
  );
}

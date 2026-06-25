'use client';
import { useEffect, useState } from 'react';

/** 로딩 중엔 실제 3D 렌더 아이콘들이 차례로 지나가고, 완료되면 진짜 3D 체크 이미지가
 * 위에서 물리적으로 떨어지듯 바운스하며 안착한다 — CSS로 2D를 3D인 척 돌리지 않는다. */
const CYCLE_ICONS = ['/3d-icons/computer.webp', '/3d-icons/calendar.webp', '/3d-icons/notebook.webp', '/3d-icons/rocket.webp'];

export function LoadingSpinner({ done = false, size = 64, label }: {
  done?: boolean;
  size?: number;
  label?: string;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setIdx(i => (i + 1) % CYCLE_ICONS.length), 650);
    return () => clearInterval(t);
  }, [done]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        {!done ? (
          <img
            key={idx}
            src={CYCLE_ICONS[idx]}
            alt=""
            className="absolute inset-0 w-full h-full object-contain animate-in fade-in zoom-in-75 duration-300"
          />
        ) : (
          <img
            key="tick"
            src="/3d-icons/tick.webp"
            alt=""
            className="absolute inset-0 w-full h-full object-contain drop-in-3d"
          />
        )}
      </div>
      {label && <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{label}</p>}
    </div>
  );
}

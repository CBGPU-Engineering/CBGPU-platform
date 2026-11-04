'use client';
import { useEffect, useState } from 'react';
import { LoaderCircle, Check } from 'lucide-react';

/** 토스가 공식 오픈소스로 배포하는 이모지 폰트(Tossface)를 로딩 그래픽으로 쓴다 — 평평한
 * 라인 아이콘이 배경 없이 떠 있는 게 아니라, 색감과 입체감이 있는 진짜 그래픽이 부드러운
 * 컬러 배경(스테이지) 위에 떠 있다가, 완료되면 진짜 체크 이모지가 위에서 물리적으로
 * 떨어지듯 바운스하며 안착한다. */
const CYCLE = [
  { emoji: '💻', bg: 'bg-blue-400/15' },
  { emoji: '📅', bg: 'bg-violet-400/15' },
  { emoji: '📓', bg: 'bg-teal-400/15' },
  { emoji: '🚀', bg: 'bg-amber-400/15' },
];
const DONE = { emoji: '✅', bg: 'bg-success/15' };

export function LoadingSpinner({ done = false, size = 64, label }: {
  done?: boolean;
  size?: number;
  label?: string;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (done || ['admin.cbgpu.com','manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'].includes(window.location.hostname)) return;
    const t = setInterval(() => setIdx(i => (i + 1) % CYCLE.length), 650);
    return () => clearInterval(t);
  }, [done]);

  if(typeof window!=='undefined'&&['admin.cbgpu.com','manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'].includes(window.location.hostname))return <div className="flex flex-col items-center gap-3 text-muted-foreground" role="status">{done?<Check size={24}/>:<LoaderCircle className="animate-spin" size={24}/>}<span className="text-xs">{label||'Loading…'}</span></div>;

  const current = done ? DONE : CYCLE[idx];

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`relative flex items-center justify-center rounded-full transition-colors duration-300 ${current.bg}`}
        style={{ width: size * 1.6, height: size * 1.6 }}
      >
        <span
          key={done ? 'done' : idx}
          style={{ fontFamily: 'Tossface', fontSize: size * 0.7, lineHeight: 1 }}
          className={done ? 'drop-in-3d' : 'animate-in fade-in zoom-in-75 duration-300'}
        >
          {current.emoji}
        </span>
      </div>
      {label && <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{label}</p>}
    </div>
  );
}

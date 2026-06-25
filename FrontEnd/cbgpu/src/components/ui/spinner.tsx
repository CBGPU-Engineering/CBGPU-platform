'use client';
import { Check } from 'lucide-react';

/**
 * 단순 2D 회전 아이콘 대신 rotateY로 코인처럼 뒤집히는 3D 로딩 스피너.
 * done이 true가 되면 체크 아이콘이 팝인되며 완료를 알린다.
 */
export function LoadingSpinner({ done = false, size = 40, label }: {
  done?: boolean;
  size?: number;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <div
          className={`absolute inset-0 rounded-full border-4 border-muted transition-opacity duration-300 ${done ? 'opacity-0' : 'opacity-100'}`}
          style={{
            borderTopColor: 'var(--primary)',
            borderRightColor: 'var(--primary)',
            animation: done ? undefined : 'spin-3d 900ms linear infinite',
          }}
        />
        <Check
          className={`text-success absolute transition-all duration-300 ${done ? 'opacity-100 scale-100 pop-in-3d' : 'opacity-0 scale-50'}`}
          style={{ width: size * 0.5, height: size * 0.5 }}
        />
      </div>
      {label && <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{label}</p>}
    </div>
  );
}

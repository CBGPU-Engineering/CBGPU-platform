'use client';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface SegmentedTabItem {
  value: string;
  label: ReactNode;
}

/**
 * 활성 탭 뒤에서 슬라이드하는 인디케이터를 가진 탭. 사이트 전체에서 손으로 짠
 * 탭 버튼(인스턴트 배경색 전환)을 대체하는 단일 공유 컴포넌트.
 */
export function SegmentedTabs({ items, value, onChange, className = '', pill = false }: {
  items: SegmentedTabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  pill?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const recalc = () => {
      const el = itemRefs.current.get(value);
      if (!el) return;
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    };
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [value, items]);

  const shape = pill ? 'rounded-full' : 'rounded-lg';

  return (
    <div ref={containerRef} className={`relative flex gap-1 overflow-x-auto ${className}`}>
      {indicator && (
        <div
          className={`absolute top-0 bottom-0 bg-primary shadow-md transition-all duration-200 ease-[var(--ease-spring)] ${shape}`}
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
      {items.map((item) => (
        <button
          key={item.value}
          ref={(el) => { if (el) itemRefs.current.set(item.value, el); }}
          type="button"
          onClick={() => onChange(item.value)}
          className={`relative z-10 shrink-0 px-3 py-1.5 font-black text-xs uppercase tracking-widest transition-colors ${shape} ${
            value === item.value ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

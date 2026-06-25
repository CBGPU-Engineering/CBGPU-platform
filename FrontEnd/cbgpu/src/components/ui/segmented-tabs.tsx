'use client';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface SegmentedTabItem {
  value: string;
  label: ReactNode;
}

/**
 * 활성 탭 뒤에서 슬라이드하는 인디케이터를 가진 탭. 사이트 전체에서 손으로 짠
 * 탭 버튼(인스턴트 배경색 전환)을 대체하는 단일 공유 컴포넌트.
 *
 * 인디케이터 위치는 ref Map 대신 매 측정마다 DOM에서 data-value로 직접 찾는다 —
 * 인라인 ref 콜백은 렌더마다 새 함수가 되어 React가 매번 detach/attach를 반복하는데,
 * 이전 구현은 거기서 위치 계산이 어긋나 활성 탭 배경이 안 보이는 버그가 있었다.
 * 측정이 어떤 이유로든 실패해도 active 버튼 자체에 배경색이 폴백으로 깔리므로
 * 글자색만 남아 안 보이는 상태는 절대 발생하지 않는다.
 */
export function SegmentedTabs({ items, value, onChange, className = '', pill = false }: {
  items: SegmentedTabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  pill?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const recalc = () => {
      const container = containerRef.current;
      if (!container) return;
      const el = container.querySelector<HTMLButtonElement>(`[data-tab-value="${value}"]`);
      if (!el) { setIndicator(null); return; }
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    };
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [value, items]);

  const shape = pill ? 'rounded-full' : 'rounded-lg';

  return (
    <div ref={containerRef} className={`relative flex gap-1 overflow-x-auto ${className}`}>
      <div
        aria-hidden
        className={`absolute top-0 bottom-0 bg-primary shadow-md transition-all duration-300 ease-[var(--ease-spring)] ${shape} ${
          indicator ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ left: indicator?.left ?? 0, width: indicator?.width ?? 0 }}
      />
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            data-tab-value={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`relative z-10 shrink-0 px-3 py-1.5 font-black text-xs uppercase tracking-widest transition-colors duration-200 ${shape} ${
              active
                ? `text-primary-foreground ${indicator ? '' : 'bg-primary shadow-md'}`
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

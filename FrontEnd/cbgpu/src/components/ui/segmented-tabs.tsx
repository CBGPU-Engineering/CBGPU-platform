'use client';
import { useLayoutEffect, useRef, type ReactNode } from 'react';

export interface SegmentedTabItem {
  value: string;
  label: ReactNode;
}

/** 선택은 즉시 반영하고 배경만 이동한다. 방향키와 Home/End도 지원한다. */
export function SegmentedTabs({ items, value, onChange, className = '', pill = false, appearance = 'accent', label = '보기 선택' }: {
  items: SegmentedTabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  pill?: boolean;
  appearance?: 'accent' | 'neutral';
  label?: string;
}) {
  const shape = pill ? 'rounded-full' : 'rounded-lg';
  const rail = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = rail.current;
    if (!element) return;
    const measure = () => {
      const active = element.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if (!active) {
        delete element.dataset.motionReady;
        return;
      }
      element.style.setProperty('--tab-left', `${active.offsetLeft}px`);
      element.style.setProperty('--tab-width', `${active.offsetWidth}px`);
      element.dataset.motionReady = 'true';
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll('button').forEach(button => observer.observe(button));
    return () => observer.disconnect();
  }, [value, items]);

  return (
    <div ref={rail} role="group" aria-label={typeof window!=='undefined'&&['admin.cbgpu.com','manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'].includes(window.location.hostname)&&label==='보기 선택'?'View selection':label} className={`segmented-tabs relative flex max-w-full gap-1 overflow-x-auto p-1 ${appearance === 'neutral' ? 'rounded-xl bg-muted' : ''} ${className}`}>
      <span aria-hidden="true" className={`tab-selection ${shape} ${appearance === 'neutral' ? 'bg-card shadow-sm ring-1 ring-border' : 'bg-primary shadow-sm'}`} />
      {items.map((item, index) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            data-tab-value={item.value}
            type="button"
            aria-pressed={active}
            onKeyDown={event => {
              const next = event.key === 'ArrowRight' ? (index + 1) % items.length : event.key === 'ArrowLeft' ? (index - 1 + items.length) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
              if (next === null) return;
              event.preventDefault();
              const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button');
              buttons?.[next]?.focus();
              onChange(items[next].value);
            }}
            onClick={() => onChange(item.value)}
            className={`relative z-10 min-h-11 shrink-0 px-4 py-2 font-semibold text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2 ${shape} ${
              active
                ? appearance === 'neutral' ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'bg-primary text-primary-foreground shadow-sm'
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

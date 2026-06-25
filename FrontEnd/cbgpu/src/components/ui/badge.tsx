import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const VARIANTS = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger: 'bg-destructive/10 text-destructive',
  muted: 'bg-muted text-muted-foreground',
} as const;

export type BadgeVariant = keyof typeof VARIANTS;

/** 사이트 전체의 상태/태그 배지를 통일하는 공유 컴포넌트 (토큰 기반, 하드코딩 색 없음) */
export function Badge({ variant = 'default', icon, children, className }: {
  variant?: BadgeVariant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest shrink-0',
      VARIANTS[variant],
      className
    )}>
      {icon}
      {children}
    </span>
  );
}

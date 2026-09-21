import { LoadingSpinner } from '@/components/ui/spinner';

export default function Loading() {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <LoadingSpinner size={40} />
      <p className="text-sm font-medium text-muted-foreground">페이지를 불러오는 중이에요…</p>
    </div>
  );
}

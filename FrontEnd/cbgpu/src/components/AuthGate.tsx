'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { LoadingSpinner } from './ui/spinner';

const PUBLIC_PATHS = ['/', '/auth/login', '/auth/signup', '/auth/callback', '/contact'];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const blocked = !isLoading && !user && !isPublic;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size={56} />
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="max-w-sm mx-auto mt-16 text-center space-y-6 pop-in-3d">
        <img src="/3d-icons/lock.webp" alt="" className="size-24 mx-auto" />
        <div className="space-y-1.5">
          <p className="text-xl font-black tracking-tight">로그인이 필요해요</p>
          <p className="text-sm text-muted-foreground font-medium">이 페이지는 로그인한 학생만 볼 수 있어요</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href="/auth/login"
            className="rounded-2xl bg-primary text-primary-foreground py-3.5 font-black text-sm uppercase tracking-widest active:scale-[0.98] transition-transform"
          >
            로그인
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-2xl bg-card ring-1 ring-foreground/5 py-3.5 font-black text-sm uppercase tracking-widest active:scale-[0.98] transition-transform"
          >
            회원가입
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

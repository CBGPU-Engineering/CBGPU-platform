'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { LoadingSpinner } from './ui/spinner';

const PUBLIC_PATHS = ['/', '/contact', '/download', '/privacy'];

function isPublicPath(pathname: string) {
  // Every auth flow must be reachable before a normal signed-in session
  // exists. This includes forgot/reset password and any future callback page.
  // Sensitive actions still require the recovery session enforced by
  // Supabase; this only allows the page itself to render.
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/auth/');
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const isPublic = isPublicPath(pathname);
  const blocked = !isLoading && !user && !isPublic;

  // 공개 경로(로그인/회원가입 포함)는 auth 체크를 기다릴 필요가 전혀 없다 — 바로 렌더
  if (isPublic) return <>{children}</>;

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
        <div className="flex items-center justify-center size-24 mx-auto rounded-full bg-primary/10">
          <span style={{ fontFamily: 'Tossface', fontSize: 56, lineHeight: 1 }}>🔒</span>
        </div>
        <div className="space-y-1.5">
          <p className="text-xl font-black tracking-tight">로그인이 필요해요</p>
          <p className="text-sm text-muted-foreground font-medium">이 페이지는 로그인한 학생만 볼 수 있어요</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href={pathname.startsWith('/contests') ? `/auth/login?next=${encodeURIComponent(pathname)}` : '/auth/login'}
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

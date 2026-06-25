'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { LoadingSpinner } from './ui/spinner';

const PUBLIC_PATHS = ['/', '/auth/login', '/auth/signup', '/auth/callback', '/contact'];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const blocked = !isLoading && !user && !isPublic;

  useEffect(() => {
    if (blocked) router.replace('/auth/login');
  }, [blocked, router]);

  if (blocked) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size={56} label="로그인 페이지로 이동 중" />
      </div>
    );
  }

  return <>{children}</>;
}

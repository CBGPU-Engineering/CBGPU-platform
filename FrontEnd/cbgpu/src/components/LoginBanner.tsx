'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

export default function LoginBanner() {
  const { user, isLoading } = useAuth();
  if (isLoading || user) return null;

  return (
    <div className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 md:px-6 py-2.5 flex items-center justify-center gap-3 text-xs font-bold flex-wrap text-center">
        <span>로그인하면 자습신청, 시간표, GPU 예약까지 모든 기능을 쓸 수 있어요</span>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/auth/login" className="underline underline-offset-2 hover:opacity-80">로그인</Link>
          <span className="opacity-50">·</span>
          <Link href="/auth/signup" className="underline underline-offset-2 hover:opacity-80">회원가입</Link>
        </div>
      </div>
    </div>
  );
}

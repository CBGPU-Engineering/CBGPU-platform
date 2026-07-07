'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { AlertTriangle } from 'lucide-react';

/** 관리자가 학번/이름이 이상하다고 판단해 is_approved를 false로 내린 계정에게 보여준다.
 * 로그인/열람 자체는 막지 않지만, 예약·서버 배포 같은 핵심 기능은 각 페이지에서
 * useAuth().isApproved로 따로 막는다 — 여기서는 안내만 한다. */
export default function ApprovalNotice() {
  const { user, profile, isLoading } = useAuth();
  if (isLoading || !user || !profile || profile.is_approved !== false) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-center text-xs md:text-sm font-bold text-amber-700 dark:text-amber-400 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
      <AlertTriangle className="size-4 shrink-0" />
      <span>학번 또는 이름 확인이 필요해 일부 기능이 제한됩니다.</span>
      <Link href="/profile" className="underline underline-offset-2 hover:no-underline">
        프로필에서 수정하기
      </Link>
    </div>
  );
}

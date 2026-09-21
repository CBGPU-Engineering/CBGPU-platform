'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-md flex-col items-center justify-center gap-5 text-center" role="alert">
      <div className="space-y-2">
        <h1 className="text-2xl font-black">화면을 불러오지 못했어요</h1>
        <p className="text-sm text-muted-foreground">일시적인 문제일 수 있어요. 다시 시도해 주세요.</p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <button type="button" onClick={reset} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">다시 시도</button>
        <Link href="/" className="rounded-xl border border-border px-5 py-3 text-sm font-bold">홈으로 가기</Link>
      </div>
    </div>
  );
}

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-md flex-col items-center justify-center gap-5 text-center">
      <p className="text-6xl font-black tracking-tight text-primary">404</p>
      <div className="space-y-2">
        <h1 className="text-2xl font-black">페이지를 찾을 수 없어요</h1>
        <p className="text-sm text-muted-foreground">주소가 바뀌었거나 삭제된 페이지일 수 있어요.</p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href="/" className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">홈으로 가기</Link>
        <Link href="/contact" className="rounded-xl border border-border px-5 py-3 text-sm font-bold">문의하기</Link>
      </div>
    </div>
  );
}

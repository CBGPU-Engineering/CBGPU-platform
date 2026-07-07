'use client';

/** media=print로 받다가 로드되면 all로 바꿔치기 — 외부 CSS가 첫 페인트를 막지 않게 한다 */
export default function DeferredStylesheet({ href }: { href: string }) {
  return (
    <>
      <link
        rel="stylesheet"
        href={href}
        media="print"
        onLoad={(e) => { (e.currentTarget as HTMLLinkElement).media = 'all'; }}
      />
      <noscript>
        <link rel="stylesheet" href={href} />
      </noscript>
    </>
  );
}

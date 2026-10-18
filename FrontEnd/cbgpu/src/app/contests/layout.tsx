import type { Metadata } from 'next';

export const metadata: Metadata = { title: '대회 제출', robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }

import type { Metadata } from 'next';

export const metadata: Metadata = { title: '자료 공유' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

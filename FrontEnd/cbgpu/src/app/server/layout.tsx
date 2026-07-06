import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Server Deploy',
  description: 'CPU 서버 배포 및 관리',
};

export default function ServerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '대시보드',
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}

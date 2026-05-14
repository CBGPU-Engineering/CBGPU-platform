import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '프로필',
  robots: { index: false, follow: false },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}

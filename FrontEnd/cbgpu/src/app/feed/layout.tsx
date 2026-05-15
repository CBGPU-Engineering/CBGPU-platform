import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Feed | CBGPU',
  description: 'AI·보안·임베디드 실시간 뉴스와 서비스 장례식.',
};

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return children;
}

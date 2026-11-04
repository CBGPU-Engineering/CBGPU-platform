import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '앱 다운로드',
  description: 'CBGPU 앱으로 시간표, 급식, GPU 예약과 제작 신청을 편리하게 이용하세요.',
  alternates: { canonical: '/download' },
  openGraph: { title: '앱 다운로드 | CBGPU', url: 'https://cbgpu.com/download' },
};

export default function DownloadLayout({ children }: { children: React.ReactNode }) { return children; }

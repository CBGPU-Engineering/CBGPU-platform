import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '문의하기',
  description: 'GPU 예약, 계정 문제, 기술 지원 등 궁금한 점을 남겨주시면 담당자가 이메일로 답변 드립니다.',
  openGraph: {
    title: '문의하기 | CBGPU',
    description: 'GPU 예약, 계정 문제, 기술 지원 등 궁금한 점을 남겨주세요.',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}

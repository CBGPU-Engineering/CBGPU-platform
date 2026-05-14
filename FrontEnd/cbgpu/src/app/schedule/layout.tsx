import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GPU 예약 일정',
  description: '충북과학고등학교 GPU 예약 현황을 캘린더로 확인하세요. GPU 1~4번의 승인된 예약 일정을 날짜별로 조회할 수 있습니다.',
  openGraph: {
    title: 'GPU 예약 일정 | CBGPU',
    description: '충북과학고등학교 GPU 예약 현황을 캘린더로 확인하세요.',
  },
};

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return children;
}

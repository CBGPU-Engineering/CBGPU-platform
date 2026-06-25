import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '자습신청',
};

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-4">
      {children}
    </div>
  );
}

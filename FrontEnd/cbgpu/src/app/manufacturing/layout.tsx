import { Metadata } from 'next';
import ManufacturingNavigation from '@/components/manufacturing/ManufacturingNavigation';

export const metadata: Metadata = {
  title: '제작 (3D 프린팅 · 레이저 커팅)',
};

export default function ManufacturingLayout({ children }: { children: React.ReactNode }) {
  return <><ManufacturingNavigation/>{children}</>;
}

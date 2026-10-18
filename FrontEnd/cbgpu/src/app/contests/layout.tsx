import type { Metadata } from 'next';
import './contests.css';

export const metadata: Metadata = { title: '교내 대회', robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }

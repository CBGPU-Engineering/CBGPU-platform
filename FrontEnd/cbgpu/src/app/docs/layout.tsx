import type { Metadata } from 'next';
import SiteShell from '@/components/publications/SiteShell';
export const metadata: Metadata = { title: {default:'CBGPU Docs',template:'%s | CBGPU Docs'}, description:'CBGPU의 학교생활·자료 공유·GPU·배포·논문·제작·관리 기능 전체 사용 설명서', metadataBase:new URL('https://docs.cbgpu.com') };
export default function Layout({children}:{children:React.ReactNode}) {return <SiteShell site="docs">{children}</SiteShell>;}

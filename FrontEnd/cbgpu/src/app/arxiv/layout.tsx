import type { Metadata } from 'next';
import SiteShell from '@/components/publications/SiteShell';
export const metadata:Metadata={title:{default:'CBGPU arXiv — 학교 연구 프리프린트',template:'%s | CBGPU arXiv'},description:'학교 연구 프리프린트를 읽고 공유하는 CBGPU 공개 저장소',metadataBase:new URL('https://arxiv.cbgpu.com')};
export default function Layout({children}:{children:React.ReactNode}){return <SiteShell site="arxiv">{children}</SiteShell>;}

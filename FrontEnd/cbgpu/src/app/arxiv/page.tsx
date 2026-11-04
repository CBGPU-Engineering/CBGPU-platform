import {Suspense} from 'react';
import { publicationHref } from '@/components/publications/SiteShell';
import PaperIndex from '@/components/publications/PaperIndex';
export const metadata={alternates:{canonical:'https://arxiv.cbgpu.com'}};
export default async function Page(){return <Suspense fallback={<p>연구 목록을 불러오는 중…</p>}><PaperIndex base={await publicationHref('arxiv')}/></Suspense>;}

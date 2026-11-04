import { publicationHref } from '@/components/publications/SiteShell';
import SubmitPaper from '@/components/publications/SubmitPaper';
export const metadata={title:'연구 제출',alternates:{canonical:'https://arxiv.cbgpu.com/submit'},robots:{index:false,follow:true}};
export default async function Page(){return <SubmitPaper base={await publicationHref('arxiv')}/>;}

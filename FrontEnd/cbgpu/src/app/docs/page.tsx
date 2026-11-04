import DocsIndex from '@/components/publications/DocsIndex';
import {publicationHref} from '@/components/publications/SiteShell';
export const metadata={alternates:{canonical:'https://docs.cbgpu.com'}};
export default async function Page(){const home=await publicationHref('docs');return <DocsIndex base={home==='/'?'':home}/>}

import { getPublicPaper } from '@/lib/preprintsServer';
import { publicationHref } from '@/components/publications/SiteShell';
import PaperDetail from '@/components/publications/PaperDetail';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){
 const {id}=await params;let paper;try{paper=await getPublicPaper(id)}catch{}
 const url=`https://arxiv.cbgpu.com/${encodeURIComponent(id)}`;
 if(!paper)return {title:'연구 원고',alternates:{canonical:url},robots:{index:false}};
 const authors=Array.isArray(paper.authors)?paper.authors as {name:string}[]:[];
 return {title:paper.title,description:paper.abstract.slice(0,200),alternates:{canonical:url},openGraph:{title:paper.title,description:paper.abstract.slice(0,200),url,type:'article' as const},other:{citation_title:paper.title,citation_author:authors.map(a=>a.name),citation_publication_date:paper.published_at?.slice(0,10).replaceAll('-','/')||'',citation_pdf_url:`https://arxiv.cbgpu.com/api/arxiv/papers/${id}/pdf`,citation_abstract_html_url:url},robots:{index:paper.status==='published',follow:true}};
}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PaperDetail id={id} base={await publicationHref('arxiv')}/>;}

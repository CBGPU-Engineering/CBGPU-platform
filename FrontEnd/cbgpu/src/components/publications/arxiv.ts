export const categories=[{value:'math',label:'수학'},{value:'physics',label:'물리'},{value:'chemistry',label:'화학'},{value:'biology',label:'생물'},{value:'computer-science',label:'컴퓨터과학'},{value:'engineering',label:'공학'},{value:'other',label:'기타'}];
export type Paper={id:string;identifier:string;title:string;abstract:string;authors:{name:string;affiliation?:string}[];category:string;published_at:string;current_version:number;license:string;status:string};
export type Version={version:number;created_at:string;notes?:string;pdf_size?:number};
export function arxivHref(path='',base='/arxiv'){return `${base==='/'?'':base}${path}`||'/';}
export function categoryLabel(value:string){return categories.find(c=>c.value===value)?.label||value;}
export function dateLabel(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?'게시일 미정':d.toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});}
export async function jsonResponse(response:Response){const data=await response.json();if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:typeof data.message==='string'?data.message:'요청을 처리하지 못했습니다. 다시 시도해 주세요.');return data;}

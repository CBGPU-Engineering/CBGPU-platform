import {NextRequest,NextResponse} from 'next/server';
import crypto from 'node:crypto';
import {preprintsClient,paperFields,publicationUser} from '@/lib/preprintsServer';
import {WindowRateLimiter} from '@/lib/requestSecurity';
const uploadLimits=new WindowRateLimiter(6,3600_000),readLimits=new WindowRateLimiter(120,60_000);
const categories=new Set(['math','physics','chemistry','biology','computer-science','engineering','other']);
const licenses=new Set(['all-rights-reserved','cc-by-4.0']);let uploads=0;
const error=(message:string,status=400)=>NextResponse.json({message},{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:NextRequest){
 if(!readLimits.allow(request.headers.get('cf-connecting-ip')||'local'))return error('잠시 후 다시 시도해 주세요.',429);
 const query=request.nextUrl.searchParams,q=(query.get('q')||'').trim().slice(0,200),category=query.get('category')||'',page=Number(query.get('page')||1),sort=query.get('sort')||'newest';
 if(!Number.isSafeInteger(page)||page<1||page>10000||!['newest','oldest','title'].includes(sort)||category&&!categories.has(category))return error('검색 조건을 확인해 주세요.');
 try{let list=preprintsClient().from('preprints').select(paperFields,{count:'exact'}).eq('status','published');if(category)list=list.eq('category',category);if(q)list=list.ilike('search_text','%'+q.replace(/[\\%_]/g,'\\$&')+'%');
  const {data,count,error:e}=await list.order(sort==='title'?'title':'published_at',{ascending:sort!=='newest'}).order('id',{ascending:true}).range((page-1)*12,page*12-1);if(e)return error('연구 원고 목록을 불러오지 못했습니다.',503);
  return NextResponse.json({papers:data||[],total:count||0,page,page_size:12},{headers:{'Cache-Control':'public, max-age=15'}});
 }catch{return error('연구 원고 서비스를 사용할 수 없습니다.',503)}
}
async function formDataBounded(request:NextRequest){
 const maximum=20*1024*1024+128*1024;if(Number(request.headers.get('content-length'))>maximum)throw new Error('TOO_LARGE');
 const reader=request.body?.getReader();if(!reader)throw new Error('BAD_FORM');let size=0;const parts:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum){await reader.cancel();throw new Error('TOO_LARGE')}parts.push(value)}
 const body=Buffer.concat(parts);return new Request('http://localhost/upload',{method:'POST',headers:{'content-type':request.headers.get('content-type')||''},body}).formData();
}
export async function POST(request:NextRequest){
 let user;try{user=await publicationUser(request)}catch{return error('로그인 정보를 확인할 수 없습니다.',503)}if(!user)return error('CBGPU 계정으로 로그인해 주세요.',401);
 if(!uploadLimits.allow(user.id)||uploads>=2)return error('업로드 요청이 많습니다. 잠시 후 다시 시도해 주세요.',429);uploads++;
 let uploaded:string|null=null;const client=preprintsClient();
 try{
  const form=await formDataBounded(request),title=String(form.get('title')||'').trim(),abstract=String(form.get('abstract')||'').trim(),category=String(form.get('category')||''),license=String(form.get('license')||'all-rights-reserved'),notes=String(form.get('notes')||'').trim();
  if(title.length<5||title.length>300||abstract.length<30||abstract.length>12000||notes.length>4000||!categories.has(category)||!licenses.has(license))return error('제목, 초록, 분야를 확인해 주세요.');
  let authors:unknown;try{authors=JSON.parse(String(form.get('authors')||'[]'))}catch{return error('저자 정보를 확인해 주세요.')}
  if(!Array.isArray(authors)||!authors.length||authors.length>20)return error('저자는 1명에서 20명까지 입력할 수 있습니다.');
  const cleanAuthors:{name:string;affiliation:string}[]=[];for(const a of authors){if(!a||typeof a!=='object'||typeof a.name!=='string'||!a.name.trim()||a.name.length>100||a.affiliation!==undefined&&typeof a.affiliation!=='string'||String(a.affiliation||'').length>200)return error('저자 이름과 소속을 확인해 주세요.');cleanAuthors.push({name:a.name.trim(),affiliation:String(a.affiliation||'').trim()})}
  const pdf=form.get('pdf');if(!(pdf instanceof File)||pdf.size<5||pdf.size>20*1024*1024||!pdf.name.toLowerCase().endsWith('.pdf'))return error('20 MB 이하의 PDF 파일을 선택해 주세요.');
  const bytes=Buffer.from(await pdf.arrayBuffer());if(bytes.subarray(0,5).toString()!=='%PDF-')return error('올바른 PDF 파일이 아닙니다.');
  const id=crypto.randomUUID(),pdfPath=user.id+'/'+id+'/v1.pdf';const stored=await client.storage.from('preprints').upload(pdfPath,bytes,{contentType:'application/pdf',upsert:false});if(stored.error)return error('PDF 파일을 저장하지 못했습니다.',503);uploaded=pdfPath;
  const result=await client.rpc('publish_preprint',{p_id:id,p_owner_id:user.id,p_title:title,p_abstract:abstract,p_authors:cleanAuthors,p_category:category,p_license:license,p_pdf_path:pdfPath,p_pdf_size:bytes.length,p_pdf_sha256:crypto.createHash('sha256').update(bytes).digest('hex'),p_notes:notes});
  if(result.error){await client.storage.from('preprints').remove([pdfPath]);uploaded=null;return error(result.error.message.includes('PUBLICATION_DAILY_LIMIT')?'하루에 원고를 최대 5편까지 게시할 수 있습니다.':'원고를 게시하지 못했습니다. 다시 시도해 주세요.',result.error.message.includes('PUBLICATION_DAILY_LIMIT')?429:503)}
  uploaded=null;return NextResponse.json({paper:result.data},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(e){if(uploaded)await client.storage.from('preprints').remove([uploaded]);return error(e instanceof Error&&e.message==='TOO_LARGE'?'20 MB 이하의 PDF 파일을 선택해 주세요.':'업로드 내용을 확인해 주세요.',e instanceof Error&&e.message==='TOO_LARGE'?413:400)}finally{uploads--}
}

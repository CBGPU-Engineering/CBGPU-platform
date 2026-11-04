import 'server-only';
import { createClient } from '@supabase/supabase-js';
export const paperFields='id,identifier,title,abstract,authors,category,published_at,current_version,license,status';
export function preprintsClient(){
 const url=process.env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:54321';const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key)throw new Error('Publication service is unavailable');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function getPublicPaper(id:string){
 if(!/^[a-f0-9-]{36}$/i.test(id))return null;
 const {data,error}=await preprintsClient().from('preprints').select(paperFields).eq('id',id).in('status',['published','withdrawn']).maybeSingle();
 if(error)throw new Error('Publication service is unavailable');return data;
}
export async function publicationUser(request:Request){
 const token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];if(!token)return null;
 const client=preprintsClient();const {data,error}=await client.auth.getUser(token);if(error||!data.user||(data.user as unknown as {deleted_at?:string}).deleted_at)return null;
 const {data:profile}=await client.from('profiles').select('id,is_approved').eq('id',data.user.id).maybeSingle();if(!profile||profile.is_approved===false)return null;
 return data.user;
}

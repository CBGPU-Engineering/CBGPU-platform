import {NextRequest,NextResponse} from 'next/server';
import {publicationUser,preprintsClient} from '@/lib/preprintsServer';
import {activeDeploymentSession} from '@/lib/deployAuth';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 try{
  const host=request.headers.get('x-cbgpu-public-host')||request.headers.get('host')?.split(':')[0];if(!['manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'].includes(host||''))return NextResponse.json({error:'Not found'},{status:404});
  const user=await publicationUser(request);if(!user||!await activeDeploymentSession(request,user.id))return NextResponse.json({error:'Please sign in.'},{status:401});
  const client=preprintsClient();const [profile,printers]=await Promise.all([client.from('profiles').select('is_approved,is_laser_cut_manager').eq('id',user.id).single(),client.from('printer_managers').select('printer_id').eq('user_id',user.id)]);
  if(profile.error||printers.error)throw Error('Role lookup failed');
  if(profile.data.is_approved===false)return NextResponse.json({error:'Your account requires approval.'},{status:403});
  const print=!!printers.data.length,laser=profile.data.is_laser_cut_manager===true;
  if(!print&&!laser||host==='print.cbgpu.com'&&!print||host==='laser.cbgpu.com'&&!laser)return NextResponse.json({error:'This workspace is restricted to assigned equipment managers.'},{status:403});
  return NextResponse.json({print:host==='laser.cbgpu.com'?false:print,laser:host==='print.cbgpu.com'?false:laser,printer_ids:printers.data.map(p=>p.printer_id)},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Could not verify equipment permissions. Please try again.'},{status:503})}
}

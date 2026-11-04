import {savedSchoolToken,rememberSchoolConnection,forgetSchoolConnection} from '@/lib/edusetStudentStore';
import {publicationUser} from '@/lib/preprintsServer';
import {activeDeploymentSession} from '@/lib/deployAuth';
import {WindowRateLimiter} from '@/lib/requestSecurity';
import {handleStudentStudy,StudyFailure} from '@/lib/edusetStudent';
export const runtime='nodejs';
const limits=new WindowRateLimiter(40,60_000);
import {sendSchoolStudent as send} from '@/lib/edusetStudentClient';
async function handle(request:Request){return handleStudentStudy(request,{authorize:async req=>{const user=await publicationUser(req);return user&&await activeDeploymentSession(req,user.id)?user.id:null},send,limit:key=>limits.allow(key),getConnection:savedSchoolToken,remember:rememberSchoolConnection,disconnect:forgetSchoolConnection})}
export const GET=handle;
export const POST=handle;

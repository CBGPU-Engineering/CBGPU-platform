import {publicationUser} from '@/lib/preprintsServer';
import {activeDeploymentSession} from '@/lib/deployAuth';
import {WindowRateLimiter} from '@/lib/requestSecurity';
import {verifyStudyStudent} from '@/lib/edusetStudent';
import {sendSchoolStudent} from '@/lib/edusetStudentClient';
import {createStudyLinkHandler} from '@/lib/edusetStudyLink';
export const runtime='nodejs';
const limits=new WindowRateLimiter(120,60_000);
export const POST=createStudyLinkHandler({authorize:async request=>{const user=await publicationUser(request);return user&&await activeDeploymentSession(request,user.id)?user.id:null},verify:token=>verifyStudyStudent(sendSchoolStudent,token),limit:key=>limits.allow(key)});

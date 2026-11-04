import 'server-only';
import {preprintsClient} from './preprintsServer';
import {encryptToken,decryptToken} from './edusetTokenCrypto';
import {StudyFailure,type StudyStudent} from './edusetStudent';
export async function forgetSchoolConnection(owner:string){
 const {error}=await preprintsClient().from('eduset_student_connections').delete().eq('user_id',owner);
 if(error)throw new StudyFailure('학교 계정 연결을 해제하지 못했습니다.',503);
}
export async function savedSchoolToken(owner:string):Promise<string|null>{
 const {data,error}=await preprintsClient().from('eduset_student_connections').select('student_id,token_enc,expires_at').eq('user_id',owner).maybeSingle();
 if(error)throw new StudyFailure('저장된 학교 연결을 확인하지 못했습니다.',503);
 if(!data)return null;
 if(new Date(data.expires_at).getTime()<=Date.now()){await forgetSchoolConnection(owner);return null}
 try{const value=JSON.parse(decryptToken(data.token_enc));if(value.scope!=='personal-student-v1'||value.owner!==owner||String(value.studentId)!==data.student_id||typeof value.accessToken!=='string')throw Error();return value.accessToken}catch{await forgetSchoolConnection(owner);return null}
}
export async function rememberSchoolConnection(owner:string,accessToken:string,student:StudyStudent){
 let exp:number;try{exp=JSON.parse(Buffer.from(accessToken.split('.')[1],'base64url').toString()).exp}catch{throw new StudyFailure('학교 세션 만료 시각을 확인하지 못했습니다.',400)}
 if(typeof exp!=='number'||!Number.isFinite(exp)||exp*1000<=Date.now()+30000)throw new StudyFailure('학교 로그인을 다시 진행해 주세요.',401);
 const token_enc=encryptToken(JSON.stringify({scope:'personal-student-v1',owner,studentId:student.id,accessToken}));
 const {error}=await preprintsClient().from('eduset_student_connections').upsert({user_id:owner,student_id:String(student.id),token_enc,expires_at:new Date(exp*1000).toISOString(),connected_at:new Date().toISOString()});
 if(error)throw new StudyFailure('학교 연결을 저장하지 못했습니다.',503);
}

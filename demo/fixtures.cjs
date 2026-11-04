// Synthetic data only. No values here authenticate with a real service.
const users=[
 {id:'00000000-0000-4000-8000-000000000101',email:'student@example.invalid',name:'Demo Student',student_id:'2301'},
 {id:'00000000-0000-4000-8000-000000000102',email:'researcher@example.invalid',name:'Demo Researcher',student_id:'2302'},
];
const password='demo-only';
function session(user){const exp=Math.floor(Date.now()/1000)+3600;return {access_token:Buffer.from(JSON.stringify({alg:'DEMO',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp,role:'authenticated',aud:'authenticated'})).toString('base64url')+'.local-demo-only',refresh_token:'demo-refresh-'+user.id,expires_in:3600,expires_at:exp,token_type:'bearer',user:{id:user.id,email:user.email,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{full_name:user.name},created_at:'2026-01-01T00:00:00Z'}}}
const schoolToken='demo.'+Buffer.from(JSON.stringify({userId:'demo-school-student',exp:4102444800})).toString('base64url')+'.not-a-real-signature';
function tables(){return {
 profiles:users.map(u=>({id:u.id,email:u.email,full_name:u.name,student_id:u.student_id,is_admin:false,is_approved:true,is_3d_print_manager:false,is_laser_cut_manager:false})),
 gpu_endpoints:[1,2,3,4].map(gpu_id=>({gpu_id,public_url:'https://gpu.cbgpu.com/'+gpu_id+'/',internal_host:'127.0.0.1',internal_port:8000+gpu_id})),
 gpu_reservations:[],printer_managers:[],site_settings:[],site_banners:[],notifications:[],
 research_notes:[],shared_materials:[{id:'00000000-0000-4000-8000-000000000201',title:'Demo research handout',description:'Synthetic metadata. No uploaded student files.',tags:['demo'],user_id:users[1].id,is_public:true,created_at:'2026-11-03T00:00:00Z'}],
 }}
module.exports={users,password,session,schoolToken,tables};

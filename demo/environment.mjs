export function demoEnvironment(source=process.env){
 const safeKeys=['PATH','HOME','USER','LANG','TMPDIR','TEMP','TMP','SYSTEMROOT','COMSPEC','USERPROFILE','LOCALAPPDATA'];
 return {...Object.fromEntries(safeKeys.filter(key=>source[key]).map(key=>[key,source[key]])),CBGPU_DEMO:'1',NEXT_PUBLIC_CBGPU_DEMO:'1',NEXT_PUBLIC_SUPABASE_URL:'http://localhost:3100/backend',NEXT_PUBLIC_SUPABASE_ANON_KEY:'demo-public-key-no-real-access',NEXT_BUILD_DIR:'.next-demo',SUPABASE_INTERNAL_URL:'http://127.0.0.1:54329',SUPABASE_SERVICE_ROLE_KEY:'demo-only-not-a-real-key',EDUSET_TOKEN_SECRET:'demo-only-not-for-production',NEXT_TELEMETRY_DISABLED:'1'};
}

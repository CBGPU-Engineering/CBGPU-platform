/// Base URL for the app's server-side backend calls (meal, timetable, school
/// news, tech news, GPU status, contact, account deletion, the eduset proxy).
/// These are Supabase Edge Functions, not the Next.js app: cbgpu.vercel.app
/// is becoming a landing/download page only, so nothing the Flutter app
/// needs to keep running can depend on it staying up or reachable from a
/// browser (CORS on a Vercel deployment is a deploy-and-hope story; a
/// Supabase Edge Function is part of the same backend the app already talks
/// to for auth/data, and ships its CORS headers with the function itself).
/// Each route was ported line-for-line from the equivalent Next.js API route
/// into `supabase/functions/*/index.ts` — see that folder for the actual
/// implementations.
class ApiConfig {
  static const functionsUrl = 'https://fclbzjlcepoaifvcoxdw.supabase.co/functions/v1';
}

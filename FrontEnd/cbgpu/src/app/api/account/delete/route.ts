import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getRequestingUserId(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

// Deletes the caller's own account. Only ever operates on the id resolved
// from the caller's own bearer token — never a body-supplied id — so this
// route can't be used to delete someone else's account.
export async function POST(request: NextRequest) {
  if (!serviceRoleKey) {
    return NextResponse.json(
      { message: '서버에 SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되어 있지 않습니다.' },
      { status: 500 }
    );
  }

  const userId = await getRequestingUserId(request);
  if (!userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Scrub identifying profile fields first. Other tables (print_jobs,
  // laser_jobs, server requests, poll votes, ...) keep referencing this
  // user_id for record-keeping, but nothing there depends on the profile
  // row's contents beyond its existence.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ full_name: null, student_id: null, avatar_url: null, is_approved: false })
    .eq('id', userId);
  if (profileError) {
    return NextResponse.json({ message: '프로필 삭제 실패: ' + profileError.message }, { status: 500 });
  }

  // Soft delete: disables login and scrambles the email, but keeps the
  // auth.users row intact so foreign keys from unrelated tables (which
  // aren't set up to cascade) don't block the deletion.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId, true);
  if (deleteError) {
    return NextResponse.json({ message: '계정 삭제 실패: ' + deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

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

/**
 * Admin-triggered deletion of *another* account — the self-service
 * counterpart (src/app/api/account/delete) deliberately only ever
 * operates on the caller's own id, so this is a separate route rather
 * than that one plus a body-supplied id. Same soft-delete behavior: scrub
 * the profile, then disable login (auth.users row and everything that
 * references its id by foreign key stay intact).
 */
export async function POST(request: NextRequest) {
  if (!serviceRoleKey) {
    return NextResponse.json(
      { message: '서버에 SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되어 있지 않습니다.' },
      { status: 500 }
    );
  }

  const requesterId = await getRequestingUserId(request);
  if (!requesterId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: requesterProfile, error: requesterError } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', requesterId)
    .maybeSingle();
  if (requesterError || !requesterProfile?.is_admin) {
    return NextResponse.json({ message: '관리자만 사용할 수 있습니다.' }, { status: 403 });
  }

  const { userId } = await request.json().catch(() => ({ userId: undefined }));
  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ message: 'userId가 필요합니다.' }, { status: 400 });
  }
  if (userId === requesterId) {
    return NextResponse.json({ message: '본인 계정은 프로필 페이지에서 삭제해주세요.' }, { status: 400 });
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ full_name: null, student_id: null, avatar_url: null, is_approved: false })
    .eq('id', userId);
  if (profileError) {
    return NextResponse.json({ message: '프로필 삭제 실패: ' + profileError.message }, { status: 500 });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId, true);
  if (deleteError) {
    return NextResponse.json({ message: '계정 삭제 실패: ' + deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

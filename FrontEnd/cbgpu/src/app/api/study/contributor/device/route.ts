import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  const client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  const { data: profile } = await client.from('profiles').select('is_approved').eq('id', user.id).single();
  if (profile?.is_approved === false) {
    return NextResponse.json({ message: '승인된 CBGPU 계정만 참여할 수 있습니다.' }, { status: 403 });
  }

  const deviceKey = `cbgpu_${crypto.randomBytes(32).toString('base64url')}`;
  const keyHash = crypto.createHash('sha256').update(deviceKey).digest('hex');
  const body = await request.json().catch(() => ({}));
  const name = String(body?.name ?? 'Chrome 확장 프로그램').trim().slice(0, 80) || 'Chrome 확장 프로그램';

  const { error: joinError } = await client.from('eduset_contributors')
    .upsert({ user_id: user.id, enabled: true }, { onConflict: 'user_id' });
  if (joinError) return NextResponse.json({ message: joinError.message }, { status: 500 });

  const { error } = await client.from('eduset_contributor_devices').insert({ user_id: user.id, key_hash: keyHash, name });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ deviceKey });
}

import { emailSender, SITE_URL, renderEmail } from '@/lib/email';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;
const labels = { confirmed: '참가 확정', pending: '승인 대기', waitlisted: '대기 명단', declined: '승인 거절', cancelled: '신청 취소' } as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { ids?: unknown; status?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string').slice(0, 200) : [];
  const status = String(body.status) as keyof typeof labels;
  if (!ids.length || !(status in labels)) return NextResponse.json({ error: '변경할 참가자와 상태를 확인해 주세요.' }, { status: 400 });
  const { id } = await params;
  const client = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await client.from('event_registrations').update({ status }).eq('contest_id', id).in('id', ids).select('user_id');
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  if (!serviceKey || !resendKey || !data?.length) return NextResponse.json({ ok: true, changed: data?.length || 0, emailed: 0 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: contest } = await admin.from('contests').select('title').eq('id', id).maybeSingle();
  const emails = (await Promise.all(data.map(async row => (await admin.auth.admin.getUserById(row.user_id)).data.user?.email))).filter((email): email is string => !!email);
  const resend = new Resend(resendKey); let sent = 0;
  for (let index = 0; index < emails.length; index += 100) {
    const batch = emails.slice(index, index + 100).map(email => ({ from: emailSender(), to: email, subject: `[${contest?.title || '교내 대회'}] ${labels[status]}`, html: renderEmail({ title: labels[status], preview: `[${contest?.title || '교내 대회'}] ${labels[status]}`, description: (contest?.title || '교내 대회') + ' 신청 상태가 ' + labels[status] + ' 상태로 변경되었어요.', buttonLabel: '행사 페이지에서 확인하기', buttonUrl: SITE_URL + '/contests/' + encodeURIComponent(id) }) }));
    const { error: emailError } = await resend.batch.send(batch); if (emailError) break; sent += batch.length;
  }
  return NextResponse.json({ ok: true, changed: data.length, emailed: sent });
}

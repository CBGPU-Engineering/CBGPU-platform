import { emailSender, SITE_URL, renderEmail } from '@/lib/email';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;
const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  const auth = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: { user } } = await auth.auth.getUser(token);
  if (!user) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { title?: unknown; content?: unknown; audience?: unknown };
  const title = typeof body.title === 'string' ? body.title.trim() : ''; const content = typeof body.content === 'string' ? body.content.trim() : '';
  const audience = ['all','confirmed','pending','waitlisted'].includes(String(body.audience)) ? String(body.audience) as 'all' | 'confirmed' | 'pending' | 'waitlisted' : 'all';
  if (!title || title.length > 150 || !content || content.length > 10000) return NextResponse.json({ error: '공지 제목과 내용을 확인해 주세요.' }, { status: 400 });

  const client = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const [{ data: contest }, { data: host }] = await Promise.all([
    client.from('contests').select('id,title,host_id').eq('id', id).maybeSingle(),
    client.from('event_hosts').select('role').eq('contest_id', id).eq('user_id', user.id).maybeSingle(),
  ]);
  if (!contest || (contest.host_id !== user.id && host?.role !== 'manager')) return NextResponse.json({ error: '행사 공지 권한이 없어요.' }, { status: 403 });

  const { error: insertError } = await client.from('event_announcements').insert({ contest_id: id, author_id: user.id, title, content, audience });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  if (!serviceKey || !resendKey) return NextResponse.json({ ok: true, emailed: 0, warning: '사이트 공지를 게시했어요. 서버 이메일 설정이 없어 메일은 생략했어요.' });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let registrations = admin.from('event_registrations').select('user_id').eq('contest_id', id).not('status', 'in', '(cancelled,declined)');
  if (audience !== 'all') registrations = registrations.eq('status', audience);
  const { data: recipients, error: recipientsError } = await registrations;
  if (recipientsError) return NextResponse.json({ ok: true, emailed: 0, warning: '사이트 공지는 게시했지만 수신자 목록을 불러오지 못했어요.' });
  const emails = (await Promise.all((recipients || []).map(async recipient => (await admin.auth.admin.getUserById(recipient.user_id)).data.user?.email))).filter((email): email is string => !!email);
  const resend = new Resend(resendKey); let sent = 0;
  for (let index = 0; index < emails.length; index += 100) {
    const batch = emails.slice(index, index + 100).map(email => ({ from: emailSender(), to: email, subject: `[${contest.title}] ${title}`, html: renderEmail({ title, preview: `[${contest.title}] ${title}`, description: contest.title + '의 새 공지입니다.', bodyHtml: `<div style="white-space:pre-wrap;line-height:1.8;font-size:15px;color:#374151;">${esc(content)}</div>`, buttonLabel: '행사 페이지 열기', buttonUrl: SITE_URL + '/contests/' + encodeURIComponent(id) }) }));
    const { error } = await resend.batch.send(batch);
    if (error) return NextResponse.json({ ok: true, emailed: sent, warning: `사이트 공지는 게시했지만 일부 이메일 발송에 실패했어요: ${error.message}` });
    sent += batch.length;
  }
  return NextResponse.json({ ok: true, emailed: sent });
}

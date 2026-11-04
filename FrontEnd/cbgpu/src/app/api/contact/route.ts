import { emailSender, SUPPORT_EMAIL, renderEmail } from '@/lib/email';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { WindowRateLimiter, readJsonBody, RequestBodyError } from '@/lib/requestSecurity';

const resend = new Resend(process.env.RESEND_API_KEY);

const RECIPIENTS = [SUPPORT_EMAIL];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escHtml(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const rateLimit = new WindowRateLimiter(5, 10 * 60 * 1000);

export async function POST(req: NextRequest) {
  const ip = req.headers.get('cf-connecting-ip') || 'local';
  if (!rateLimit.allow(ip)) {
    return NextResponse.json({ error: '잠시 후 다시 시도해 주세요.' }, { status: 429 });
  }

  let body: unknown;
  try { body = await readJsonBody(req, 24_000); } catch (error) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: error instanceof RequestBodyError ? error.status : 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });
  }
  const { name, email, category, message } = body as Record<string, unknown>;

  if (!name || !email || !message || typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
    return NextResponse.json({ error: '필수 항목을 입력해 주세요.' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254 || /[\r\n]/.test(email + name) || (category !== undefined && typeof category !== 'string') || name.length > 100 || message.length > 5000 || (category && String(category).length > 50)) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });
  }

  try {
  const { error } = await resend.emails.send({
    from: emailSender(),
    to: RECIPIENTS,
    replyTo: email,
    subject: `[CBGPU 문의] ${category ? `[${escHtml(String(category))}] ` : ''}${escHtml(name)}`,
    text: `CBGPU 문의\n이름: ${name}\n이메일: ${email}\n분류: ${category || '기타'}\n\n${message}`,
    html: renderEmail({
      title: '새 문의가 도착했어요',
      preview: 'CBGPU 문의: ' + String(category || '기타'),
      description: '웹사이트에서 접수된 문의입니다. 아래 내용을 확인하고 문의자에게 답변해 주세요.',
      bodyHtml: `<table role="presentation" width="100%" style="font-size:14px;line-height:1.8;border-collapse:collapse;"><tr><td style="padding:8px 0;color:#6b7280;width:70px;">이름</td><td>${escHtml(name)}</td></tr><tr><td style="padding:8px 0;color:#6b7280;">이메일</td><td>${escHtml(email)}</td></tr><tr><td style="padding:8px 0;color:#6b7280;">분류</td><td>${escHtml(String(category || '기타'))}</td></tr></table><div style="padding:18px;margin-top:18px;border:1px solid #e4e7ec;border-radius:12px;background:#f8faff;white-space:pre-wrap;font-size:14px;line-height:1.8;overflow-wrap:anywhere;">${escHtml(message)}</div>`,
      buttonLabel: '문의자에게 답장하기',
      buttonUrl: 'mailto:' + encodeURIComponent(email),
      note: '이 메일에 바로 답장해도 문의자에게 전달됩니다.',
    }),
  });

  if (error) {
    return NextResponse.json({ error: '문의 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '문의 전송에 실패했습니다.' }, { status: 502 });
  }
}

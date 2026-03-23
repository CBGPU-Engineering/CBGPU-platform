import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const RECIPIENTS = ['lmw.hpc@gmail.com', 'ahn.hyunjun2009@gmail.com'];

export async function POST(req: NextRequest) {
  const { name, email, category, message } = await req.json();

  if (!name || !email || !message) {
    return NextResponse.json({ error: '필수 항목을 입력해 주세요.' }, { status: 400 });
  }

  const { error } = await resend.emails.send({
    from: 'CBGPU <noreply-cbgpu@airhood.dev>',
    to: RECIPIENTS,
    replyTo: email,
    subject: `[CBGPU 문의] ${category ? `[${category}] ` : ''}${name}`,
    html: `
      <div style="font-family: monospace; max-width: 600px; margin: 0 auto; padding: 24px; border: 2px solid #e5e7eb; border-radius: 12px;">
        <h2 style="font-size: 20px; font-weight: 900; letter-spacing: -0.5px; margin: 0 0 20px;">CBGPU 문의</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 0; font-weight: 700; color: #6b7280; width: 80px;">이름</td>
            <td style="padding: 10px 0; font-weight: 600;">${name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 0; font-weight: 700; color: #6b7280;">이메일</td>
            <td style="padding: 10px 0; font-weight: 600;">${email}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 0; font-weight: 700; color: #6b7280;">분류</td>
            <td style="padding: 10px 0; font-weight: 600;">${category || '기타'}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; font-weight: 700; color: #6b7280; vertical-align: top;">내용</td>
            <td style="padding: 10px 0; font-weight: 600; white-space: pre-wrap;">${message}</td>
          </tr>
        </table>
      </div>
    `,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

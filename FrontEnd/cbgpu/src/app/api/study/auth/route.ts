import { NextResponse } from 'next/server';

const BASE_URL = 'https://api.cbsh.edu-set.com';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id ?? '').trim();
    const password = String(body?.password ?? '').trim();
    const turnstileResponse = String(body?.turnstileResponse ?? '').trim();

    const username = process.env.EDUSET_USERNAME?.trim() || id;
    const secret = process.env.EDUSET_PASSWORD?.trim() || password;

    if (!username || !secret) {
      return NextResponse.json(
        {
          message: '서버에 EDUSET_USERNAME, EDUSET_PASSWORD 환경 변수를 설정해 주세요.',
        },
        { status: 400 }
      );
    }

    const payload = {
      username,
      password: secret,
      turnstileResponse: turnstileResponse || undefined,
    };

    const response = await fetch(`${BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(turnstileResponse ? { 'X-Turnstile-Response': turnstileResponse } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          message: data?.message ?? '토큰 발급에 실패했습니다.',
          statusCode: response.status,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ accessToken: data?.accessToken ?? null });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? '토큰 발급 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

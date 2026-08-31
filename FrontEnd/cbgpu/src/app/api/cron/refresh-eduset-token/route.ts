import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { encryptToken } from '@/lib/edusetTokenCrypto';

export const runtime = 'nodejs';
export const maxDuration = 60;

const EDUSET_BASE_URL = 'https://api.cbsh.edu-set.com';
const EDUSET_SIGNIN_URL = 'https://cbsh.edu-set.com/signin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * 관리자가 매번 수동으로 로그인 → devtools에서 accessToken 복사 → /admin/study에 붙여넣던
 * 걸 대신해준다. 실제 사람이 하는 것과 똑같이 로그인 폼에 입력하고 제출할 뿐 —
 * Turnstile을 우회/조작하려는 시도는 전혀 없다. 이 학교 사이트의 Turnstile이
 * managed(비대화형) 모드라 실제 브라우저 세션이면 자동으로 통과되는 경우에만 동작하고,
 * 만약 사람이 직접 눌러야 하는 챌린지가 뜨면 그냥 타임아웃으로 실패한다 — 그럴 땐
 * /admin/study에서 여전히 수동으로 등록해야 한다.
 */
async function loginAndGetToken(): Promise<string> {
  const username = process.env.EDUSET_USERNAME;
  const password = process.env.EDUSET_PASSWORD;
  if (!username || !password) {
    throw new Error('EDUSET_USERNAME/EDUSET_PASSWORD 환경 변수가 설정되어 있지 않습니다.');
  }

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.goto(EDUSET_SIGNIN_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });

    await page.waitForSelector('input[name="id"]', { timeout: 15000 });
    await page.type('input[name="id"]', username);
    await page.type('input[name="password"]', password);

    // Turnstile이 스스로(사람 개입 없이) 완료되면 이 hidden input에 값이 채워진다.
    // managed 모드에서 실제 브라우저 신호를 감지하면 자동으로 통과되는데, 만약 대화형
    // 챌린지가 필요하면 아무것도 채워지지 않고 여기서 타임아웃난다 — 정상적인 실패다.
    await page.waitForFunction(
      () => {
        const el = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
        return !!el?.value;
      },
      { timeout: 20000 }
    );

    await page.click('button[type="submit"]');

    await page.waitForFunction(() => !!localStorage.getItem('accessToken'), { timeout: 15000 });
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    if (!accessToken) throw new Error('로그인 후에도 accessToken을 찾지 못했습니다.');
    return accessToken;
  } finally {
    await browser.close();
  }
}

async function handleRefresh(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ message: 'CRON_SECRET 환경 변수가 설정되어 있지 않습니다.' }, { status: 500 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: '인증 실패' }, { status: 401 });
  }

  if (!serviceRoleKey) {
    return NextResponse.json({ message: 'SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되어 있지 않습니다.' }, { status: 500 });
  }

  let accessToken: string;
  try {
    accessToken = await loginAndGetToken();
  } catch (err: any) {
    return NextResponse.json(
      { message: '자동 로그인 실패 (Turnstile이 사람 개입을 요구했을 수 있습니다) — /admin/study에서 수동 등록이 필요합니다: ' + (err?.message ?? String(err)) },
      { status: 502 }
    );
  }

  const verify = await fetch(`${EDUSET_BASE_URL}/rooms`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!verify.ok) {
    return NextResponse.json({ message: '발급받은 토큰이 유효하지 않습니다.' }, { status: 502 });
  }

  let encrypted: string;
  try {
    encrypted = encryptToken(accessToken);
  } catch (err: any) {
    return NextResponse.json({ message: err?.message ?? '토큰 암호화에 실패했습니다.' }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin
    .from('eduset_settings')
    .upsert({ id: 1, access_token_enc: encrypted, updated_at: new Date().toISOString(), updated_by: null });

  if (error) {
    return NextResponse.json({ message: '저장 실패: ' + error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString() });
}

export async function GET(request: NextRequest) {
  return handleRefresh(request);
}

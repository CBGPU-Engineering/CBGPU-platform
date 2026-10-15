import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';
import { koreaDate, parseSupervisor, SUPERVISOR_SOURCE } from '@/lib/studySupervisor';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Cache keys include the Korean calendar date, so yesterday's result cannot
// appear as today's assignment. Failed crawls are not persisted as empty data.
const crawl = unstable_cache(async (date: string) => {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.emulateTimezone('Asia/Seoul');
    await page.goto(SUPERVISOR_SOURCE, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      // Apps Script puts the actual app in nested iframes and populates it
      // asynchronously. Inspect all rendered frames rather than the wrapper.
      for (const frame of page.frames()) {
        const text = await frame.evaluate(() => document.body?.innerText ?? '').catch(() => '');
        const teachers = parseSupervisor(text, date);
        if (teachers) return { date, teachers, checkedAt: new Date().toISOString() };
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Current dated supervisor card was not found');
  } finally {
    await browser.close();
  }
}, ['study-supervisor-v1'], { revalidate: 900 });

let pending: { date: string; promise: ReturnType<typeof crawl> } | undefined;

export async function GET() {
  const date = koreaDate();
  try {
    if (!pending || pending.date !== date) {
      const promise = crawl(date);
      pending = { date, promise };
      void promise.finally(() => { if (pending?.promise === promise) pending = undefined; }).catch(() => {});
    }
    const data = await pending.promise;
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[study-supervisor]', error instanceof Error ? error.message : 'Crawl failed');
    return NextResponse.json({ date, error: '오늘의 자습감독 정보를 불러오지 못했습니다.' }, { status: 502 });
  }
}

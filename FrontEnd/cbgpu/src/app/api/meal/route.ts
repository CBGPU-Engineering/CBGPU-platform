import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SCHOOL_BASE = 'https://school.cbe.go.kr';
const SCHOOL_HOME = `${SCHOOL_BASE}/cbs-h/M01`;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

// ── 급식 URL 캐시 ──────────────────────────────────────────────────────────────
let mealUrl: string | null = null;

async function findMealUrl(): Promise<string | null> {
  if (mealUrl) return mealUrl;
  try {
    const res = await fetch(SCHOOL_HOME, { headers: HEADERS, signal: AbortSignal.timeout(8000), next: { revalidate: 86400 } });
    const html = await res.text();
    // 급식, 식단, 영양 관련 링크 탐색
    const matches = [
      ...html.matchAll(/href="([^"]*(?:급식|식단|meal|MEAL|nutrition)[^"]*)"/gi),
      ...html.matchAll(/href="(\/cbs-h\/M\d+\/[^"]*(?:list|view)[^"]*)"/gi),
    ];
    for (const m of matches) {
      const href = m[1];
      const full = href.startsWith('http') ? href : `${SCHOOL_BASE}${href}`;
      mealUrl = full;
      return full;
    }
    // 직접 알려진 패턴 시도
    for (const code of ['M010405','M010406','M010404','M010408','M010402']) {
      const url = `${SCHOOL_BASE}/cbs-h/${code}`;
      const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(4000), next: { revalidate: 3600 } });
      if (!r.ok) continue;
      const h = await r.text();
      if (/급식|식단|칼로리|열량|kcal/i.test(h)) { mealUrl = url; return url; }
    }
  } catch {}
  return null;
}

// ── HTML → 급식 파싱 ──────────────────────────────────────────────────────────
function stripTags(s: string) {
  return s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#\d+;/g,'').trim();
}

function parseMealPage(html: string, dateYmd: string) {
  const meals: { type: string; menu: string; calories: string }[] = [];
  // 날짜 형식 변환: 20260515 → 여러 포맷으로 시도
  const y = dateYmd.slice(0,4), m = dateYmd.slice(4,6), d = dateYmd.slice(6,8);
  const patterns = [`${y}.${m}.${d}`, `${y}-${m}-${d}`, `${m}/${d}`, `${parseInt(m)}/${parseInt(d)}`, `${parseInt(d)}`];

  // 테이블 기반 파싱
  const tbodies = html.match(/<t(?:body|r)[^>]*>([\s\S]*?)<\/t(?:body|r)>/gi) ?? [];
  for (const row of tbodies) {
    const cells = (row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) ?? []).map(c => stripTags(c));
    for (const pat of patterns) {
      if (!cells.some(c => c.includes(pat))) continue;
      // 이 행에 날짜 포함 → 급식 데이터 추출
      const mealTypes = ['조식', '중식', '석식', '아침', '점심', '저녁'];
      cells.forEach((cell, i) => {
        const type = mealTypes.find(t => cell.includes(t));
        if (type && cells[i+1] && cells[i+1].length > 5) {
          meals.push({ type, menu: cells[i+1].replace(/\s+/g,' ').trim(), calories: cells[i+2] ?? '' });
        }
      });
      // 타입 없이 메뉴만 있는 경우
      if (!meals.length) {
        const menu = cells.filter(c => c.length > 5 && !patterns.some(p => c === p)).join('\n');
        if (menu) meals.push({ type: '중식', menu, calories: '' });
      }
      break;
    }
  }

  // 테이블 파싱 실패 시 div/p 기반 시도
  if (!meals.length) {
    const menuBlocks = html.match(/(?:중식|조식|석식)[^<]*(?:<[^>]+>[^<]*){0,10}/gi) ?? [];
    for (const block of menuBlocks) {
      const type = (block.match(/중식|조식|석식/) ?? ['중식'])[0];
      const menu = stripTags(block).replace(/중식|조식|석식/g,'').trim();
      if (menu.length > 5) meals.push({ type, menu, calories: '' });
    }
  }

  return meals;
}

// ── handler ───────────────────────────────────────────────────────────────────
function fmtDate(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get('date') ?? fmtDate(new Date());
  try {
    const url = await findMealUrl();
    if (!url) return NextResponse.json({ meals: [], date: dateParam, note: '급식 페이지를 찾지 못했습니다' });
    const res  = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html  = await res.text();
    const meals = parseMealPage(html, dateParam);
    return NextResponse.json({ meals, date: dateParam, source: url });
  } catch (e: any) {
    return NextResponse.json({ meals: [], error: e.message, date: dateParam }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MEAL_BASE = 'https://school.cbe.go.kr/cbs-h/M020201';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Referer': 'https://school.cbe.go.kr/',
};

function stripTags(s: string) {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeAllergens(s: string) {
  return s.replace(/\s*\([0-9.]+\)\s*/g, '').trim();
}

interface MealItem {
  type: string;
  items: string[];
  calories: string;
}

function parseMealHtml(html: string): MealItem[] {
  const meals: MealItem[] = [];

  // Find all <dl> blocks containing usm-lunch-tit
  const dlRegex = /<dl[^>]*>([\s\S]*?)<\/dl>/gi;
  let dlMatch;
  while ((dlMatch = dlRegex.exec(html)) !== null) {
    const dlHtml = dlMatch[1];

    const titMatch = dlHtml.match(/<dt[^>]*class="[^"]*usm-lunch-tit[^"]*"[^>]*>([\s\S]*?)<\/dt>/i);
    if (!titMatch) continue;

    const type = stripTags(titMatch[1]).trim();
    if (!type || type === '참고사항') continue;

    const ddMatch = dlHtml.match(/<dd[^>]*>([\s\S]*?)<\/dd>/i);
    if (!ddMatch) continue;

    const items: string[] = [];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liRegex.exec(ddMatch[1])) !== null) {
      const item = removeAllergens(stripTags(liMatch[1]));
      if (item) items.push(item);
    }

    if (items.length > 0) meals.push({ type, items, calories: '' });
  }

  // Extract per-meal calories from 참고사항 block
  const calMatches = html.matchAll(/칼로리\(([^)]+)\)\s*:([\d.]+)\s*Kcal/gi);
  for (const c of calMatches) {
    const typeKr = c[1]; // e.g. "조식"
    const kcal = c[2];
    const meal = meals.find(
      m => m.type === typeKr || m.type.includes(typeKr) || typeKr.includes(m.type)
    );
    if (meal) meal.calories = `${kcal} kcal`;
  }

  return meals;
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  const today = fmtDate(new Date());
  const dateParam = req.nextUrl.searchParams.get('date') ?? today;

  try {
    // Korean school sites commonly accept sdate or searchDate params for date navigation
    const candidates = [
      `${MEAL_BASE}?sdate=${dateParam}`,
      `${MEAL_BASE}?searchDate=${dateParam}`,
      MEAL_BASE,
    ];

    let html = '';
    let usedUrl = MEAL_BASE;

    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          headers: HEADERS,
          signal: AbortSignal.timeout(8000),
          next: { revalidate: 1800 },
        });
        if (!res.ok) continue;
        const text = await res.text();
        if (text.includes('usm-lunch')) {
          html = text;
          usedUrl = url;
          break;
        }
      } catch {}
    }

    if (!html) {
      return NextResponse.json({ meals: [], date: dateParam, today, note: '급식 페이지를 가져오지 못했습니다' });
    }

    const meals = parseMealHtml(html);
    return NextResponse.json({ meals, date: dateParam, today, source: usedUrl });
  } catch (e: any) {
    return NextResponse.json({ meals: [], error: e.message, date: dateParam, today }, { status: 500 });
  }
}

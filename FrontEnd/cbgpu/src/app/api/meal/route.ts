import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Monthly meal schedule — contains 조식/중식/석식 for every weekday
const MEAL_LIST = 'https://school.cbe.go.kr/cbs-h/M01050705/list';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Referer': 'https://school.cbe.go.kr/',
};

const MEAL_TYPES = ['조식', '중식', '석식'];

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

// Parse all <dl> blocks from a day's HTML section
function parseDayHtml(html: string): MealItem[] {
  const meals: MealItem[] = [];
  const dlRegex = /<dl[^>]*>([\s\S]*?)<\/dl>/gi;
  let dlMatch;
  while ((dlMatch = dlRegex.exec(html)) !== null) {
    const dlHtml = dlMatch[1];

    const dtMatch = dlHtml.match(/<dt[^>]*>([\s\S]*?)<\/dt>/i);
    if (!dtMatch) continue;

    const typeText = stripTags(dtMatch[1]).trim();
    if (!MEAL_TYPES.includes(typeText)) continue;

    const ddMatch = dlHtml.match(/<dd[^>]*>([\s\S]*?)<\/dd>/i);
    if (!ddMatch) continue;

    const items: string[] = [];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liRegex.exec(ddMatch[1])) !== null) {
      const item = removeAllergens(stripTags(liMatch[1]));
      if (item) items.push(item);
    }

    if (items.length > 0) meals.push({ type: typeText, items, calories: '' });
  }
  return meals;
}

// Find the <a href="...?ymd=YYYYMMDD"> cell and extract its contents
function parseMealPage(html: string, dateYmd: string): MealItem[] {
  const linkIdx = html.indexOf(`?ymd=${dateYmd}`);
  if (linkIdx === -1) return [];

  const before = html.slice(0, linkIdx);
  const aStart = before.lastIndexOf('<a ');
  if (aStart === -1) return [];

  const fromA = html.slice(aStart);
  const aEnd = fromA.indexOf('</a>');
  if (aEnd === -1) return [];

  return parseDayHtml(fromA.slice(0, aEnd));
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  const today = fmtDate(new Date());
  const dateParam = req.nextUrl.searchParams.get('date') ?? today;

  try {
    const url = `${MEAL_LIST}?ymd=${dateParam}`;
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 1800 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const meals = parseMealPage(html, dateParam);

    return NextResponse.json({ meals, date: dateParam, today, source: url });
  } catch (e: any) {
    return NextResponse.json({ meals: [], error: e.message, date: dateParam, today }, { status: 500 });
  }
}

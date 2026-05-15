import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE = 'http://comci.kr:4082';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

// ── in-memory cache ───────────────────────────────────────────────────────────
let cache: {
  schoolCode: string; url: string;
  searchKey: string; ttKey: string; dataKey: number;
  timetable: any; at: number;
} | null = null;
const CACHE_TTL = 3_600_000; // 1시간

// ── helpers ───────────────────────────────────────────────────────────────────
const encodeSchool = (name: string) =>
  encodeURIComponent(btoa(unescape(encodeURIComponent(name))));

function extractBetween(src: string, before: string, after: string) {
  const s = src.indexOf(before);
  if (s < 0) return '';
  const e = src.indexOf(after, s + before.length);
  return e < 0 ? '' : src.slice(s + before.length, e);
}

// ── Step 1: init — parse script to get API keys ────────────────────────────────
async function init() {
  // 1a. Get main page HTML
  const html = await fetch(`${BASE}/st`, { headers: HEADERS }).then(r => r.text());

  // 1b. Find embedded script src (href or src attribute)
  const srcMatch =
    html.match(/document\.location\.href\s*=\s*['"]([^'"]+)['"]/)?.[1] ||
    html.match(/<script[^>]+src=['"]([^'"]+\.js[^'"]*)['"]/)?.[1] ||
    html.match(/['"]([^'"]*\/[^'"]*\.js[^'"]*)['"]/)?.[1];

  if (!srcMatch) throw new Error('comcigan: script src를 찾을 수 없습니다');

  const scriptUrl = srcMatch.startsWith('http') ? srcMatch : `${BASE}${srcMatch.startsWith('/') ? '' : '/'}${srcMatch}`;

  // 1c. Fetch the JavaScript
  const script = await fetch(scriptUrl, { headers: HEADERS }).then(r => r.text());

  // 1d. Extract search key — looks for patterns like ?ab= followed by encoded name
  //     comcigan uses a short variable name as query key
  const searchKeyMatch =
    script.match(/\?([a-zA-Z_$]{1,3})=encodeURIComponent/) ||
    script.match(/[?&]([a-zA-Z_$]{1,3})=['"]?\+?encodeURI/) ||
    script.match(/\?([a-zA-Z_$]{1,3})=\w/) ;
  const searchKey = searchKeyMatch?.[1] ?? 'q';

  // 1e. Extract timetable data key — a numeric property key in the response
  //     e.g. data[232] or res[252]
  const dataKeyMatch = script.match(/\[(\d{2,3})\]\[0\]\[/) || script.match(/\w+\[(\d{2,3})\]/);
  const dataKey = dataKeyMatch ? parseInt(dataKeyMatch[1]) : 232;

  // 1f. Extract timetable query key
  const ttKeyMatch =
    script.match(/\?([a-zA-Z_$]{1,3})=\w+\.\w+\.code/) ||
    script.match(/\?([a-zA-Z_$]{1,3})=\w+\[/) ||
    script.match(/\?([a-zA-Z_$]{2,3})=/) ;
  const ttKey = ttKeyMatch?.[1] ?? searchKey;

  return { url: `${BASE}/st`, searchKey, ttKey, dataKey };
}

// ── Step 2: search school ──────────────────────────────────────────────────────
async function searchSchool(url: string, searchKey: string, schoolName: string) {
  const encoded = encodeSchool(schoolName);
  const res = await fetch(`${url}?${searchKey}=${encoded}`, { headers: HEADERS });
  const data = await res.json().catch(() => null);

  if (!data) throw new Error('comcigan: 학교 검색 응답 파싱 실패');

  // Response is usually [[code, name, region], ...] or [{code, name}]
  const schools: { code: string; name: string }[] = [];
  if (Array.isArray(data)) {
    for (const s of data) {
      if (Array.isArray(s) && s.length >= 2) {
        schools.push({ code: String(s[0]), name: String(s[1]) });
      } else if (s && typeof s === 'object') {
        schools.push({ code: String(s.code ?? s[0] ?? ''), name: String(s.name ?? s[1] ?? '') });
      }
    }
  }
  if (!schools.length) throw new Error('comcigan: 학교를 찾을 수 없습니다');
  return schools[0];
}

// ── Step 3: fetch timetable ────────────────────────────────────────────────────
async function fetchTimetable(url: string, ttKey: string, dataKey: number, schoolCode: string) {
  const res  = await fetch(`${url}?${ttKey}=${schoolCode}`, { headers: HEADERS });
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('comcigan: 시간표 응답 파싱 실패');
  // Find the timetable array — try known keys and fall back to scanning
  const tt = data[dataKey] ?? data[232] ?? data[252] ?? data[Object.keys(data).find(k => Array.isArray(data[k]) && Array.isArray(data[k][0])) ?? ''];
  return tt;
}

// ── grid builder ──────────────────────────────────────────────────────────────
// comcigan format: data[grade][class][weekday][period] = {s: subjectName, t: teacherName}
// weekday 1=Mon, period starts at 1
function buildGrid(raw: any, grade: number, cls: number) {
  const grid: Record<number, Record<number, {subject:string;teacher:string}>> = {};
  if (!raw) return grid;
  const gradeData = raw[grade] ?? raw[grade - 1];
  if (!gradeData) return grid;
  const classData = gradeData[cls] ?? gradeData[cls - 1];
  if (!classData) return grid;

  for (let wd = 0; wd < 5; wd++) {
    const dayData = classData[wd + 1] ?? classData[wd];
    if (!dayData) continue;
    grid[wd] = {};
    for (let p = 1; p <= 9; p++) {
      const cell = dayData[p];
      if (!cell) continue;
      const subject = typeof cell === 'object' ? (cell.s ?? cell[0] ?? '') : String(cell);
      const teacher = typeof cell === 'object' ? (cell.t ?? cell[1] ?? '') : '';
      if (subject) grid[wd][p] = { subject: String(subject), teacher: String(teacher) };
    }
  }
  return grid;
}

function availableGradesClasses(raw: any) {
  const grades = Object.keys(raw ?? {}).map(Number).filter(Boolean).sort();
  const classes = grades.length
    ? Object.keys((raw[grades[0]] ?? {})).map(Number).filter(Boolean).sort()
    : [1];
  return { grades, classes };
}

// ── route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sp    = req.nextUrl.searchParams;
  const grade = parseInt(sp.get('grade') || '1');
  const cls   = parseInt(sp.get('class') || '1');

  try {
    // re-init if cache expired
    if (!cache || Date.now() - cache.at > CACHE_TTL) {
      const { url, searchKey, ttKey, dataKey } = await init();
      const school    = await searchSchool(url, searchKey, '충북과학고');
      const timetable = await fetchTimetable(url, ttKey, dataKey, school.code);
      cache = { schoolCode: school.code, url, searchKey, ttKey, dataKey, timetable, at: Date.now() };
    }

    const { grades, classes } = availableGradesClasses(cache.timetable);
    const grid = buildGrid(cache.timetable, grade, cls);

    return NextResponse.json({ grid, grades, classes, school: '충북과학고등학교' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}

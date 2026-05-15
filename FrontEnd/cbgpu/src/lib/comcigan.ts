// 컴시간 알리미 클라이언트사이드 크롤러
// allorigins.win CORS 프록시를 통해 브라우저(한국)→comci.kr 요청

const COMCI = 'http://comci.kr:4082';
// allorigins: HTTP→HTTPS 변환 + CORS 우회
const PROXY = (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

async function pget(url: string): Promise<string> {
  const res = await fetch(PROXY(url), { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  return res.text();
}
async function pjson(url: string): Promise<any> {
  const text = await pget(url);
  try { return JSON.parse(text); } catch { throw new Error('JSON 파싱 실패: ' + text.slice(0, 80)); }
}

// ── 초기화: 스크립트에서 API 키 추출 ─────────────────────────────────────────
let _cache: { searchKey: string; ttKey: string; dataKey: number; schoolCode: string; data: any; at: number } | null = null;
const TTL = 3_600_000;

export async function getComciganTimetable(): Promise<{
  grades: number[];
  classes: number[];
  rawData: any;
}> {
  if (_cache && Date.now() - _cache.at < TTL) {
    return { grades: Object.keys(_cache.data ?? {}).map(Number).sort(), classes: [], rawData: _cache.data };
  }

  // 1. 메인 페이지 HTML
  const html = await pget(`${COMCI}/st`);

  // 2. 스크립트 URL 추출
  const scriptSrc =
    html.match(/src="(\/[^"]+\.js[^"]*)"/)?.[1] ??
    html.match(/<script[^>]+src=["']([^"']+\.js[^"']*)["']/)?.[1];
  if (!scriptSrc) throw new Error('스크립트 URL을 찾을 수 없습니다');
  const scriptUrl = `${COMCI}${scriptSrc.startsWith('/') ? '' : '/'}${scriptSrc}`;

  // 3. JS 파싱하여 키 추출
  const script = await pget(scriptUrl);

  // 검색 키: ?xx=encodeURIComponent 패턴
  const searchKey =
    script.match(/\?([a-zA-Z_$]{1,3})=encodeURIComponent/)?.[1] ??
    script.match(/\?([a-zA-Z_$]{1,3})=[a-z]+URI/)?.[1] ?? 'q';

  // 시간표 키: school.code 또는 학교코드 참조 패턴
  const ttKey =
    script.match(/\?([a-zA-Z_$]{1,3})=\w+\.\w+\.\w+code/)?.[1] ??
    script.match(/\?([a-zA-Z_$]{1,3})=\w+\[/)?.[1] ?? searchKey;

  // 데이터 키 (숫자 인덱스): [232][0][ 패턴
  const dataKeyStr = script.match(/\[(\d{2,3})\]\[0\]\[/)?.[1] ?? '232';
  const dataKey = parseInt(dataKeyStr);

  // 4. 학교 검색
  const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent('충북과학고'))));
  const schools = await pjson(`${COMCI}/st?${searchKey}=${encoded}`);
  if (!Array.isArray(schools) || !schools.length) throw new Error('학교를 찾을 수 없습니다');

  const school = schools[0];
  const schoolCode = String(Array.isArray(school) ? school[0] : (school.code ?? school[0]));

  // 5. 시간표 조회
  const ttRaw = await pjson(`${COMCI}/st?${ttKey}=${schoolCode}`);
  const rawData =
    ttRaw[dataKey] ??
    ttRaw[232] ?? ttRaw[252] ?? ttRaw[253] ??
    ttRaw[Object.keys(ttRaw).find(k => Array.isArray(ttRaw[k]) && ttRaw[k].length > 0) ?? ''];

  if (!rawData) throw new Error(`시간표 키를 찾지 못했습니다 (키: ${dataKey})`);

  const grades = Object.keys(rawData).map(Number).filter(n => n > 0).sort();

  _cache = { searchKey, ttKey, dataKey, schoolCode, data: rawData, at: Date.now() };
  return { grades, classes: [], rawData };
}

// ── 학년/반 시간표 추출 ────────────────────────────────────────────────────────
export type CellInfo = { subject: string; teacher: string };
export type ComciGrid = Record<number, Record<number, CellInfo>>; // wd(0=월) → period → cell

export function extractGrid(rawData: any, grade: number, cls: number): { grid: ComciGrid; classes: number[] } {
  const gradeData = rawData?.[grade] ?? rawData?.[grade - 1];
  const classes = gradeData ? Object.keys(gradeData).map(Number).filter(n => n > 0).sort() : [1];

  const classData = gradeData?.[cls] ?? gradeData?.[cls - 1] ?? gradeData?.[0];
  const grid: ComciGrid = {};

  if (!classData) return { grid, classes };

  for (let wd = 0; wd < 5; wd++) {
    const dayData = classData[wd + 1] ?? classData[wd];
    if (!dayData) continue;
    grid[wd] = {};
    for (let p = 1; p <= 9; p++) {
      const cell = dayData[p];
      if (!cell) continue;
      let subject = '', teacher = '';
      if (typeof cell === 'object') {
        subject = String(cell.s ?? cell[0] ?? cell.subject ?? '').trim();
        teacher = String(cell.t ?? cell[1] ?? cell.teacher ?? '').trim();
      } else {
        subject = String(cell).trim();
      }
      if (subject) grid[wd][p] = { subject, teacher };
    }
  }
  return { grid, classes };
}

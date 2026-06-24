/**
 * 컴시간알리미(comci.net) 시간표 클라이언트
 *
 * 기존에 쓰던 `comcigan-parser` 패키지는 컴시간 웹페이지의 JS를 그대로 eval() 하는
 * 방식이라 유지보수가 끊겼고(deprecated `request` 의존), 사이트가 페이지 구조를
 * 조금만 바꿔도 깨지기 쉽다. 여기서는 컴시간 웹뷰어의 디코딩 로직(자료481/자료147 +
 * baSplit/splitData)을 직접 포팅해서 eval 없이 순수 데이터 디코딩만 수행한다.
 */
import iconv from 'iconv-lite';

const ENTRY_URL = 'http://컴시간학생.kr';
const SCHOOL_KEYWORD = '충북과학고';
const SCHOOL_DISPLAY_NAME = '충북과학고등학교';
const MAX_PERIOD = 8;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const META_TTL = 6 * 60 * 60 * 1000; // 사이트 토큰은 자주 바뀌지 않음
const DATA_TTL = 5 * 60 * 1000; // 실시간 변경 반영을 위해 짧게 유지

interface SiteMeta {
  baseUrl: string;
  extractCode: string; // e.g. "/36179?17384l"
  scPrefix: string;    // e.g. "73629_"
  scSuffix: string;    // e.g. "1"
}

export interface TimetableCell {
  subject: string;
  teacher: string;
  changed: boolean; // 실시간 보강/결강 등 변경 여부
  group: string;    // 동시수업 그룹 문자 (없으면 '')
}

type Grid = Record<number, Record<number, TimetableCell>>; // weekday(0=월) -> period -> cell

export interface TimetableResult {
  grid: Grid;
  classTimes: string[];
  grades: number[];
  classes: number[];
  schoolName: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawData = Record<string, any>;

let metaCache: { meta: SiteMeta; at: number } | null = null;
let schoolCodeCache: number | null = null;
let dataCache: { raw: RawData; at: number } | null = null;

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchEucKr(url: string): Promise<string> {
  return iconv.decode(await fetchBuffer(url), 'euc-kr');
}

async function fetchUtf8(url: string): Promise<string> {
  return (await fetchBuffer(url)).toString('utf-8');
}

function hexEncodeEucKr(text: string): string {
  let hex = '';
  for (const byte of iconv.encode(text, 'euc-kr')) hex += '%' + byte.toString(16);
  return hex;
}

async function loadMeta(): Promise<SiteMeta> {
  const entryHtml = await fetchUtf8(ENTRY_URL);
  const frameTag = entryHtml.toLowerCase().replace(/'/g, '"').match(/<frame [^>]*src="[^"]*"[^>]*>/);
  if (!frameTag) throw new Error('frame을 찾을 수 없습니다');
  const hrefMatch = frameTag[0].match(/"(.*)"/);
  if (!hrefMatch) throw new Error('접근 주소를 찾을 수 없습니다');
  const frameUrl = hrefMatch[1];
  const baseUrl = new URL(frameUrl).origin;

  const pageSource = await fetchEucKr(frameUrl);
  const idx = pageSource.toLowerCase().indexOf('school_ra(sc)');
  const idx2 = pageSource.indexOf("sc_data('");
  if (idx === -1 || idx2 === -1) throw new Error('소스에서 식별 코드를 찾을 수 없습니다');

  const chunk1 = pageSource.slice(idx, idx + 50).replace(' ', '');
  const schoolRaMatch = chunk1.match(/url:'.(.*?)'/);
  if (!schoolRaMatch) throw new Error('school_ra 값을 찾을 수 없습니다');

  const chunk2 = pageSource.slice(idx2, idx2 + 30).replace(' ', '');
  const scDataMatch = chunk2.match(/\((.*?)\)/);
  if (!scDataMatch) throw new Error('sc_data 값을 찾을 수 없습니다');
  const scParts = scDataMatch[1].replace(/'/g, '').split(',');

  return { baseUrl, extractCode: schoolRaMatch[1], scPrefix: scParts[0], scSuffix: scParts[2] };
}

async function getMeta(forceRefresh = false): Promise<SiteMeta> {
  if (!forceRefresh && metaCache && Date.now() - metaCache.at < META_TTL) return metaCache.meta;
  const meta = await loadMeta();
  metaCache = { meta, at: Date.now() };
  return meta;
}

async function searchSchool(meta: SiteMeta, keyword: string) {
  const url = meta.baseUrl + meta.extractCode + hexEncodeEucKr(keyword);
  const body = await fetchUtf8(url);
  const jsonStr = body.slice(0, body.lastIndexOf('}') + 1);
  const list = JSON.parse(jsonStr)?.['학교검색'] as [number, string, string, number][] | undefined;
  if (!list?.length) throw new Error('검색된 학교가 없습니다');
  return list.map(([, region, name, code]) => ({ region, name, code }));
}

async function resolveSchoolCode(meta: SiteMeta): Promise<number> {
  if (schoolCodeCache != null) return schoolCodeCache;
  const schools = await searchSchool(meta, SCHOOL_KEYWORD);
  schoolCodeCache = schools[0].code;
  return schoolCodeCache;
}

async function fetchRawData(meta: SiteMeta, schoolCode: number): Promise<RawData> {
  const path = meta.extractCode.split('?')[0];
  const payload = `${meta.scPrefix}${schoolCode}_0_${meta.scSuffix}`;
  const b64 = Buffer.from(payload).toString('base64');
  const url = meta.baseUrl + path + '?' + b64;
  const body = await fetchUtf8(url);
  const jsonStr = body.slice(0, body.lastIndexOf('}') + 1);
  return JSON.parse(jsonStr);
}

async function loadRawData(forceRefresh = false): Promise<RawData> {
  if (!forceRefresh && dataCache && Date.now() - dataCache.at < DATA_TTL) return dataCache.raw;

  try {
    const meta = await getMeta();
    const raw = await fetchRawData(meta, await resolveSchoolCode(meta));
    dataCache = { raw, at: Date.now() };
    return raw;
  } catch {
    // 컴시간 쪽 토큰(extractCode 등)이 갱신됐을 가능성 -> 메타를 새로 받아 1회 재시도
    metaCache = null;
    schoolCodeCache = null;
    const meta = await getMeta(true);
    const raw = await fetchRawData(meta, await resolveSchoolCode(meta));
    dataCache = { raw, at: Date.now() };
    return raw;
  }
}

// ---- 컴시간 웹뷰어 디코딩 로직 포팅 ----

/** 정수를 뒤에서부터 3자리씩 끊어 [마지막청크, 나머지] 형태로 분리한다 (예: 25024 -> [24, 25]) */
function splitDigits(value: number | string): [number, number] {
  const matches = String(value).match(/\d{1,3}(?=(?:\d{3})+(?!\d))|\d{1,3}$/g);
  if (!matches) return [0, 0];
  const nums = matches.reverse().map(Number);
  return [nums[0] ?? 0, nums[1] ?? 0];
}

/** 자료481(기본 시간표)과 자료147(당일 보정값)을 비교해 교사/과목 인덱스와 변경 여부를 구한다 */
function splitDaily(dailyRaw: number | string, defaultRaw: number | string, changeNotify: number) {
  const dailyStr = String(dailyRaw);
  if (changeNotify === 1) {
    if (dailyStr.startsWith('>')) {
      const [teacherIdx, subjectRaw] = splitDigits(dailyStr.slice(1));
      return { teacherIdx, subjectRaw, changed: true };
    }
    const [teacherIdx, subjectRaw] = splitDigits(dailyRaw);
    return { teacherIdx, subjectRaw, changed: false };
  }
  const [teacherIdx, subjectRaw] = splitDigits(dailyRaw);
  return { teacherIdx, subjectRaw, changed: dailyStr !== String(defaultRaw) };
}

/** 같은 교시에 동시수업(분반)이 있으면 그룹 문자(A_, B_ ...)를 반환한다 */
function groupLetter(subjectRaw: number, separator: number): string {
  if (separator === 100) return '';
  const group = Math.floor(subjectRaw / separator);
  return group >= 1 && group <= 26 ? String.fromCharCode(group + 64) : '';
}

function cleanTeacherName(name?: string): string {
  if (!name) return '';
  if ((name.includes('*') && !name.startsWith('*') && !name.endsWith('*')) || (name.length === 2 && name[1] === '*')) {
    return name;
  }
  return name.replace('*', '');
}

function decodeGrid(raw: RawData, grade: number, cls: number): Grid {
  const separator: number = raw?.['분리'] ?? 100;
  const changeNotify: number = raw?.['변경알림'] ?? 0;
  const defaultData = raw?.['자료481']?.[grade]?.[cls];
  const dailyData = raw?.['자료147']?.[grade]?.[cls];
  const teacherNames: string[] = raw?.['자료446'] ?? [];
  const subjectNames: string[] = raw?.['자료492'] ?? [];
  const grid: Grid = {};

  if (!dailyData) return grid;

  for (let weekday = 1; weekday <= 5; weekday++) {
    const dailyDay = dailyData[weekday];
    if (!dailyDay) continue;
    const defaultDay = defaultData?.[weekday];

    for (let period = 1; period <= MAX_PERIOD; period++) {
      const dailyRaw = dailyDay[period] ?? 0;
      const defaultRaw = defaultDay?.[period] ?? 0;
      const { teacherIdx, subjectRaw, changed } = splitDaily(dailyRaw, defaultRaw, changeNotify);
      if (teacherIdx <= 0) continue;

      const subjectIdx = subjectRaw % separator;
      const subject = subjectNames[subjectIdx];
      if (!subject || typeof subject !== 'string') continue;

      const wd = weekday - 1; // 0 = 월요일
      if (!grid[wd]) grid[wd] = {};
      grid[wd][period] = {
        subject,
        teacher: cleanTeacherName(teacherNames[teacherIdx]),
        changed,
        group: groupLetter(subjectRaw, separator),
      };
    }
  }
  return grid;
}

export async function getTimetable(grade: number, cls: number, opts?: { forceRefresh?: boolean }): Promise<TimetableResult> {
  const raw = await loadRawData(opts?.forceRefresh);

  const classCounts: number[] = raw?.['학급수'] ?? [];
  const maxGrade = Math.max(0, classCounts.length - 1);
  const grades = Array.from({ length: maxGrade }, (_, i) => i + 1);
  const classCount = classCounts[grade] ?? 0;
  const classes = Array.from({ length: classCount }, (_, i) => i + 1);

  return {
    grid: decodeGrid(raw, grade, cls),
    classTimes: raw?.['일과시간'] ?? [],
    grades,
    classes,
    schoolName: SCHOOL_DISPLAY_NAME,
  };
}

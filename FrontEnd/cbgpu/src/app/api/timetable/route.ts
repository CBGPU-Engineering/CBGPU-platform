import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const KEY = process.env.NEIS_API_KEY || 'SAMPLE';
const BASE = 'https://open.neis.go.kr/hub';

// ── 학교 코드 캐시 ────────────────────────────────────────────────────────────
let cachedSchool: { atpt: string; code: string; name: string } | null = null;

async function findSchool() {
  if (cachedSchool) return cachedSchool;
  const res = await fetch(
    `${BASE}/schoolInfo?KEY=${KEY}&Type=json&pSize=5&SCHUL_NM=${encodeURIComponent('충북과학고등학교')}`,
    { next: { revalidate: 86400 } },
  );
  const json = await res.json();
  const row = json.schoolInfo?.[1]?.row?.[0];
  if (!row) throw new Error('NEIS에서 학교 정보를 찾을 수 없습니다.');
  cachedSchool = { atpt: row.ATPT_OFCDC_SC_CODE, code: row.SD_SCHUL_CODE, name: row.SCHUL_NM };
  return cachedSchool;
}

// ── 주간 날짜 계산 ─────────────────────────────────────────────────────────────
function weekOf(offset = 0) {
  const today = new Date();
  today.setDate(today.getDate() + offset * 7);
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return { from: fmt(monday), to: fmt(friday), mondayTs: monday.getTime() };
}

// ── 시간표 조회 ────────────────────────────────────────────────────────────────
async function fetchTimetable(atpt: string, code: string, grade: number, cls: number, from: string, to: string) {
  const params = new URLSearchParams({
    KEY, Type: 'json', pIndex: '1', pSize: '500',
    ATPT_OFCDC_SC_CODE: atpt, SD_SCHUL_CODE: code,
    AY: from.slice(0, 4), SEM: parseInt(from.slice(4, 6)) <= 8 ? '1' : '2',
    FROM_YMD: from, TO_YMD: to,
    GRADE: String(grade), CLASS_NM: String(cls),
  });
  const res = await fetch(`${BASE}/hisTimetable?${params}`, { next: { revalidate: 3600 } });
  const json = await res.json();
  const head = json.hisTimetable?.[0]?.head;
  const code2 = head?.[1]?.RESULT?.CODE;
  if (code2 && code2 !== 'INFO-000') {
    if (code2 === 'INFO-200') return []; // 데이터 없음
    throw new Error(head[1].RESULT.MESSAGE);
  }
  return (json.hisTimetable?.[1]?.row ?? []) as {
    ALL_TI_YMD: string; GRADE: string; CLASS_NM: string;
    PERIO: string; ITRT_CNTNT: string;
  }[];
}

export async function GET(req: NextRequest) {
  const sp     = req.nextUrl.searchParams;
  const grade  = parseInt(sp.get('grade') || '1');
  const cls    = parseInt(sp.get('class') || '1');
  const offset = parseInt(sp.get('week')  || '0'); // 0=현재, -1=지난주, 1=다음주

  try {
    const school           = await findSchool();
    const { from, to, mondayTs } = weekOf(offset);
    const rows             = await fetchTimetable(school.atpt, school.code, grade, cls, from, to);

    // YYYYMMDD → weekday index (0=Mon…4=Fri)
    const toWdIdx = (ymd: string) => {
      const d = new Date(`${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}`);
      const dow = d.getDay(); // 0=Sun
      return dow === 0 ? -1 : dow - 1;
    };

    // Build [weekday][period] → subject
    const grid: Record<number, Record<number, string>> = {};
    for (const r of rows) {
      const wd = toWdIdx(r.ALL_TI_YMD);
      if (wd < 0 || wd > 4) continue;
      const period = parseInt(r.PERIO);
      if (!grid[wd]) grid[wd] = {};
      grid[wd][period] = r.ITRT_CNTNT;
    }

    // Find max grade / class by querying available data (simple: return 1-3 / 1-4 range)
    return NextResponse.json({
      grid, school: school.name, from, to, mondayTs,
      grades: [1, 2, 3], classes: [1, 2, 3, 4],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CACHE_TTL = 3_600_000; // 1시간

let _tt: any   = null;
let _cache: { data: any; times: string[]; at: number } | null = null;

async function getInstance() {
  if (_tt) return _tt;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Timetable = require('comcigan-parser');
  const t = new Timetable();
  await t.init({ maxGrade: 3, cache: CACHE_TTL });

  const schools = await t.search('충북과학고');
  if (!schools?.length) throw new Error('학교를 찾을 수 없습니다');

  // v1.0.0: { _, region, name, code }
  const code = schools[0].code ?? schools[0][3] ?? schools[0][0];
  t.setSchool(code); // sync

  _tt = t;
  return _tt;
}

function buildGrid(data: any, grade: number, cls: number) {
  // v1.0.0: data[grade][class][weekday(0=Mon)][classTime(0-based)]
  const gradeData = data?.[grade] ?? data?.[grade - 1];
  const classData = gradeData?.[cls]  ?? gradeData?.[cls - 1];
  const grid: Record<number, Record<number, { subject: string; teacher: string }>> = {};

  if (!classData) return grid;

  for (let wd = 0; wd < 5; wd++) {
    const dayData = classData[wd];
    if (!dayData) continue;
    grid[wd] = {};
    const periods = Array.isArray(dayData) ? dayData : Object.values(dayData);
    periods.forEach((cell: any, idx: number) => {
      if (!cell) return;
      let subject = '', teacher = '';
      if (typeof cell === 'string') {
        subject = cell.trim();
      } else if (typeof cell === 'object') {
        subject = String(cell.subject ?? cell[0] ?? cell.name ?? '').trim();
        teacher = String(cell.teacher ?? cell[1] ?? '').trim();
      }
      if (subject) grid[wd][idx + 1] = { subject, teacher };
    });
  }
  return grid;
}

export async function GET(req: NextRequest) {
  const sp    = req.nextUrl.searchParams;
  const grade = parseInt(sp.get('grade') || '1');
  const cls   = parseInt(sp.get('class') || '1');

  try {
    if (!_cache || Date.now() - _cache.at > CACHE_TTL) {
      const t     = await getInstance();
      const data  = await t.getTimetable();
      const times = await t.getClassTime().catch(() => []);
      _cache = { data, times, at: Date.now() };
    }

    const raw     = _cache.data;
    const gradeD  = raw?.[grade]  ?? raw?.[grade - 1];
    const grades  = Object.keys(raw ?? {}).map(Number).filter(n => n > 0).sort();
    const classes = Object.keys(gradeD ?? {}).map(Number).filter(n => n > 0).sort();

    return NextResponse.json({
      grid:    buildGrid(raw, grade, cls),
      times:   _cache.times,
      grades,
      classes,
      school: '충북과학고등학교',
    });
  } catch (e: any) {
    _tt = null; _cache = null; // 다음 요청에서 재시도
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}

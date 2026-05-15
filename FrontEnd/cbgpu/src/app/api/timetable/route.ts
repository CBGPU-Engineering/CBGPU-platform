import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // 1시간 캐시

// comcigan-parser는 CJS 패키지이므로 dynamic import로 처리
async function getLib() {
  const mod = await import('comcigan-parser');
  return (mod.default ?? mod) as any;
}

let cached: { data: any; times: any; school: any; at: number } | null = null;
const CACHE_MS = 60 * 60 * 1000; // 1시간

export async function GET(req: NextRequest) {
  const grade = parseInt(req.nextUrl.searchParams.get('grade') || '1');
  const cls   = parseInt(req.nextUrl.searchParams.get('class') || '1');

  try {
    // 캐시가 살아있으면 재사용
    if (!cached || Date.now() - cached.at > CACHE_MS) {
      const Timetable = await getLib();
      const t = new Timetable();
      await t.init();
      const schools = await t.search('충북과학고');
      if (!schools?.length) throw new Error('학교를 찾을 수 없습니다');
      await t.setSchool(schools[0].code ?? schools[0]);
      const data  = await t.getTimetable();
      const times = await t.getClassTime?.() ?? [];
      cached = { data, times, school: schools[0], at: Date.now() };
    }

    const gradeData = cached.data?.[grade] ?? {};
    const classData = gradeData?.[cls] ?? {};
    // 학년/반 목록
    const grades  = Object.keys(cached.data ?? {}).map(Number);
    const classes = Object.keys(gradeData).map(Number);

    return NextResponse.json({
      timetable: classData,
      times: cached.times,
      school: cached.school,
      grades,
      classes,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

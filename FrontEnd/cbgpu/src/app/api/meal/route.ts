import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const KEY  = process.env.NEIS_API_KEY || 'SAMPLE';
const BASE = 'https://open.neis.go.kr/hub';

let schoolInfo: { atpt: string; code: string } | null = null;

async function getSchoolCode() {
  if (schoolInfo) return schoolInfo;
  const res  = await fetch(`${BASE}/schoolInfo?KEY=${KEY}&Type=json&pSize=5&SCHUL_NM=${encodeURIComponent('충북과학고등학교')}`, { next: { revalidate: 86400 } });
  const json = await res.json();
  const row  = json.schoolInfo?.[1]?.row?.[0];
  if (!row) throw new Error('학교 정보 없음');
  schoolInfo = { atpt: row.ATPT_OFCDC_SC_CODE, code: row.SD_SCHUL_CODE };
  return schoolInfo;
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get('date') ?? fmtDate(new Date());
  try {
    const { atpt, code } = await getSchoolCode();
    const res  = await fetch(
      `${BASE}/mealServiceDietInfo?KEY=${KEY}&Type=json&pSize=10&ATPT_OFCDC_SC_CODE=${atpt}&SD_SCHUL_CODE=${code}&MLSV_YMD=${dateParam}`,
      { next: { revalidate: 3600 } },
    );
    const json = await res.json();
    const head = json.mealServiceDietInfo?.[0]?.head;
    if (head?.[1]?.RESULT?.CODE === 'INFO-200') return NextResponse.json({ meals: [] });
    const rows = json.mealServiceDietInfo?.[1]?.row ?? [];
    const meals = rows.map((r: any) => ({
      type:     r.MMEAL_SC_NM,          // 조식/중식/석식
      menu:     r.DDISH_NM?.replace(/<br\/>/gi, '\n').replace(/\d+\.\d+/g, '').trim(),
      calories: r.CAL_INFO,
      origin:   r.ORPLC_INFO,
    }));
    return NextResponse.json({ meals, date: dateParam });
  } catch (e: any) {
    return NextResponse.json({ meals: [], error: e.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getTimetable } from '@/lib/comcigan';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp     = req.nextUrl.searchParams;
  const grade  = parseInt(sp.get('grade') || '1');
  const cls    = parseInt(sp.get('class') || '1');
  const forceRefresh = sp.get('refresh') === '1';

  try {
    const result = await getTimetable(grade, cls, { forceRefresh });
    return NextResponse.json({
      grid:    result.grid,
      times:   result.classTimes,
      grades:  result.grades,
      classes: result.classes,
      school:  result.schoolName,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}

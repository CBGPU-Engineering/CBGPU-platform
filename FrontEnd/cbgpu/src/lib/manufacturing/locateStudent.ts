import { getSelfStudyPolicy, getPeriodCountForDate, localDateStr, searchSelfStudy } from '@/lib/eduset';

export interface StudentIdentity { grade: number; classNo: number; number: number }

/** CBGPU's student_id is the standard Korean school format: grade*1000 + classNo*100 + number
 * (e.g. 1203 = 1학년 2반 3번) — see formatStudentLabel in src/app/study/page.tsx for the same formula. */
export function parseStudentId(studentId: string | null | undefined): StudentIdentity | null {
  if (!studentId) return null;
  const n = parseInt(studentId, 10);
  if (!n || n < 1101) return null;
  const grade = Math.floor(n / 1000);
  const rest = n % 1000;
  const classNo = Math.floor(rest / 100);
  const number = rest % 100;
  if (grade < 1 || grade > 3 || classNo < 1 || classNo > 20 || number < 1 || number > 40) return null;
  return { grade, classNo, number };
}

interface ClassPeriodTime { period: number; startMinutes: number }

/** "1(08:35)" -> { period: 1, startMinutes: 515 } */
function parseClassTimes(times: string[]): ClassPeriodTime[] {
  const out: ClassPeriodTime[] = [];
  for (const t of times) {
    const m = t.match(/^(\d+)\((\d{1,2}):(\d{2})\)/);
    if (!m) continue;
    out.push({ period: Number(m[1]), startMinutes: Number(m[2]) * 60 + Number(m[3]) });
  }
  return out.sort((a, b) => a.startMinutes - b.startMinutes);
}

const ASSUMED_PERIOD_MINUTES = 50;

export type LocationResult =
  | { kind: 'class'; identity: StudentIdentity; period: number; subject?: string; teacher?: string }
  | { kind: 'selfstudy'; identity: StudentIdentity; entries: { period: number; roomName: string; seatName?: string }[] }
  | { kind: 'no-selfstudy'; identity: StudentIdentity }
  | { kind: 'unknown'; identity: StudentIdentity };

/**
 * Best-effort "where is this student right now" lookup.
 *
 * During the regular school day this is clock-accurate: 컴시간(comcigan) publishes real period
 * start times, so we can pinpoint the current period and fall back to the student's homeroom
 * (comcigan has no per-room data, and Korean high schoolers normally stay in homeroom outside
 * moving-class subjects, so homeroom is what's shown — not a claim about elective/lab rooms).
 *
 * Outside school hours there is no clock-time data anywhere in this codebase for self-study
 * periods (자습신청 only ever labels periods "1교시/2교시" without real start times), so instead
 * of guessing a bell schedule we return every self-study room the student is assigned today and
 * let the manager — who knows the current period from experience — pick the right row.
 */
export async function locateStudentNow(studentId: string | null | undefined): Promise<LocationResult | null> {
  const identity = parseStudentId(studentId);
  if (!identity) return null;

  const now = new Date();
  const jsDay = now.getDay(); // 0 Sun .. 6 Sat
  const gridDay = jsDay - 1;  // 0 Mon .. 4 Fri, matching comcigan's grid convention
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (gridDay >= 0 && gridDay <= 4) {
    try {
      const res = await fetch(`/api/timetable?grade=${identity.grade}&class=${identity.classNo}`);
      if (res.ok) {
        const data = await res.json();
        const periods = parseClassTimes(data.times || []);
        for (let i = 0; i < periods.length; i++) {
          const start = periods[i].startMinutes;
          const end = i + 1 < periods.length ? periods[i + 1].startMinutes : start + ASSUMED_PERIOD_MINUTES;
          if (nowMinutes >= start && nowMinutes < end) {
            const cell = data.grid?.[gridDay]?.[periods[i].period];
            return { kind: 'class', identity, period: periods[i].period, subject: cell?.subject, teacher: cell?.teacher };
          }
        }
      }
    } catch {
      // comcigan is a scraped third-party site and can be flaky — fall through to self-study
    }
  }

  try {
    const policy = await getSelfStudyPolicy();
    const count = getPeriodCountForDate(policy, now);
    if (count <= 0) return { kind: 'unknown', identity };

    const entries = await searchSelfStudy({ date: localDateStr(now) }).catch(() => []);
    const mine = entries
      .filter(e => e.student.grade === identity.grade && e.student.classNo === identity.classNo && e.student.number === identity.number)
      .map(e => ({ period: e.period, roomName: e.room?.name ?? '알 수 없음', seatName: e.seat?.name ?? undefined }))
      .sort((a, b) => a.period - b.period);

    if (mine.length === 0) return { kind: 'no-selfstudy', identity };
    return { kind: 'selfstudy', identity, entries: mine };
  } catch {
    return { kind: 'unknown', identity };
  }
}

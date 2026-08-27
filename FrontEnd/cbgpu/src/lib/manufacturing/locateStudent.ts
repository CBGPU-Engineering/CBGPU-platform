import { searchSelfStudy, localDateStr } from '@/lib/eduset';

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

const ASSUMED_CLASS_PERIOD_MINUTES = 50;

interface SelfStudyPeriodTime { period: number; startMinutes: number; endMinutes: number }

function hm(h: number, m: number) { return h * 60 + m; }

const WEEKEND_SELF_STUDY: SelfStudyPeriodTime[] = [
  { period: 1, startMinutes: hm(8, 35),  endMinutes: hm(9, 25) },
  { period: 2, startMinutes: hm(9, 35),  endMinutes: hm(10, 25) },
  { period: 3, startMinutes: hm(10, 35), endMinutes: hm(11, 25) },
  { period: 4, startMinutes: hm(11, 35), endMinutes: hm(12, 25) },
  { period: 5, startMinutes: hm(14, 0),  endMinutes: hm(15, 30) },
  { period: 6, startMinutes: hm(16, 0),  endMinutes: hm(17, 30) },
  { period: 7, startMinutes: hm(19, 0),  endMinutes: hm(20, 20) },
  { period: 8, startMinutes: hm(20, 40), endMinutes: hm(21, 50) },
];

const WEEKDAY_SELF_STUDY: SelfStudyPeriodTime[] = [
  { period: 1, startMinutes: hm(16, 45), endMinutes: hm(18, 0) },
  { period: 2, startMinutes: hm(19, 0),  endMinutes: hm(20, 20) },
  { period: 3, startMinutes: hm(20, 40), endMinutes: hm(21, 50) },
];

/** 교시 배정 정책 (담당자 제공, 2026-08 기준) — 일/월/화/수/목/금/토 순. 학교 정책이 바뀌면 여기를 수정. */
const SELF_STUDY_SCHEDULE: Record<number, SelfStudyPeriodTime[]> = {
  0: WEEKEND_SELF_STUDY,
  1: WEEKDAY_SELF_STUDY,
  2: WEEKDAY_SELF_STUDY,
  3: WEEKDAY_SELF_STUDY,
  4: WEEKDAY_SELF_STUDY,
  5: WEEKDAY_SELF_STUDY,
  6: WEEKEND_SELF_STUDY,
};

export type LocationResult =
  | { kind: 'class'; identity: StudentIdentity; period?: number; subject?: string; teacher?: string }
  | { kind: 'selfstudy'; identity: StudentIdentity; period: number; roomName: string; seatName?: string }
  | { kind: 'no-selfstudy'; identity: StudentIdentity; period: number };

/**
 * "Where is this student right now" — always resolves to somewhere:
 *  - If it's currently a self-study period per the school's actual bell schedule (provided by
 *    the manager, not scraped), look up that student's room/seat for exactly that period via
 *    the shared 자습신청 lookup.
 *  - Otherwise, show the student's homeroom (comcigan has no per-room data, and Korean high
 *    schoolers normally stay in homeroom outside moving-class subjects — this is not a claim
 *    about elective/lab rooms). When 컴시간(comcigan) has a precise period/subject match for
 *    right now, that's included too; when it doesn't (weekend, gap period, or the scraped site
 *    being flaky), we still show homeroom as the best default, just without a subject/period.
 */
export async function locateStudentNow(studentId: string | null | undefined): Promise<LocationResult | null> {
  const identity = parseStudentId(studentId);
  if (!identity) return null;

  const now = new Date();
  const jsDay = now.getDay(); // 0 Sun .. 6 Sat
  const gridDay = jsDay - 1;  // 0 Mon .. 4 Fri, matching comcigan's grid convention
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const todaySchedule = SELF_STUDY_SCHEDULE[jsDay];
  const currentSelfStudyPeriod = todaySchedule.find(p => nowMinutes >= p.startMinutes && nowMinutes < p.endMinutes);
  if (currentSelfStudyPeriod) {
    try {
      const entries = await searchSelfStudy({ date: localDateStr(now) });
      const mine = entries.find(
        e => e.period === currentSelfStudyPeriod.period &&
          e.student.grade === identity.grade && e.student.classNo === identity.classNo && e.student.number === identity.number
      );
      if (mine) return { kind: 'selfstudy', identity, period: currentSelfStudyPeriod.period, roomName: mine.room?.name ?? '알 수 없음', seatName: mine.seat?.name ?? undefined };
      return { kind: 'no-selfstudy', identity, period: currentSelfStudyPeriod.period };
    } catch {
      // self-study lookup failed — fall through to the homeroom default below
    }
  }

  if (gridDay >= 0 && gridDay <= 4) {
    try {
      const res = await fetch(`/api/timetable?grade=${identity.grade}&class=${identity.classNo}`);
      if (res.ok) {
        const data = await res.json();
        const periods = parseClassTimes(data.times || []);
        for (let i = 0; i < periods.length; i++) {
          const start = periods[i].startMinutes;
          const end = i + 1 < periods.length ? periods[i + 1].startMinutes : start + ASSUMED_CLASS_PERIOD_MINUTES;
          if (nowMinutes >= start && nowMinutes < end) {
            const cell = data.grid?.[gridDay]?.[periods[i].period];
            if (cell) return { kind: 'class', identity, period: periods[i].period, subject: cell.subject, teacher: cell.teacher };
            break; // no class this period (gap) — fall through to the plain homeroom default
          }
        }
      }
    } catch {
      // comcigan is a scraped third-party site and can be flaky — fall through to homeroom
    }
  }

  return { kind: 'class', identity };
}

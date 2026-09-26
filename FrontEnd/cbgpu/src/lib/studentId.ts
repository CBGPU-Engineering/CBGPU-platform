/**
 * 학번 형식 검증. 4자리: 첫자리 학년(1~3), 둘째자리 반(1~3), 뒤 두자리는 번호라서
 * 00~99 아무 값이나 허용 (자릿수만 맞으면 됨 — 실제 존재하는 번호인지는 검사하지 않음).
 */
export function isValidStudentId(value: string): boolean {
  return /^[1-3][1-3]\d{2}$/.test(value.trim());
}

export const STUDENT_ID_HINT = '학번 4자리 (예: 2309 = 2학년 3반 9번)';

/** 학번 앞 두 자리에서 학년/반을 뽑는다. 형식이 아니면 null. */
export function parseStudentGradeClass(studentId?: string | null): { grade: number; cls: number } | null {
  if (!studentId || studentId.length < 2) return null;
  const grade = +studentId[0];
  const cls = +studentId[1];
  if (grade < 1 || grade > 3 || cls < 1) return null;
  return { grade, cls };
}

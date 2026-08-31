/**
 * 학번 형식 검증. 4자리: 첫자리 학년(1~3), 둘째자리 반(1~3), 뒤 두자리는 번호라서
 * 00~99 아무 값이나 허용 (자릿수만 맞으면 됨 — 실제 존재하는 번호인지는 검사하지 않음).
 */
export function isValidStudentId(value: string): boolean {
  return /^[1-3][1-3]\d{2}$/.test(value.trim());
}

export const STUDENT_ID_HINT = '학번 4자리 (예: 2309 = 2학년 3반 9번)';

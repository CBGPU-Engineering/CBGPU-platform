export type ContestFieldType = 'file' | 'link' | 'text';
export type ContestField = {
  id: string;
  type: ContestFieldType;
  label: string;
  description: string;
  required: boolean;
  extensions: string;
  max_size_mb: number;
};
export type Contest = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  ends_at: string | null;
  is_open: boolean;
  fields: ContestField[];
  created_at: string;
};
export type SubmittedFile = { path: string; name: string; size: number };
export type ContestAnswers = Record<string, string | SubmittedFile>;
export type ContestSubmission = {
  contest_id: string;
  user_id: string;
  participant_name: string;
  student_id: string;
  answers: ContestAnswers;
  submitted_at: string;
};

export const FIELD_LABELS: Record<ContestFieldType, string> = { file: '파일', link: '링크', text: '텍스트' };
export const CONTEST_BUCKET = 'contest-submissions';
export const MAX_FILE_MB = 50;
export const MAX_FIELDS = 30;
export function remainingTime(endsAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
  if (!seconds) return '마감되었어요';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  return `${days ? `${days}일 ` : ''}${hours}시간 ${minutes}분 ${seconds % 60}초 남음`;
}
export const contestClosed = (contest: Pick<Contest, 'is_open' | 'ends_at'>, now = Date.now()) =>
  !contest.is_open || (!!contest.ends_at && new Date(contest.ends_at).getTime() <= now);

export function formatContestDate(value: string | null) {
  return value ? new Date(value).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }) + ' (한국 시간)' : '마감 제한 없음';
}

// datetime-local is deliberately interpreted in Korea time, regardless of the device timezone.
export function deadlineToISO(value: string) {
  return value ? new Date(`${value}+09:00`).toISOString() : null;
}

export function deadlineToInput(value: string | null) {
  if (!value) return '';
  return new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 19);
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !!url.hostname && !/\s/.test(value);
  } catch { return false; }
}

export function fileError(file: Pick<File, 'name' | 'size'>, field: ContestField) {
  if (!file.size) return '빈 파일은 제출할 수 없어요.';
  if (file.size > field.max_size_mb * 1024 * 1024) return `${field.label}: 파일은 ${field.max_size_mb}MB 이하여야 해요.`;
  const allowed = field.extensions.split(',').map(ext => ext.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.some(ext => file.name.toLowerCase().endsWith(ext))) {
    return `${field.label}: ${allowed.join(', ')} 형식의 파일을 선택해 주세요.`;
  }
  return null;
}

export function validateAnswers(fields: ContestField[], answers: ContestAnswers, files: Record<string, File> = {}) {
  for (const field of fields) {
    const answer = answers[field.id];
    const file = files[field.id];
    const present = field.type === 'file' ? !!file || (typeof answer === 'object' && !!answer.path) : typeof answer === 'string' && !!answer.trim();
    if (field.required && !present) return `${field.label} 항목을 제출해 주세요.`;
    if (field.type === 'file' && file) {
      const error = fileError(file, field);
      if (error) return error;
    }
    if (typeof answer === 'string' && answer.trim()) {
      if (field.type === 'link' && (!isHttpUrl(answer.trim()) || answer.length > 2000)) return `${field.label}: 올바른 http 또는 https 링크를 입력해 주세요.`;
      if (field.type === 'text' && answer.length > 10000) return `${field.label}: 10,000자 이내로 입력해 주세요.`;
    }
  }
  return null;
}

export function contestError(error: unknown) {
  const message = error instanceof Error ? error.message : (error as { message?: string })?.message;
  if (message?.includes('schema cache') || message?.includes('does not exist')) return '대회 기능의 데이터베이스 설정이 아직 완료되지 않았어요. 관리자에게 문의해 주세요.';
  if (message?.includes('CONTEST_CLOSED')) return '제출이 마감되었어요. 입력 내용은 유지되니 호스트에게 문의해 주세요.';
  return message || '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

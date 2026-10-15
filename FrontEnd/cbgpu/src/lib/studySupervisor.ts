export const SUPERVISOR_SOURCE = 'https://script.google.com/macros/s/AKfycbzQJ6tHq5yhgnfN_TjL96zSUD8ug28famlojcv9J-6kDTMqfVkezZgcikD7JOyywePu/exec';

export function koreaDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// Parse the rendered card, never script source or a cached name from another day.
export function parseSupervisor(text: string, date: string): string[] | null {
  if (!text.includes('오늘의 자습 감독') || !text.includes('오늘의 담당 선생님')) return null;
  const match = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (!match || `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` !== date) return null;
  const card = text.split('오늘의 담당 선생님')[1].split('감독 일정')[0];
  const names = [...card.matchAll(/([가-힣]{2,10})\s*선생님/g)].map(m => m[1]);
  return names.length ? [...new Set(names)] : null;
}

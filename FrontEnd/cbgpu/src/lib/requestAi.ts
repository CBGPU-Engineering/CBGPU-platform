import { supabase } from '@/lib/supabase';

export type AiMode = 'tags' | 'poll_insight' | 'daily' | 'news' | 'study_tags' | 'timetable';

export async function requestAi(mode: AiMode, input: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('로그인이 필요합니다.');
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ mode, input: input.slice(0, 4000) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'AI 요청에 실패했습니다.');
  return data.result;
}

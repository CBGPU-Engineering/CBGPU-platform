'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useCachedAi } from '@/lib/useCachedAi';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import { parseStudentGradeClass } from '@/lib/studentId';

const MAX_P = 7;
const PERIODS = Array.from({ length: MAX_P }, (_, i) => i + 1);

function localYmd() {
  const date = new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

const PRINT_LABEL: Record<string, string> = {
  pending: '접수 대기', accepted: '접수됨', queued: '출력 대기', printing: '출력 중',
};
const LASER_LABEL: Record<string, string> = {
  pending: '접수 대기', accepted: '접수됨', in_progress: '작업 중',
};

export default function DailyBriefing() {
  const { user, profile } = useAuth();
  const [date] = useState(localYmd);
  const [lunch, setLunch] = useState<string[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [timetableSubjects, setTimetableSubjects] = useState<string[] | null>(null);
  const [gpuStatus, setGpuStatus] = useState<string | null>(null);
  const [makingStatus, setMakingStatus] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      fetch(`/api/meal?date=${date}`, { signal: controller.signal }).then(response => response.json()),
      fetch('/api/school-news?type=notice', { signal: controller.signal }).then(response => response.json()),
    ]).then(([mealResult, newsResult]) => {
      if (controller.signal.aborted) return;
      if (mealResult.status === 'fulfilled') {
        const meal = mealResult.value?.meals?.find((item: { type: string }) => item.type === '중식');
        setLunch(Array.isArray(meal?.items) ? meal.items.slice(0, 5) : []);
      }
      if (newsResult.status === 'fulfilled') {
        setNotices((newsResult.value?.items ?? []).slice(0, 3).map((item: { title: string }) => item.title));
      }
      setLoaded(true);
    });
    return () => controller.abort();
  }, [date]);

  // 오늘 시간표: 본인 학년/반의 오늘 요일 과목만 뽑는다. 주말(-1)이거나 학번이 없으면 건너뜀.
  useEffect(() => {
    const own = parseStudentGradeClass(profile?.student_id);
    const todayWd = (() => { const d = new Date().getDay(); return d === 0 ? -1 : d - 1; })();
    if (!own || todayWd < 0 || todayWd > 4) { setTimetableSubjects(own ? [] : null); return; }
    const controller = new AbortController();
    fetch(`/api/timetable?grade=${own.grade}&class=${own.cls}`, { signal: controller.signal })
      .then(res => res.json())
      .then(json => {
        if (controller.signal.aborted) return;
        const grid = json?.grid ?? {};
        const subjects = PERIODS.map(p => grid[todayWd]?.[p]?.subject).filter(Boolean);
        setTimetableSubjects(subjects);
      })
      .catch(() => setTimetableSubjects([]));
    return () => controller.abort();
  }, [profile?.student_id]);

  // 오늘 GPU 예약(있을 때만) — 승인됐거나 승인 대기 중인 것 중 오늘과 겹치는 가장 이른 것.
  useEffect(() => {
    if (!user) return;
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
    supabase
      .from('reservations')
      .select('gpu_id, start_time, end_time, status')
      .eq('user_id', user.id)
      .in('status', ['approved', 'pending'])
      .lte('start_time', dayEnd.toISOString())
      .gte('end_time', dayStart.toISOString())
      .order('start_time', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        const r = data?.[0];
        if (!r) { setGpuStatus(null); return; }
        const label = r.status === 'approved' ? '예약됨' : '승인 대기 중';
        setGpuStatus(`GPU #${r.gpu_id} · ${fmtTime(r.start_time)}~${fmtTime(r.end_time)} ${label}`);
      });
  }, [user]);

  // 제작 현황(있을 때만) — 진행 중인 3D프린팅/레이저 신청 중 가장 최근 것 하나.
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('print_jobs').select('status, plates_completed, plate_count')
        .eq('user_id', user.id).in('status', ['pending', 'accepted', 'queued', 'printing'])
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('laser_jobs').select('status')
        .eq('user_id', user.id).in('status', ['pending', 'accepted', 'in_progress'])
        .order('created_at', { ascending: false }).limit(1),
    ]).then(([printRes, laserRes]) => {
      const p = printRes.data?.[0];
      const l = laserRes.data?.[0];
      if (p) {
        const progress = p.status === 'printing' ? ` (${p.plates_completed}/${p.plate_count} 플레이트)` : '';
        setMakingStatus(`3D프린팅 · ${PRINT_LABEL[p.status] ?? p.status}${progress}`);
      } else if (l) {
        setMakingStatus(`레이저 커팅 · ${LASER_LABEL[l.status] ?? l.status}`);
      } else {
        setMakingStatus(null);
      }
    });
  }, [user]);

  const inputParts = [
    `날짜: ${date}`,
    `오늘 중식: ${lunch.join(', ') || '정보 없음'}`,
    `최근 공지 제목: ${notices.join(' / ') || '정보 없음'}`,
  ];
  if (timetableSubjects !== null) {
    inputParts.push(`오늘 시간표: ${timetableSubjects.length ? timetableSubjects.join(', ') : '없음(주말/방학 등)'}`);
  }
  if (gpuStatus) inputParts.push(`GPU 예약: ${gpuStatus}`);
  if (makingStatus) inputParts.push(`제작 현황: ${makingStatus}`);
  const input = loaded ? inputParts.join('\n') : '';
  const insight = useCachedAi('daily', input, `home:${date}`, !!input);
  if (!loaded || !input) return null;

  return (
    <section className="rounded-[28px] border border-primary/15 bg-card p-5 shadow-sm sm:p-6" aria-label="오늘 한눈에">
      <div className="mb-3 flex items-center gap-2"><Sparkles className="size-5 text-primary" /><h2 className="text-lg font-black">오늘 한눈에</h2></div>
      {insight ? (
        <p className="text-sm leading-relaxed">{insight}</p>
      ) : (
        <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">급식·공지·시간표·GPU/제작 현황을 참고한 AI 요약이에요. 자세한 내용은 각 페이지에서 확인하세요.</p>
    </section>
  );
}

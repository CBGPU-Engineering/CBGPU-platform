'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import {
  Cpu, CalendarDays, BookOpen, UtensilsCrossed, Vote,
  NotebookPen, Users, Gamepad2, Wrench, Newspaper,
} from 'lucide-react';

/** 서버/클라이언트 시각이 다를 수 있어 SSR에서는 중립적인 기본값만 쓰고,
 * 마운트 후 클라이언트 시계 + 날씨로만 인사를 골라서 하이드레이션 불일치를 피한다 */
type Bracket = 'dawn' | 'morning' | 'forenoon' | 'lunch' | 'afternoon' | 'evening' | 'night';

function timeBracket(hour: number): Bracket {
  if (hour >= 5 && hour < 9) return 'morning';
  if (hour >= 9 && hour < 12) return 'forenoon';
  if (hour >= 12 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 21) return 'evening';
  if (hour >= 21 && hour < 24) return 'night';
  return 'dawn';
}

const TIME_PHRASES: Record<Bracket, string[]> = {
  dawn:      ['깊은 밤이네요', '아직 안 잤네요', '푹 쉬어요'],
  morning:   ['좋은 아침이에요', '활기찬 아침이네요', '상큼한 아침이에요'],
  forenoon:  ['활기찬 오전이네요', '집중하기 좋은 오전이에요', '오전도 파이팅이에요'],
  lunch:     ['점심 맛있게 드셨나요', '든든하게 챙겨 드세요', '맛있는 시간이네요'],
  afternoon: ['나른한 오후네요', '오후도 힘내봐요', '오후가 깊어가네요'],
  evening:   ['편안한 저녁이에요', '저녁 시간이 왔네요', '하루 마무리는 잘하고 있나요'],
  night:     ['늦은 밤이네요', '오늘 하루도 고생했어요', '슬슬 쉴 시간이에요'],
};

const RAIN_PHRASES: Record<Bracket, string[]> = {
  dawn:      ['비 내리는 새벽이네요', '새벽부터 비가 오네요'],
  morning:   ['비 오는 아침이에요', '아침부터 비가 내리네요'],
  forenoon:  ['비 오는 오전이네요', '오전부터 비가 오네요'],
  lunch:     ['비 오는 점심이네요', '비 오는 날 점심이에요'],
  afternoon: ['비 오는 오후네요', '오후에 비가 내리네요'],
  evening:   ['비 오는 저녁이에요', '저녁에 비가 오네요'],
  night:     ['비 오는 밤이네요', '밤에 비가 내리네요'],
};

const SNOW_PHRASES = ['눈이 내리고 있어요', '하얗게 눈 내리는 날이네요', '눈 오는 날이에요'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

/** 청주 좌표 — 별도 위치 권한 요청 없이 학교 지역 기준 날씨만 가볍게 참고용으로 쓴다 */
const CHEONGJU = { lat: 36.64, lon: 127.49 };
function weatherCategory(code: number): 'rain' | 'snow' | null {
  if ([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code)) return 'rain';
  if ([71,73,75,77,85,86].includes(code)) return 'snow';
  return null;
}

/** 차가운 톤으로 통일한 은은한 팔레트 — 채도 낮은 400 톤 + 배경 /10 으로 너무 알록달록하지 않게 */
const FEATURES = [
  { href: '/study', label: '자습신청', icon: BookOpen, color: 'text-blue-400 bg-blue-400/10' },
  { href: '/timetable', label: '시간표', icon: CalendarDays, color: 'text-indigo-400 bg-indigo-400/10' },
  { href: '/meal', label: '급식', icon: UtensilsCrossed, color: 'text-amber-400 bg-amber-400/10' },
  { href: '/polls', label: '투표', icon: Vote, color: 'text-violet-400 bg-violet-400/10' },
  { href: '/notes', label: '연구노트', icon: NotebookPen, color: 'text-teal-400 bg-teal-400/10' },
  { href: '/match', label: '스터디 매칭', icon: Users, color: 'text-sky-400 bg-sky-400/10' },
  { href: '/dashboard', label: 'GPU 대여', icon: Cpu, color: 'text-slate-400 bg-slate-400/10' },
  { href: '/tools', label: '도구', icon: Wrench, color: 'text-cyan-400 bg-cyan-400/10' },
  { href: '/games', label: 'Arcade', icon: Gamepad2, color: 'text-violet-400 bg-violet-400/10' },
  { href: '/feed', label: 'Feed', icon: Newspaper, color: 'text-blue-400 bg-blue-400/10' },
];

export default function Home() {
  const { user, profile } = useAuth();
  const firstName = profile?.full_name?.trim() || null;
  const [greeting, setGreeting] = useState('안녕하세요');

  useEffect(() => {
    const bracket = timeBracket(new Date().getHours());
    setGreeting(pick(TIME_PHRASES[bracket]));

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${CHEONGJU.lat}&longitude=${CHEONGJU.lon}&current_weather=true`)
      .then(res => res.json())
      .then(data => {
        const cat = weatherCategory(data?.current_weather?.weathercode);
        if (cat === 'rain') setGreeting(pick(RAIN_PHRASES[bracket]));
        else if (cat === 'snow') setGreeting(pick(SNOW_PHRASES));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {profile?.avatar_url && (
          <>
            <img src={profile.avatar_url} alt="" className="size-16 md:size-20 rounded-full object-cover ring-2 ring-background shadow-md shrink-0" />
            <div className="w-px h-16 md:h-20 bg-border shrink-0" />
          </>
        )}
        <div className="space-y-0.5 min-w-0">
          <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight break-keep">
            {firstName ? `${firstName}님, ${greeting}` : `${greeting},`}
          </p>
          <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-muted-foreground">
            오늘은 뭘 도와드릴까요?
          </p>
        </div>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {FEATURES.map((f, i) => (
          <Link
            key={f.href}
            href={f.href}
            style={{ animationDelay: `${i * 40}ms` }}
            className="tilt-3d flex flex-col items-start gap-3 p-5 rounded-[28px] bg-card ring-1 ring-foreground/5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards"
          >
            <span className={`flex items-center justify-center size-11 rounded-2xl ${f.color}`}>
              <f.icon className="size-5" strokeWidth={2} />
            </span>
            <span className="text-sm font-bold">{f.label}</span>
          </Link>
        ))}
      </section>

      {!user && (
        <Link
          href="/auth/signup"
          className="tilt-3d block rounded-[28px] bg-primary text-primary-foreground p-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
          style={{ animationDelay: '400ms' }}
        >
          <p className="font-black text-lg">아직 계정이 없으신가요?</p>
          <p className="text-sm opacity-80 mt-1">가입하고 학교생활에 필요한 모든 걸 한 곳에서 확인하세요 →</p>
        </Link>
      )}
    </div>
  );
}

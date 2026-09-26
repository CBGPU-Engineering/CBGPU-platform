'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import {
  Cpu, CalendarDays, BookOpen, UtensilsCrossed, Vote,
  NotebookPen, Users, Gamepad2, Wrench, Newspaper, Server, Printer, Music,
} from 'lucide-react';
import { isNativeApp, onNativeBridgeReady } from '@/lib/nativeBridge';
import LaunchPage from '@/components/LaunchPage';
import { LoadingSpinner } from '@/components/ui/spinner';
import DailyBriefing from '@/components/DailyBriefing';

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
  dawn: [
    '깊은 밤이네요', '아직 안 잤네요', '푹 쉬어요', '새벽이 깊었네요', '다들 잠든 시간이에요',
    '조용한 새벽이에요', '별이 빛나는 시간이네요', '새벽 공기가 차갑죠', '오늘도 늦게까지 깨어있네요', '곧 해가 뜨겠어요',
    '새벽 감성 충전 중인가요', '모두가 잠든 고요한 시간이에요', '새벽별이 보이나요', '졸린 눈 비비고 있나요', '밤이 끝나가고 있어요',
    '어둠이 깊어지는 시간이에요', '잠들기 전 마지막 확인인가요', '일찍 일어나신 거면 대단해요', '밤샘 중이신가요', '고요한 새벽 시간이네요',
  ],
  morning: [
    '좋은 아침이에요', '활기찬 아침이네요', '상큼한 아침이에요', '오늘도 좋은 하루 시작해봐요', '아침 햇살이 좋네요',
    '눈 뜨자마자 확인이라니 부지런하시네요', '아침밥 챙겨 드셨나요', '일어나자마자 고생이 많아요', '새로운 하루가 시작됐어요', '아침 공기가 맑아요',
    '하루의 시작을 함께해요', '등교 준비 잘 하고 있나요', '아침형 인간이시네요', '커피 한 잔 어때요', '오늘 하루도 잘 부탁해요',
    '따뜻한 아침이길 바라요', '상쾌하게 시작해봐요', '아침부터 부지런하네요', '잠은 잘 잤나요', '활기차게 하루를 열어봐요',
  ],
  forenoon: [
    '활기찬 오전이네요', '집중하기 좋은 오전이에요', '오전도 파이팅이에요', '수업 듣느라 고생이 많아요', '오전 시간 잘 보내고 있나요',
    '슬슬 집중력이 오르는 시간이죠', '한창 바쁠 시간이네요', '오전 수업 끝나가나요', '머리가 맑은 시간이에요', '오전 컨디션은 어때요',
    '활력 넘치는 시간이네요', '쉬는 시간에 들어왔나요', '오늘 오전도 잘 견디고 있나요', '집중 모드 가동 중인가요', '오전이 절반 지나갔어요',
    '점심까지 얼마 안 남았어요', '배고파지는 시간이죠', '오전 수업 잘 따라가고 있나요', '컨디션 괜찮아요', '활기차게 보내봐요',
  ],
  lunch: [
    '점심 맛있게 드셨나요', '든든하게 챙겨 드세요', '맛있는 시간이네요', '급식 메뉴 확인해봤나요', '든든히 먹고 힘내요',
    '점심시간 잘 보내고 있나요', '밥 먹을 시간이에요', '식사하셨어요', '맛있게 드세요', '배는 안 고파요',
    '오늘 급식 뭐 나왔어요', '점심 먹고 나른해지는 시간이죠', '식곤증 조심하세요', '든든하게 먹어야 오후도 버텨요', '점심시간 끝나가나요',
    '디저트도 챙겼나요', '맛있는 점심이길 바라요', '식사 후 산책은 어때요', '오늘 메뉴 맘에 들었어요', '든든한 한 끼였길 바라요',
  ],
  afternoon: [
    '나른한 오후네요', '오후도 힘내봐요', '오후가 깊어가네요', '슬슬 졸린 시간이죠', '커피 한 잔 생각나는 시간이에요',
    '오후 수업 잘 듣고 있나요', '졸음 참기 힘든 시간이죠', '하루의 절반을 잘 보냈어요', '오후 햇살이 따뜻하죠', '집중력이 떨어지는 시간이에요',
    '조금만 더 힘내요', '오후 컨디션은 어때요', '나른해도 힘내봐요', '하교까지 얼마 안 남았어요', '오늘 하루도 거의 다 왔어요',
    '오후 시간 잘 흘러가고 있나요', '잠깨는 시간이 필요하죠', '활력 충전이 필요한 시간이에요', '슬슬 지칠 시간이죠', '오후도 잘 버티고 있어요',
  ],
  evening: [
    '편안한 저녁이에요', '저녁 시간이 왔네요', '하루 마무리는 잘하고 있나요', '저녁 식사 하셨나요', '오늘 하루도 고생했어요',
    '노을이 예쁜 시간이에요', '하루를 마무리하는 시간이죠', '저녁 시간 잘 보내고 있나요', '오늘 하루 어땠어요', '저녁 메뉴는 뭐예요',
    '하루가 거의 끝나가네요', '편하게 쉬고 있나요', '저녁 노을 보셨어요', '자습 준비하고 있나요', '하루 정리 잘 하고 있어요',
    '저녁 시간이 평화롭네요', '오늘도 무사히 보냈네요', '저녁밥은 챙겼나요', '노곤한 저녁이네요', '하루를 잘 마무리해봐요',
  ],
  night: [
    '늦은 밤이네요', '오늘 하루도 고생했어요', '슬슬 쉴 시간이에요', '밤이 깊어가네요', '오늘 하루 정리 잘 했나요',
    '자습 끝나고 쉬는 시간인가요', '하루의 끝이 보이네요', '너무 늦게까지 깨어있지 마요', '오늘도 무사히 끝나가네요', '잘 시간이 다가오고 있어요',
    '내일을 위해 푹 쉬어요', '밤하늘이 예쁜 시간이에요', '오늘 하루 어떠셨어요', '늦은 시간까지 고생이 많아요', '조용한 밤이네요',
    '하루를 잘 마쳤나요', '자기 전 마지막 확인인가요', '늦은 시간이니 곧 쉬어요', '오늘도 잘 버텼어요', '별이 보이는 밤이에요',
  ],
};

const RAIN_PHRASES: Record<Bracket, string[]> = {
  dawn:      ['비 내리는 새벽이네요', '새벽부터 비가 오네요', '빗소리가 들리는 새벽이에요', '조용히 비가 내려요', '새벽비가 촉촉하네요', '비 오는 새벽 감성이네요'],
  morning:   ['비 오는 아침이에요', '아침부터 비가 내리네요', '우산 챙겼나요', '비 소리에 잠이 깼나요', '빗속 등교 조심하세요', '촉촉한 아침이네요'],
  forenoon:  ['비 오는 오전이네요', '오전부터 비가 오네요', '창밖에 비가 내려요', '우산 잘 챙겼어요', '빗소리 들리는 오전이에요', '비 와서 더 나른하죠'],
  lunch:     ['비 오는 점심이네요', '비 오는 날 점심이에요', '우산 들고 이동하느라 고생이에요', '빗속에서도 든든히 먹어요', '비 오니 따뜻한 음식이 생각나죠', '촉촉한 점심시간이네요'],
  afternoon: ['비 오는 오후네요', '오후에 비가 내리네요', '빗소리에 더 나른해지죠', '우산 없이 나가지 마요', '비 와서 분위기 있는 오후예요', '창밖 빗소리가 좋네요'],
  evening:   ['비 오는 저녁이에요', '저녁에 비가 오네요', '하교길 우산 챙겼나요', '비 오는 저녁 노을은 못 보겠네요', '빗소리 들으며 하루 마무리해요', '촉촉한 저녁이네요'],
  night:     ['비 오는 밤이네요', '밤에 비가 내리네요', '빗소리 들으며 쉬어요', '우산 소리가 정겹네요', '비 오는 밤은 운치있죠', '창문 닫고 푹 쉬어요'],
};

const SNOW_PHRASES = [
  '눈이 내리고 있어요', '하얗게 눈 내리는 날이네요', '눈 오는 날이에요', '첫눈인가요', '함박눈이 내리네요',
  '눈길 조심하세요', '새하얀 풍경이네요', '눈 쌓이는 소리가 들리나요', '눈사람 만들고 싶은 날이에요', '포근하게 입고 다녀요',
  '눈 내리는 풍경이 예쁘네요', '미끄러우니 조심하세요', '눈이 펑펑 내려요', '겨울 분위기가 물씬 나네요', '눈꽃이 예쁘게 피었어요',
  '따뜻하게 챙겨 입어요', '눈 오는 날 특유의 설렘이 있죠', '발자국 남기고 싶은 날이네요',
];

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
  { href: '/wakeup', label: '기상송', icon: Music, color: 'text-pink-400 bg-pink-400/10' },
  { href: '/polls', label: '투표', icon: Vote, color: 'text-violet-400 bg-violet-400/10' },
  { href: '/notes', label: '연구노트', icon: NotebookPen, color: 'text-teal-400 bg-teal-400/10' },
  { href: '/match', label: '스터디 매칭', icon: Users, color: 'text-sky-400 bg-sky-400/10' },
  { href: '/dashboard', label: 'GPU 대여', icon: Cpu, color: 'text-slate-400 bg-slate-400/10' },
  { href: '/server',    label: '서버 배포', icon: Server, color: 'text-emerald-400 bg-emerald-400/10' },
  { href: '/manufacturing', label: '제작', icon: Printer, color: 'text-orange-400 bg-orange-400/10' },
  { href: '/tools', label: '도구', icon: Wrench, color: 'text-cyan-400 bg-cyan-400/10' },
  { href: '/games', label: 'Arcade', icon: Gamepad2, color: 'text-violet-400 bg-violet-400/10' },
  { href: '/feed', label: 'Feed', icon: Newspaper, color: 'text-blue-400 bg-blue-400/10' },
];

export default function Home() {
  const { user, profile, isLoading } = useAuth();
  const firstName = profile?.full_name?.trim() || null;
  const [greeting, setGreeting] = useState('안녕하세요');
  // 앱(WebView) 안에서는 로그인 여부와 상관없이 절대 런치 페이지를 보여주지
  // 않는다 — 이미 앱을 쓰고 있는 사람한테 "시작해보세요"는 말이 안 되니까.
  // isNativeApp()은 브릿지가 아직 주입되기 전이면 false를 반환하므로,
  // onNativeBridgeReady로 뒤늦게 확정되는 경우까지 함께 잡는다.
  const [native, setNative] = useState(isNativeApp());

  useEffect(() => {
    if (native) return;
    return onNativeBridgeReady(() => setNative(true));
  }, [native]);

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

  // 웹 + 로그아웃 상태에서만 런치 페이지 — 로그인했거나 앱 안이면 평소 대시보드.
  if (!native && !isLoading && !user) {
    return <LaunchPage />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size={56} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 ease-[var(--ease-spring)]">
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

      {user && <DailyBriefing />}

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {FEATURES.map((f, i) => (
          <Link
            key={f.href}
            href={f.href}
            style={{ animationDelay: `${80 + i * 50}ms` }}
            className="tilt-3d flex flex-col items-start gap-3 p-5 rounded-[28px] bg-card ring-1 ring-foreground/5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500 ease-[var(--ease-spring)] fill-mode-backwards"
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
          className="tilt-3d block rounded-[28px] bg-primary text-primary-foreground p-6 animate-in fade-in slide-in-from-bottom-2 duration-500 ease-[var(--ease-spring)] fill-mode-backwards"
          style={{ animationDelay: `${80 + FEATURES.length * 50}ms` }}
        >
          <p className="font-black text-lg">아직 계정이 없으신가요?</p>
          <p className="text-sm opacity-80 mt-1">가입하고 학교생활에 필요한 모든 걸 한 곳에서 확인하세요 →</p>
        </Link>
      )}
    </div>
  );
}

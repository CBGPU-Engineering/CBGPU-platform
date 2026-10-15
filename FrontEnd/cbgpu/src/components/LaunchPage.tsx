'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  CalendarDays, UtensilsCrossed, Cpu, Printer, Vote, NotebookPen, Users, Newspaper, Server, Smartphone,
  BellRing, LayoutGrid, Zap, KeyRound,
} from 'lucide-react';
import { PhoneMockup } from './PhoneMockup';
import { ScrollReveal } from './ui/scroll-reveal';

/**
 * Logged-out web visitors land here instead of the personalized dashboard —
 * loosely modeled on Apple's product-page rhythm (apple.com/kr/macbook-neo):
 * one big confident hero statement, then a handful of generously-spaced
 * alternating feature sections, then a single closing CTA. It's a
 * platform promo, not just an app-install pitch — every CTA offers both
 * "web으로 시작하기" and "앱 설치하기" side by side, deliberately not steering
 * toward one. No native app counterpart on purpose — this is only ever
 * shown on the web (see page.tsx), an app user is already past the point
 * of needing to be sold on the idea.
 */

// Play Store 심사 전이라 앱 설치 버튼은 일단 /download(→ APK 직접 다운로드)로
// 보낸다 — 나중에 스토어 링크가 생기면 이 라우트만 그쪽으로 바꾸면 됨.

const OVERVIEW = [
  { href: '/study', label: '자습신청', icon: NotebookPen },
  { href: '/timetable', label: '시간표', icon: CalendarDays, img: '/img/screens/timetable.png' },
  { href: '/meal', label: '급식', icon: UtensilsCrossed, img: '/img/screens/meal.png' },
  { href: '/polls', label: '투표', icon: Vote },
  { href: '/match', label: '스터디 매칭', icon: Users, img: '/img/screens/match.png' },
  { href: '/dashboard', label: 'GPU 대여', icon: Cpu, img: '/img/screens/gpu.png' },
  { href: '/server', label: '서버 배포', icon: Server },
  { href: '/manufacturing', label: '제작', icon: Printer, img: '/img/screens/manufacturing.png' },
  { href: '/feed', label: 'Feed', icon: Newspaper, img: '/img/screens/feed.png' },
];

const APP_PERKS = [
  { Icon: BellRing, label: '놓치지 않는 알림', desc: '자습신청 마감, 급식시간, 제작 완료까지 정확한 시각에 알려줘요. 앱을 꺼둬도 동작해요.' },
  { Icon: LayoutGrid, label: '홈 화면 위젯', desc: 'GPU 상태, 3D프린터 현황, 오늘 시간표·급식을 앱을 열지 않고 홈 화면에서 바로 확인해요.' },
  { Icon: Zap, label: '한 번에 실행', desc: '브라우저 주소창 검색 없이, 홈 화면 아이콘 탭 한 번으로 바로 CBGPU를 열어요.' },
  { Icon: KeyRound, label: '로그인 유지', desc: '매번 다시 로그인할 필요 없이, 앱을 열면 바로 이용할 수 있어요.' },
];

export default function LaunchPage() {
  return (
    <ScrollReveal className="-mx-4 md:-mx-6 -my-10">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="px-6 pt-20 pb-24 md:pt-32 md:pb-36 text-center space-y-8 max-w-3xl mx-auto">
        <Image src="/img/cbgpu-logo.png" alt="CBGPU" width={72} height={72} className="mx-auto" />
        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-normal text-muted-foreground">충북과학고 학생 종합 플랫폼</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.15]">
            학교 앱,<br />몇 개나 깔았어요?
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
            {['급식은 카톡', '시간표는 나이스', 'GPU는 단톡방'].map((t) => (
              <span key={t} className="text-sm font-bold text-muted-foreground line-through px-2.5 py-1 rounded-full bg-muted/50">
                {t}
              </span>
            ))}
          </div>
          <p className="text-xl md:text-2xl font-semibold tracking-tight">
            이제 <span className="text-primary">CBGPU 하나</span>로 끝나요.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4 pt-2">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="bg-primary text-primary-foreground font-semibold text-base tracking-normal px-8 py-4 rounded-full transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
            >
              웹으로 바로 시작하기
            </Link>
            <Link
              href="/download"
              className="flex items-center gap-2 bg-card ring-1 ring-foreground/10 font-semibold text-base tracking-normal px-8 py-4 rounded-full transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
            >
              <Smartphone className="size-4" /> 앱 설치하기
            </Link>
          </div>
          <Link
            href="/auth/login"
            className="text-xs font-semibold tracking-normal text-muted-foreground hover:text-foreground transition-colors"
          >
            이미 계정이 있어요 · 로그인
          </Link>
        </div>
        <div className="pt-10">
          <PhoneMockup src="/img/screens/home.png" alt="CBGPU 홈 화면" width={300} />
        </div>
      </section>

      {/* ── Story section 1 ───────────────────────────────────────────── */}
      <section className="bg-muted py-24 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <p className="text-sm font-semibold tracking-normal text-primary">쉬는 시간마다 반복되던 그 질문</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.25]">&quot;오늘 뭐임?&quot;<br />이제 안 물어봐도 돼요</h2>
            <p className="text-muted-foreground text-base sm:text-lg font-normal leading-[1.65]">
              대강까지 실시간으로 반영되는 시간표와 오늘의 급식 메뉴, 자습신청 현황까지
              단톡방에 묻지 않고 한 곳에서 바로 확인하세요.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="">
              <PhoneMockup src="/img/screens/timetable.png" alt="CBGPU 시간표 화면" width={200} className="translate-y-4" />
            </div>
            <div className="">
              <PhoneMockup src="/img/screens/meal.png" alt="CBGPU 급식 화면" width={200} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Story section 2 (reversed) ────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div className="grid grid-cols-2 gap-4 items-end md:order-1 order-2">
            <div className="">
              <PhoneMockup src="/img/screens/gpu.png" alt="CBGPU GPU 예약 화면" width={200} className="translate-y-4" />
            </div>
            <div className="">
              <PhoneMockup src="/img/screens/manufacturing.png" alt="CBGPU 3D 프린터 제작 화면" width={200} />
            </div>
          </div>
          <div className="space-y-4 md:order-2 order-1">
            <p className="text-sm font-semibold tracking-normal text-primary">동아리 자원도 여기서</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.25]">GPU 서버부터<br />3D프린터까지</h2>
            <p className="text-muted-foreground text-base sm:text-lg font-normal leading-[1.65]">
              GPU 사용 시간을 직접 예약하고, 3D프린터·레이저 커팅 신청부터 완료까지
              진행 상황을 실시간으로 확인할 수 있어요.
            </p>
          </div>
        </div>
      </section>

      {/* ── Story section 3 ───────────────────────────────────────────── */}
      <section className="bg-muted py-24 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <p className="text-sm font-semibold tracking-normal text-primary">공지사항 캡쳐해서 공유하는 것도 이제 그만</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.25]">학교 공지부터<br />스터디 팀원까지</h2>
            <p className="text-muted-foreground text-base sm:text-lg font-normal leading-[1.65]">
              공지사항·가정통신문·학사일정을 한곳에서 모아 보고,
              같이 공부할 팀원도 관심 과목으로 바로 찾아보세요.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="">
              <PhoneMockup src="/img/screens/feed.png" alt="CBGPU Feed 화면" width={200} className="translate-y-4" />
            </div>
            <div className="">
              <PhoneMockup src="/img/screens/match.png" alt="CBGPU 스터디 매칭 화면" width={200} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Overview grid ─────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight">앱 {OVERVIEW.length}개 깔 필요 없이, 이거 하나</h2>
            <p className="text-muted-foreground font-medium">학교생활에 필요한 거의 모든 것이 여기 다 있어요</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {OVERVIEW.map(({ href, label, icon: Icon, img }) => (
              <div key={href} className="relative aspect-square rounded-2xl overflow-hidden bg-card ring-1 ring-foreground/5">
                {img ? (
                  <>
                    <Image src={img} alt={label} fill sizes="200px" className="object-cover object-top" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pt-6 pb-2 px-2">
                      <span className="text-sm font-semibold text-white text-center block drop-shadow">{label}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 size-full">
                    <Icon className="size-5 text-primary" strokeWidth={2} />
                    <span className="text-sm font-bold text-center">{label}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── App perks ──────────────────────────────────────────────────── */}
      <section className="bg-muted py-24 px-6">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <p className="text-sm font-semibold tracking-normal text-primary">웹도 좋지만, 앱이면 더 좋아요</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">앱에서만 되는 것들</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {APP_PERKS.map(({ Icon, label, desc }) => (
              <div key={label} className="p-5 rounded-2xl bg-card ring-1 ring-foreground/5 space-y-2">
                <span className="flex items-center justify-center size-10 text-foreground">
                  <Icon className="size-5" strokeWidth={2} />
                </span>
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-sm text-muted-foreground text-base sm:text-lg font-normal leading-[1.65]">{desc}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-center">
            <Link
              href="/download"
              className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold text-base tracking-normal px-8 py-4 rounded-full transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
            >
              <Smartphone className="size-4" /> 앱 설치하기
            </Link>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ────────────────────────────────────────────────── */}
      <section className="py-24 px-6 text-center space-y-6">
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">지금 바로 시작해보세요</h2>
        <p className="text-muted-foreground font-medium">가입은 1분이면 충분해요. 웹으로 바로, 또는 앱으로.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="bg-primary text-primary-foreground font-semibold text-base tracking-normal px-10 py-4 rounded-full transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
          >
            회원가입
          </Link>
          <Link
            href="/download"
            className="flex items-center gap-2 bg-card ring-1 ring-foreground/10 font-semibold text-base tracking-normal px-10 py-4 rounded-full transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
          >
            <Smartphone className="size-4" /> 앱 설치하기
          </Link>
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          <Link href="/download" className="underline underline-offset-2 hover:text-foreground transition-colors">앱 다운로드 페이지</Link> · <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors">개인정보처리방침</Link>
        </p>
      </section>
    </ScrollReveal>
  );
}

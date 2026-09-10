'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  CalendarDays, UtensilsCrossed, Cpu, Printer, Vote, NotebookPen, Users, Newspaper, Server, Smartphone,
} from 'lucide-react';
import { PhoneMockup } from './PhoneMockup';

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

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.cbgpu.cbgpu_app';

const OVERVIEW = [
  { href: '/study', label: '자습신청', icon: NotebookPen },
  { href: '/timetable', label: '시간표', icon: CalendarDays },
  { href: '/meal', label: '급식', icon: UtensilsCrossed },
  { href: '/polls', label: '투표', icon: Vote },
  { href: '/match', label: '스터디 매칭', icon: Users },
  { href: '/dashboard', label: 'GPU 대여', icon: Cpu },
  { href: '/server', label: '서버 배포', icon: Server },
  { href: '/manufacturing', label: '제작', icon: Printer },
  { href: '/feed', label: 'Feed', icon: Newspaper },
];

export default function LaunchPage() {
  return (
    <div className="-mx-4 md:-mx-6 -my-10">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="px-6 pt-20 pb-24 md:pt-32 md:pb-36 text-center space-y-8 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-[var(--ease-spring)]">
        <Image src="/img/cbgpu-logo.png" alt="CBGPU" width={72} height={72} className="mx-auto" />
        <div className="space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">충북과학고 학생 종합 플랫폼</p>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter italic leading-[0.95]">
            학교생활의 전부,<br />CBGPU
          </h1>
          <p className="text-lg text-muted-foreground font-medium max-w-md mx-auto pt-2">
            시간표부터 GPU 예약까지, 흩어져 있던 모든 걸 하나로.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4 pt-2">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="bg-primary text-primary-foreground font-black text-sm uppercase tracking-widest px-8 py-4 rounded-2xl shadow-xl shadow-primary/20 transition-transform active:scale-95 hover:scale-[1.02]"
            >
              웹으로 바로 시작하기
            </Link>
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-card ring-1 ring-foreground/10 font-black text-sm uppercase tracking-widest px-8 py-4 rounded-2xl shadow-sm transition-transform active:scale-95 hover:scale-[1.02]"
            >
              <Smartphone className="size-4" /> 앱 설치하기
            </a>
          </div>
          <Link
            href="/auth/login"
            className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            이미 계정이 있어요 · 로그인
          </Link>
        </div>
        <div className="pt-10 animate-in fade-in zoom-in-95 duration-1000 ease-[var(--ease-spring)]">
          <PhoneMockup src="/img/screens/home.png" alt="CBGPU 홈 화면" width={300} />
        </div>
      </section>

      {/* ── Story section 1 ───────────────────────────────────────────── */}
      <section className="bg-muted/30 py-24 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-[var(--ease-spring)]">
            <p className="text-[11px] font-black uppercase tracking-widest text-primary">매일 확인하는 것들</p>
            <h2 className="text-4xl font-black tracking-tight leading-tight">시간표, 급식,<br />자습신청까지</h2>
            <p className="text-muted-foreground font-medium leading-relaxed">
              대강까지 실시간으로 반영되는 시간표와 오늘의 급식 메뉴, 자습신청 현황을
              앱을 여러 개 오갈 필요 없이 한 곳에서 확인하세요.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="tilt-3d">
              <PhoneMockup src="/img/screens/timetable.png" alt="CBGPU 시간표 화면" width={200} className="translate-y-4" />
            </div>
            <div className="tilt-3d">
              <PhoneMockup src="/img/screens/meal.png" alt="CBGPU 급식 화면" width={200} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Story section 2 (reversed) ────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div className="grid grid-cols-2 gap-4 items-end md:order-1 order-2">
            <div className="tilt-3d">
              <PhoneMockup src="/img/screens/gpu.png" alt="CBGPU GPU 예약 화면" width={200} className="translate-y-4" />
            </div>
            <div className="tilt-3d">
              <PhoneMockup src="/img/screens/manufacturing.png" alt="CBGPU 3D 프린터 제작 화면" width={200} />
            </div>
          </div>
          <div className="space-y-4 md:order-2 order-1 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-[var(--ease-spring)]">
            <p className="text-[11px] font-black uppercase tracking-widest text-primary">동아리 자원도 여기서</p>
            <h2 className="text-4xl font-black tracking-tight leading-tight">GPU 서버부터<br />3D프린터까지</h2>
            <p className="text-muted-foreground font-medium leading-relaxed">
              GPU 사용 시간을 예약하고, 3D프린터·레이저 커팅 신청부터 완료까지
              진행 상황을 실시간으로 확인할 수 있어요.
            </p>
          </div>
        </div>
      </section>

      {/* ── Overview grid ─────────────────────────────────────────────── */}
      <section className="bg-muted/30 py-24 px-6">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black tracking-tight">이 모든 게 CBGPU 안에</h2>
            <p className="text-muted-foreground font-medium">학교생활에 필요한 거의 모든 것</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {OVERVIEW.map(({ href, label, icon: Icon }) => (
              <div key={href} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card ring-1 ring-foreground/5">
                <Icon className="size-5 text-primary" strokeWidth={2} />
                <span className="text-[11px] font-bold text-center">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ────────────────────────────────────────────────── */}
      <section className="py-24 px-6 text-center space-y-6">
        <h2 className="text-4xl md:text-5xl font-black tracking-tighter italic">지금 바로 시작해보세요</h2>
        <p className="text-muted-foreground font-medium">가입은 1분이면 충분해요. 웹으로 바로, 또는 앱으로.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="bg-primary text-primary-foreground font-black text-sm uppercase tracking-widest px-10 py-4 rounded-2xl shadow-xl shadow-primary/20 transition-transform active:scale-95 hover:scale-[1.02]"
          >
            회원가입
          </Link>
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-card ring-1 ring-foreground/10 font-black text-sm uppercase tracking-widest px-10 py-4 rounded-2xl shadow-sm transition-transform active:scale-95 hover:scale-[1.02]"
          >
            <Smartphone className="size-4" /> 앱 설치하기
          </a>
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          <Link href="/download" className="underline underline-offset-2 hover:text-foreground transition-colors">앱 다운로드 페이지</Link> · <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors">개인정보처리방침</Link>
        </p>
      </section>
    </div>
  );
}

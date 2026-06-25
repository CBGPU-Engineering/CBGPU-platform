'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import {
  Cpu, CalendarDays, BookOpen, UtensilsCrossed, Vote,
  NotebookPen, Users, Gamepad2, Wrench, Newspaper,
} from 'lucide-react';

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

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {profile?.avatar_url && (
          <>
            <img src={profile.avatar_url} alt="" className="size-16 md:size-20 rounded-full object-cover ring-2 ring-background shadow-md shrink-0" />
            <div className="w-px h-16 md:h-20 bg-border shrink-0" />
          </>
        )}
        <div className="space-y-0.5">
          <p className="text-2xl md:text-4xl font-black tracking-tight">
            {firstName ? `${firstName}님,` : '안녕하세요,'}
          </p>
          <p className="text-2xl md:text-4xl font-black tracking-tight text-muted-foreground">
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

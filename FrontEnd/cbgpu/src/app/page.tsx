'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import {
  Cpu, CalendarDays, BookOpen, UtensilsCrossed, Vote,
  NotebookPen, Users, Gamepad2, Wrench, Newspaper,
} from 'lucide-react';

const FEATURES = [
  { href: '/study', label: '자습신청', icon: BookOpen, color: 'text-blue-500 bg-blue-500/10' },
  { href: '/timetable', label: '시간표', icon: CalendarDays, color: 'text-violet-500 bg-violet-500/10' },
  { href: '/meal', label: '급식', icon: UtensilsCrossed, color: 'text-amber-500 bg-amber-500/10' },
  { href: '/polls', label: '투표', icon: Vote, color: 'text-rose-500 bg-rose-500/10' },
  { href: '/notes', label: '연구노트', icon: NotebookPen, color: 'text-emerald-500 bg-emerald-500/10' },
  { href: '/match', label: '스터디 매칭', icon: Users, color: 'text-sky-500 bg-sky-500/10' },
  { href: '/dashboard', label: 'GPU 대여', icon: Cpu, color: 'text-indigo-500 bg-indigo-500/10' },
  { href: '/tools', label: '도구', icon: Wrench, color: 'text-teal-500 bg-teal-500/10' },
  { href: '/games', label: 'Arcade', icon: Gamepad2, color: 'text-pink-500 bg-pink-500/10' },
  { href: '/feed', label: 'Feed', icon: Newspaper, color: 'text-orange-500 bg-orange-500/10' },
];

export default function Home() {
  const { user, profile } = useAuth();
  const firstName = profile?.full_name?.trim() || null;

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <p className="text-2xl md:text-4xl font-black tracking-tight">
          {firstName ? `${firstName}님,` : '안녕하세요,'}
        </p>
        <p className="text-2xl md:text-4xl font-black tracking-tight text-muted-foreground">
          오늘은 뭘 도와드릴까요?
        </p>
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

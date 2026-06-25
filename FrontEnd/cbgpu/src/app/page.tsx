'use client';
import Link from 'next/link';
import GPUCard from '@/components/GPUCard';
import WeeklyGPUCard from '@/components/WeeklyGPUCard';
import { Cpu, CalendarDays, BookOpen, UtensilsCrossed, Vote, NotebookPen, Users, Gamepad2 } from 'lucide-react';

const GPUS = [
  { id: 1, name: "RTX5000" },
  { id: 2, name: "RTX5000" },
  { id: 3, name: "RTX5000" },
  { id: 4, name: "RTX5000" },
];

const FEATURES = [
  { href: '/study', label: '자습신청', icon: BookOpen },
  { href: '/timetable', label: '시간표', icon: CalendarDays },
  { href: '/meal', label: '급식', icon: UtensilsCrossed },
  { href: '/polls', label: '투표', icon: Vote },
  { href: '/notes', label: '연구노트', icon: NotebookPen },
  { href: '/match', label: '스터디 매칭', icon: Users },
  { href: '/dashboard', label: 'GPU 대여', icon: Cpu },
  { href: '/games', label: 'Arcade', icon: Gamepad2 },
];

export default function Home() {

  return (
    <div className="container mx-auto py-8 md:py-16 px-4 md:px-6 space-y-16 md:space-y-24">
      <div className="flex flex-col items-center text-center gap-4">
        <img
          src="https://i.namu.wiki/i/qMgg10XRSaTorhAnQaV-bKbUWK_xIlq2socc7pVyw1SJmovke8gEWfeofFitiIJ1VBMngGy4o1NuAnjrOA0m1w.webp"
          alt="School Logo"
          className="w-20 md:w-28 h-20 md:h-28 mb-2 object-contain grayscale opacity-80 animate-in zoom-in duration-700"
        />
        <div className="space-y-2">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tighter italic uppercase">
            충북과학고등학교 <br className="sm:hidden" />
            <span className="text-primary block sm:inline sm:ml-2">학생 생활 플랫폼</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-xl max-w-2xl mx-auto font-bold uppercase tracking-wide opacity-80">
            자습신청 · 시간표 · 급식 · 투표 · 연구노트 · 스터디 매칭 · GPU 대여까지
          </p>
        </div>
        <div className="h-1.5 w-24 bg-primary rounded-full mt-4"></div>
      </div>

      {/* 기능 둘러보기 — GPU 대여는 여러 기능 중 하나일 뿐 */}
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          {FEATURES.map((f, i) => (
            <Link
              key={f.href}
              href={f.href}
              style={{ animationDelay: `${i * 50}ms` }}
              className="tilt-3d flex flex-col items-center justify-center gap-2 p-5 rounded-3xl border border-border/50 bg-card animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards"
            >
              <f.icon className="size-7 text-primary" strokeWidth={1.8} />
              <span className="text-xs font-black uppercase tracking-widest text-center">{f.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* GPU 대여 — 큰 기능 중 하나 */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Cpu className="size-6 text-primary" />
          <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase italic">GPU 대여</h2>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
          {GPUS.map((gpu) => (
            <div key={gpu.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: `${gpu.id * 100}ms` }}>
              {gpu.id === 1
                ? <GPUCard id={gpu.id} name={gpu.name} />
                : <WeeklyGPUCard id={gpu.id} name={gpu.name} />
              }
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

import Link from 'next/link';
import { serviceGroups } from '@/lib/serviceNavigation';

/** 홈에 보이는 모든 서비스. 이름과 순서는 serviceNavigation 하나를 따라서 하단 탐색·전체 서비스와 항상 같다. */
export const HOME_SERVICES = serviceGroups.flatMap(group => group.services);

/** 차가운 톤으로 통일한 은은한 팔레트 — 채도 낮은 400 톤 + 배경 /10 으로 너무 알록달록하지 않게.
 *  서비스마다 색이 달라야 14개가 한눈에 구분된다. 새 서비스를 추가하면 여기에도 색을 넣는다. */
const SERVICE_COLORS: Record<string, string> = {
  '/contests': 'text-amber-400 bg-amber-400/10',
  '/study': 'text-blue-400 bg-blue-400/10',
  '/timetable': 'text-indigo-400 bg-indigo-400/10',
  '/meal': 'text-amber-400 bg-amber-400/10',
  '/wakeup': 'text-pink-400 bg-pink-400/10',
  '/dashboard': 'text-slate-400 bg-slate-400/10',
  '/server': 'text-emerald-400 bg-emerald-400/10',
  '/manufacturing': 'text-orange-400 bg-orange-400/10',
  '/notes': 'text-teal-400 bg-teal-400/10',
  '/materials': 'text-blue-400 bg-blue-400/10',
  '/match': 'text-sky-400 bg-sky-400/10',
  '/polls': 'text-violet-400 bg-violet-400/10',
  '/feed': 'text-blue-400 bg-blue-400/10',
  '/tools': 'text-cyan-400 bg-cyan-400/10',
  '/games': 'text-violet-400 bg-violet-400/10',
};
const FALLBACK_COLOR = 'text-slate-400 bg-slate-400/10';

export default function HomeServiceGrid() {
  return (
    <section aria-label="전체 서비스" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {HOME_SERVICES.map((service, index) => (
        <Link
          key={service.href}
          href={service.href}
          style={{ animationDelay: `${80 + index * 50}ms` }}
          className="tilt-3d flex flex-col items-start gap-3 p-5 rounded-[28px] bg-card ring-1 ring-foreground/5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500 ease-[var(--ease-spring)] fill-mode-backwards focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <span className={`flex items-center justify-center size-11 rounded-2xl ${SERVICE_COLORS[service.href] ?? FALLBACK_COLOR}`}>
            <service.icon className="size-5" strokeWidth={2} />
          </span>
          <span className="text-sm font-bold">{service.label}</span>
        </Link>
      ))}
    </section>
  );
}

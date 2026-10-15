'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { signOutEverywhere } from '@/lib/signOutEverywhere';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import SiteSearch from './SiteSearch';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import {
  Menu, X, ChevronDown, Home, UserCircle2, Search, LayoutGrid,
  BookOpen, CalendarDays, UtensilsCrossed,
} from 'lucide-react';
import { useState, useRef, useEffect, useLayoutEffect } from 'react';

interface NavLink { href: string; label: string; }
interface NavGroup { label: string; links: NavLink[]; }

const PRIMARY_LINKS: NavLink[] = [
  { href: '/study', label: '자습신청' },
  { href: '/timetable', label: '시간표' },
  { href: '/meal', label: '급식' },
  { href: '/wakeup', label: '기상송' },
];

const GROUPS: NavGroup[] = [
  { label: '학교 자원', links: [
    { href: '/dashboard', label: 'GPU 대여' },
    { href: '/server', label: '서버 배포' },
    { href: '/manufacturing', label: '제작' },
    { href: '/services', label: '전체 서비스' },
  ] },
  { label: '학교생활', links: [
    { href: '/study', label: '자습신청' },
    { href: '/timetable', label: '시간표' },
    { href: '/meal', label: '급식' },
    { href: '/match', label: '스터디' },
    { href: '/wakeup', label: '기상송' },
  ] },
  { label: '도구', links: [
    { href: '/notes', label: '노트' },
    { href: '/materials', label: '자료 공유' },
    { href: '/tools', label: '도구' },
    { href: '/games', label: 'Arcade' },
  ] },
  { label: '정보', links: [
    { href: '/polls', label: '투표' },
    { href: '/feed', label: 'Feed' },
  ] },
];

const PILL = 'relative z-10 inline-flex min-h-11 items-center shrink-0 text-sm font-semibold px-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-ring';
const isActivePath = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

const BOTTOM_LINKS = [
  { href: '/', label: '홈', Icon: Home },
  { href: '/study', label: '자습신청', Icon: BookOpen },
  { href: '/timetable', label: '시간표', Icon: CalendarDays },
  { href: '/meal', label: '급식', Icon: UtensilsCrossed },
  { href: '/services', label: '전체', Icon: LayoutGrid },
];

export default function Navbar() {
  const { user, profile, isAdmin, isWakeupManager, isLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => { setIsMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setIsMenuOpen(false); }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMenuOpen]);

  const activeGroupLink = !PRIMARY_LINKS.some(l => isActivePath(pathname, l.href)) && GROUPS.some(g => g.links.some(l => isActivePath(pathname, l.href)));
  const activePrimaryLink = PRIMARY_LINKS.find(l => isActivePath(pathname, l.href));
  const activeKey = activePrimaryLink?.href ?? (activeGroupLink ? 'menu' : null);

  // 활성 항목 뒤에서 슬라이드하는 인디케이터 위치 계산
  const railRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!activeKey) { setIndicator(null); return; }
    const el = itemRefs.current.get(activeKey);
    if (!el) { setIndicator(null); return; }
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeKey, user, isLoading]); // user/isLoading도 의존성에 넣어야 함 — 레일 자체가
  // user && !isLoading일 때만 마운트되는데, 새로고침 시 activeKey는 이미 정해져 있어서
  // 레일이 처음 나타나는 그 순간엔 activeKey가 안 바뀌어 effect가 재실행되지 않았었음

  const handleLogout = async () => {
    try {
      const { error } = await signOutEverywhere();
      if (error) throw error;
      showSuccess("로그아웃됐습니다.");
      router.push('/auth/login');
      setIsMenuOpen(false);
    } catch (err: unknown) {
      showError("로그아웃 실패.");
      console.error(err);
    }
  };

  return (
    <>
    <nav aria-label="주 메뉴" className="flex items-center justify-between gap-2 px-3 sm:px-6 md:px-10 py-4 border-b border-border bg-card sticky top-0 z-50">
      <div className="flex items-center gap-4 md:gap-8">
        <Link href="/" className="flex items-center gap-2 group transition-transform active:scale-95">
          <img
            src="https://i.namu.wiki/i/qMgg10XRSaTorhAnQaV-bKbUWK_xIlq2socc7pVyw1SJmovke8gEWfeofFitiIJ1VBMngGy4o1NuAnjrOA0m1w.webp"
            alt="충북과학고등학교 로고"
            className="w-8 h-8 object-contain grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 group-hover:rotate-12 transition-all duration-500"
          />
          <span className="text-xl md:text-2xl font-black text-foreground/70 group-hover:text-primary tracking-tighter italic transition-colors duration-500">
            CBGPU
          </span>
        </Link>

        {user && !isLoading && (
          <div ref={railRef} className="hidden xl:flex items-center gap-1 relative">
            {indicator && (
              <div
                className="absolute bottom-0 h-0.5 bg-primary transition-all duration-150 motion-reduce:transition-none"
                style={{ left: indicator.left, width: indicator.width }}
              />
            )}
            {PRIMARY_LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                ref={(el) => { if (el) itemRefs.current.set(l.href, el); }}
                className={`${PILL} ${isActivePath(pathname, l.href) ? `text-foreground ${indicator ? '' : 'underline underline-offset-8 decoration-primary decoration-2'}` : 'text-muted-foreground hover:text-foreground'}`}
                aria-current={isActivePath(pathname, l.href) ? 'page' : undefined}
              >
                {l.label}
              </Link>
            ))}
            <Link href="/services" ref={(el) => { if (el) itemRefs.current.set('menu', el); }} className={`${PILL} ${activeGroupLink ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`} aria-current={pathname === '/services' ? 'page' : undefined}>전체 서비스</Link>
          </div>
        )}
      </div>

      <div className="flex gap-2 md:gap-4 items-center">
        <button
          type="button"
          onClick={() => { setIsMenuOpen(false); setSearchOpen(true); }}
          aria-label="기능 찾기"
          className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Search className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">기능 찾기</span>
          <span className="hidden lg:inline rounded border border-border px-1.5 py-0.5 text-[10px]">⌘ K</span>
        </button>
        <div className="hidden xl:flex items-center gap-2">
          <Link href="/contact" className={`text-xs transition-colors font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${pathname === '/contact' ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-muted text-muted-foreground'}`}>
            Contact
          </Link>
          <ThemeToggle />

          {!isLoading && (
            user ? (
              <DropdownMenuPrimitive.Root>
                <DropdownMenuPrimitive.Trigger asChild>
                  <button aria-label="내 계정 메뉴" className="flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 ml-2 hover:bg-muted/60 transition-colors">
                    {profile?.avatar_url ? (
                      <Image src={profile.avatar_url} alt="" width={32} height={32} className="size-8 rounded-full object-cover ring-2 ring-background shadow-sm" />
                    ) : (
                      <span className="flex items-center justify-center size-8 rounded-full bg-muted text-muted-foreground">
                        <UserCircle2 className="size-5" />
                      </span>
                    )}
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </button>
                </DropdownMenuPrimitive.Trigger>
                <DropdownMenuPrimitive.Portal>
                  <DropdownMenuPrimitive.Content
                    align="end"
                    sideOffset={10}
                    className="z-50 min-w-48 rounded-xl glass-strong p-1.5 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
                  >
                    <div className="px-3 py-2 mb-1 border-b border-border/40">
                      <p className="text-sm font-semibold text-foreground truncate max-w-[180px]">{profile?.full_name || 'My Profile'}</p>
                      <p className="text-[10px] text-muted-foreground font-medium opacity-70 truncate max-w-[180px]">{user.email}</p>
                    </div>
                    <DropdownMenuPrimitive.Item asChild>
                      <Link href="/profile" className="block px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors outline-none">
                        Profile
                      </Link>
                    </DropdownMenuPrimitive.Item>
                    {isAdmin && (
                      <DropdownMenuPrimitive.Item asChild>
                        <Link href="/admin" className="block px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors outline-none">
                          Admin
                        </Link>
                      </DropdownMenuPrimitive.Item>
                    )}
                    {isWakeupManager && (
                      <DropdownMenuPrimitive.Item asChild>
                        <Link href="/admin/wakeup" className="block px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors outline-none">
                          기상송 관리
                        </Link>
                      </DropdownMenuPrimitive.Item>
                    )}
                    <DropdownMenuPrimitive.Item asChild>
                      <button onClick={handleLogout} className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors outline-none">
                        Sign Out
                      </button>
                    </DropdownMenuPrimitive.Item>
                  </DropdownMenuPrimitive.Content>
                </DropdownMenuPrimitive.Portal>
              </DropdownMenuPrimitive.Root>
            ) : (
              <div className="flex gap-2">
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm" className="font-semibold text-sm">Login</Button>
                </Link>
                <Link href="/auth/signup">
                  <Button size="sm" className="font-semibold text-sm shadow-md">Join</Button>
                </Link>
              </div>
            )
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <div className="xl:hidden flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => { setIsMenuOpen(!isMenuOpen); }} className="xl:hidden" aria-label={isMenuOpen ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={isMenuOpen}>
            {isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-card border-b border-border pt-6 px-6 pb-28 xl:hidden flex flex-col gap-1 max-h-[calc(100dvh-72px)] overflow-y-auto">
          {user ? (
            <>
              <div className="flex items-center justify-between pb-4 mb-3 border-b border-border/50">
                <Link href="/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3">
                  {profile?.avatar_url && (
                    <Image src={profile.avatar_url} alt="" width={40} height={40} className="size-10 rounded-full object-cover ring-2 ring-background shadow-sm" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-black uppercase text-primary leading-none">
                      {profile?.full_name || 'My Profile'}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium opacity-70">
                      {user.email}
                    </span>
                  </div>
                </Link>
                <Button variant="destructive" size="xs" onClick={handleLogout} className="font-semibold text-sm">
                  Sign Out
                </Button>
              </div>

              {PRIMARY_LINKS.map(link => <Link key={link.href} href={link.href} onClick={() => setIsMenuOpen(false)} aria-current={isActivePath(pathname, link.href) ? 'page' : undefined} className={`min-h-11 py-3 text-sm font-semibold ${isActivePath(pathname, link.href) ? 'text-primary' : 'text-foreground'}`}>{link.label}</Link>)}

              {GROUPS.map(group => (
                <div key={group.label} className="mt-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">{group.label}</p>
                  <div className="flex flex-col">
                    {group.links.map(l => (
                      <Link key={l.href} href={l.href} onClick={() => setIsMenuOpen(false)} aria-current={isActivePath(pathname, l.href) ? 'page' : undefined} className={`text-sm font-medium py-3 ${isActivePath(pathname, l.href) ? 'text-primary' : 'text-muted-foreground'}`}>
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              <div className="mt-3 pt-3 border-t border-border/50 flex flex-col">
                <Link href="/contact" onClick={() => setIsMenuOpen(false)} className={`text-sm font-medium py-3 ${pathname === '/contact' ? 'text-primary' : 'text-muted-foreground'}`}>
                  Contact
                </Link>
                <Link href="/privacy" onClick={() => setIsMenuOpen(false)} className={`text-sm font-medium py-3 ${pathname === '/privacy' ? 'text-primary' : 'text-muted-foreground'}`}>
                  개인정보처리방침
                </Link>
                {isAdmin && (
                  <Link href="/admin" onClick={() => setIsMenuOpen(false)} className={`text-sm font-semibold py-2 ${pathname === '/admin' ? 'text-primary' : 'text-foreground'}`}>
                    Admin Panel
                  </Link>
                )}
                {isWakeupManager && (
                  <Link href="/admin/wakeup" onClick={() => setIsMenuOpen(false)} className={`text-sm font-semibold py-2 ${pathname === '/admin/wakeup' ? 'text-primary' : 'text-foreground'}`}>
                    기상송 관리
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <Link href="/contact" onClick={() => setIsMenuOpen(false)} className={`text-sm font-medium py-3 ${pathname === '/contact' ? 'text-primary' : 'text-muted-foreground'}`}>
                Contact
              </Link>
              <Link href="/auth/login" onClick={() => setIsMenuOpen(false)}>
                <Button variant="outline" className="w-full font-black uppercase tracking-widest">Login</Button>
              </Link>
              <Link href="/auth/signup" onClick={() => setIsMenuOpen(false)}>
                <Button className="w-full font-black uppercase tracking-widest shadow-md">Join Now</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>

    {user && !isLoading && (
      <nav aria-label="주요 서비스" className="xl:hidden fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-border bg-card px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {BOTTOM_LINKS.map(({ href, label, Icon }) => {
          const active = href === '/' ? pathname === '/' : isActivePath(pathname, href);
          return <Link key={href} href={href} onClick={() => setIsMenuOpen(false)} aria-current={active ? 'page' : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 px-1 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2 ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Icon aria-hidden="true" className="size-5" /><span>{label}</span>
          </Link>;
        })}
      </nav>
    )}
    <SiteSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}

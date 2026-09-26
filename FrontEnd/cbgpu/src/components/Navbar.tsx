'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import SiteSearch from './SiteSearch';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import {
  Menu, X, ChevronDown, Home, GraduationCap, UserCircle2, Search,
  BookOpen, CalendarDays, UtensilsCrossed, Users, Cpu, Vote, NotebookPen, Wrench, Gamepad2, Newspaper, Server, Printer, Music,
} from 'lucide-react';
import { useState, useRef, useEffect, useLayoutEffect } from 'react';

interface NavLink { href: string; label: string; }
interface NavGroup { label: string; links: NavLink[]; }

const PRIMARY_LINKS: NavLink[] = [
  { href: '/dashboard', label: 'GPU' },
  { href: '/server',    label: 'Server' },
  { href: '/manufacturing', label: 'Manufacture' },
];

const GROUPS: NavGroup[] = [
  { label: '학교생활', links: [
    { href: '/study', label: '자습신청' },
    { href: '/timetable', label: '시간표' },
    { href: '/meal', label: '급식' },
    { href: '/match', label: '스터디' },
    { href: '/wakeup', label: '기상송' },
  ] },
  { label: '도구', links: [
    { href: '/notes', label: '노트' },
    { href: '/tools', label: '도구' },
    { href: '/games', label: 'Arcade' },
  ] },
  { label: '정보', links: [
    { href: '/polls', label: '투표' },
    { href: '/feed', label: 'Feed' },
  ] },
];

const PILL = 'relative z-10 shrink-0 text-xs font-black px-3 py-1.5 rounded-lg uppercase tracking-widest transition-colors';
const isActivePath = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** 모바일 하단 플로팅 탭바 — 바(컨테이너)는 3D로 띄우고, 안의 아이콘은 단순한 2D 라인 아이콘(회색/흰색)으로.
 * 4개 분류 버튼 + 가운데 원형 홈. 분류를 누르면 그 위로 작은 3D 플로팅 패널이 떠서 안의
 * 탭들을 고르게 한다 — 한 번에 보이는 선택지는 4개뿐이라 힉의 법칙에 맞고, 그 안에 10개
 * 탭이 다 들어가 있어서 어디든 두 번의 탭으로 닿는다. */
interface BottomLink { href: string; label: string; Icon: typeof Home }
interface BottomCategory { key: string; label: string; Icon: typeof Home; links: BottomLink[] }

const BOTTOM_CATEGORIES_LEFT: BottomCategory[] = [
  { key: 'school', label: '학교생활', Icon: GraduationCap, links: [
    { href: '/study', label: '자습신청', Icon: BookOpen },
    { href: '/timetable', label: '시간표', Icon: CalendarDays },
    { href: '/meal', label: '급식', Icon: UtensilsCrossed },
    { href: '/match', label: '스터디', Icon: Users },
    { href: '/wakeup', label: '기상송', Icon: Music },
  ] },
  { key: 'gpu', label: '학교자원', Icon: Cpu, links: [
    { href: '/dashboard', label: 'GPU 예약', Icon: Cpu },
    { href: '/server',    label: '서버 배포', Icon: Server },
    { href: '/manufacturing', label: '제작', Icon: Printer },
  ] },
];
const BOTTOM_CATEGORIES_RIGHT: BottomCategory[] = [
  { key: 'tools', label: '도구', Icon: Wrench, links: [
    { href: '/notes', label: '노트', Icon: NotebookPen },
    { href: '/tools', label: '도구', Icon: Wrench },
    { href: '/games', label: 'Arcade', Icon: Gamepad2 },
  ] },
  { key: 'info', label: '정보', Icon: Newspaper, links: [
    { href: '/polls', label: '투표', Icon: Vote },
    { href: '/feed', label: 'Feed', Icon: Newspaper },
  ] },
];

function BottomCategoryButton({ cat, isOpen, onToggle, pathname }: {
  cat: BottomCategory;
  isOpen: boolean;
  onToggle: () => void;
  pathname: string;
}) {
  const active = cat.links.some(l => isActivePath(pathname, l.href));
  return (
    <div className="relative flex flex-col items-center w-12 shrink-0">
      {isOpen && (
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex flex-col gap-1 p-2 rounded-2xl glass-strong pop-in-3d whitespace-nowrap">
          {cat.links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black transition-colors ${
                isActivePath(pathname, l.href) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
              aria-current={isActivePath(pathname, l.href) ? 'page' : undefined}
            >
              <l.Icon className="size-4" />
              {l.label}
            </Link>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${cat.label} 메뉴`}
        aria-expanded={isOpen}
        className={`relative z-10 flex flex-col items-center gap-0.5 py-1 w-12 rounded-2xl transition-all duration-150 active:scale-90 ${(active || isOpen) ? '-translate-y-1.5' : ''}`}
      >
        <cat.Icon className={`size-5 transition-colors duration-300 ${active || isOpen ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={active || isOpen ? 2.5 : 2} />
        <span className={`text-[9px] font-black uppercase tracking-wide ${active || isOpen ? 'text-primary' : 'text-muted-foreground'}`}>
          {cat.label}
        </span>
      </button>
    </div>
  );
}

export default function Navbar() {
  const { user, profile, isAdmin, isWakeupManager, isLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => { setOpenCat(null); setIsMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!openCat && !isMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpenCat(null); setIsMenuOpen(false); }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [openCat, isMenuOpen]);

  const activeGroupLink = GROUPS.some(g => g.links.some(l => isActivePath(pathname, l.href)));
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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      showSuccess("로그아웃됐습니다.");
      router.push('/auth/login');
      setIsMenuOpen(false);
    } catch (err: any) {
      showError("로그아웃 실패.");
      console.error(err);
    }
  };

  return (
    <>
    <nav className="flex items-center justify-between px-6 md:px-10 py-4 glass sticky top-0 z-50">
      <div className="flex items-center gap-4 md:gap-8">
        <Link href="/" className="flex items-center gap-2 group transition-transform active:scale-95">
          <img
            src="https://i.namu.wiki/i/qMgg10XRSaTorhAnQaV-bKbUWK_xIlq2socc7pVyw1SJmovke8gEWfeofFitiIJ1VBMngGy4o1NuAnjrOA0m1w.webp"
            alt="Logo"
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
                className="absolute top-0 bottom-0 rounded-lg bg-primary shadow-lg transition-all duration-200 ease-[var(--ease-spring)]"
                style={{ left: indicator.left, width: indicator.width }}
              />
            )}
            {PRIMARY_LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                ref={(el) => { if (el) itemRefs.current.set(l.href, el); }}
                className={`${PILL} ${isActivePath(pathname, l.href) ? `text-primary-foreground ${indicator ? '' : 'bg-primary shadow-md'}` : 'text-muted-foreground hover:text-foreground'}`}
                aria-current={isActivePath(pathname, l.href) ? 'page' : undefined}
              >
                {l.label}
              </Link>
            ))}
            <DropdownMenuPrimitive.Root>
              <DropdownMenuPrimitive.Trigger asChild>
                <button
                  ref={(el) => { if (el) itemRefs.current.set('menu', el); }}
                  className={`${PILL} flex items-center gap-1 ${activeGroupLink ? `text-primary-foreground ${indicator ? '' : 'bg-primary shadow-md'}` : 'text-muted-foreground hover:text-foreground'}`}
                >
                  메뉴
                  <ChevronDown className="size-3" />
                </button>
              </DropdownMenuPrimitive.Trigger>
              <DropdownMenuPrimitive.Portal>
                <DropdownMenuPrimitive.Content
                  align="start"
                  sideOffset={8}
                  className="z-50 min-w-44 rounded-xl glass-strong p-1.5 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
                >
                  {GROUPS.map((group, gi) => (
                    <div key={group.label} className={gi > 0 ? 'mt-1 pt-1 border-t border-border/40' : ''}>
                      <p className="px-3 pt-1.5 pb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{group.label}</p>
                      {group.links.map(l => (
                        <DropdownMenuPrimitive.Item key={l.href} asChild>
                          <Link
                            href={l.href}
                            className={`block px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest outline-none transition-colors ${isActivePath(pathname, l.href) ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
                            aria-current={isActivePath(pathname, l.href) ? 'page' : undefined}
                          >
                            {l.label}
                          </Link>
                        </DropdownMenuPrimitive.Item>
                      ))}
                    </div>
                  ))}
                </DropdownMenuPrimitive.Content>
              </DropdownMenuPrimitive.Portal>
            </DropdownMenuPrimitive.Root>
          </div>
        )}
      </div>

      <div className="flex gap-2 md:gap-4 items-center">
        <button
          type="button"
          onClick={() => { setIsMenuOpen(false); setOpenCat(null); setSearchOpen(true); }}
          aria-label="기능 찾기"
          className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
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
                  <button className="flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 ml-2 hover:bg-muted/60 transition-colors">
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
                      <p className="text-xs font-black uppercase text-primary truncate max-w-[180px]">{profile?.full_name || 'My Profile'}</p>
                      <p className="text-[10px] text-muted-foreground font-medium opacity-70 truncate max-w-[180px]">{user.email}</p>
                    </div>
                    <DropdownMenuPrimitive.Item asChild>
                      <Link href="/profile" className="block px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-foreground hover:bg-muted transition-colors outline-none">
                        Profile
                      </Link>
                    </DropdownMenuPrimitive.Item>
                    {isAdmin && (
                      <DropdownMenuPrimitive.Item asChild>
                        <Link href="/admin" className="block px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-orange-500 hover:bg-orange-500/10 transition-colors outline-none">
                          Admin
                        </Link>
                      </DropdownMenuPrimitive.Item>
                    )}
                    {isWakeupManager && (
                      <DropdownMenuPrimitive.Item asChild>
                        <Link href="/admin/wakeup" className="block px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-pink-500 hover:bg-pink-500/10 transition-colors outline-none">
                          기상송 관리
                        </Link>
                      </DropdownMenuPrimitive.Item>
                    )}
                    <DropdownMenuPrimitive.Item asChild>
                      <button onClick={handleLogout} className="w-full text-left px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 transition-colors outline-none">
                        Sign Out
                      </button>
                    </DropdownMenuPrimitive.Item>
                  </DropdownMenuPrimitive.Content>
                </DropdownMenuPrimitive.Portal>
              </DropdownMenuPrimitive.Root>
            ) : (
              <div className="flex gap-2">
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm" className="font-black text-[10px] uppercase tracking-widest">Login</Button>
                </Link>
                <Link href="/auth/signup">
                  <Button size="sm" className="font-black text-[10px] uppercase tracking-widest shadow-md">Join</Button>
                </Link>
              </div>
            )
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <div className="xl:hidden flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} className="xl:hidden" aria-label={isMenuOpen ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={isMenuOpen}>
            {isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 w-full glass-strong pt-6 px-6 pb-28 xl:hidden flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-300 max-h-[calc(100vh-72px)] overflow-y-auto">
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
                <Button variant="destructive" size="xs" onClick={handleLogout} className="font-black text-[10px] uppercase">
                  Sign Out
                </Button>
              </div>

              <Link href="/dashboard" onClick={() => setIsMenuOpen(false)} aria-current={isActivePath(pathname, '/dashboard') ? 'page' : undefined} className={`text-sm font-black uppercase tracking-widest py-2 ${isActivePath(pathname, '/dashboard') ? 'text-primary' : 'text-muted-foreground'}`}>
                GPU
              </Link>
              <Link href="/server" onClick={() => setIsMenuOpen(false)} aria-current={isActivePath(pathname, '/server') ? 'page' : undefined} className={`text-sm font-black uppercase tracking-widest py-2 ${isActivePath(pathname, '/server') ? 'text-primary' : 'text-muted-foreground'}`}>
                Server
              </Link>
              <Link href="/manufacturing" onClick={() => setIsMenuOpen(false)} aria-current={isActivePath(pathname, '/manufacturing') ? 'page' : undefined} className={`text-sm font-black uppercase tracking-widest py-2 ${isActivePath(pathname, '/manufacturing') ? 'text-primary' : 'text-muted-foreground'}`}>
                Manufacture
              </Link>

              {GROUPS.map(group => (
                <div key={group.label} className="mt-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">{group.label}</p>
                  <div className="flex flex-col">
                    {group.links.map(l => (
                      <Link key={l.href} href={l.href} onClick={() => setIsMenuOpen(false)} aria-current={isActivePath(pathname, l.href) ? 'page' : undefined} className={`text-sm font-black uppercase tracking-widest py-2 ${isActivePath(pathname, l.href) ? 'text-primary' : 'text-muted-foreground'}`}>
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              <div className="mt-3 pt-3 border-t border-border/50 flex flex-col">
                <Link href="/contact" onClick={() => setIsMenuOpen(false)} className={`text-sm font-black uppercase tracking-widest py-2 ${pathname === '/contact' ? 'text-primary' : 'text-muted-foreground'}`}>
                  Contact
                </Link>
                {isAdmin && (
                  <Link href="/admin" onClick={() => setIsMenuOpen(false)} className={`text-sm font-black uppercase tracking-widest py-2 ${pathname === '/admin' ? 'text-orange-500' : 'text-orange-400'}`}>
                    Admin Panel
                  </Link>
                )}
                {isWakeupManager && (
                  <Link href="/admin/wakeup" onClick={() => setIsMenuOpen(false)} className={`text-sm font-black uppercase tracking-widest py-2 ${pathname === '/admin/wakeup' ? 'text-pink-500' : 'text-pink-400'}`}>
                    기상송 관리
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <Link href="/contact" onClick={() => setIsMenuOpen(false)} className={`text-sm font-black uppercase tracking-widest py-2 ${pathname === '/contact' ? 'text-primary' : 'text-muted-foreground'}`}>
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
      <>
        {openCat && <div className="xl:hidden fixed inset-0 z-40" onClick={() => setOpenCat(null)} />}
        <nav className="xl:hidden fixed bottom-3 left-3 right-3 z-50 flex items-end gap-1 rounded-[28px] glass-strong px-2 py-2 tilt-3d">
          <div className="flex-1 flex items-end justify-evenly">
            {BOTTOM_CATEGORIES_LEFT.map(cat => (
              <BottomCategoryButton
                key={cat.key}
                cat={cat}
                isOpen={openCat === cat.key}
                onToggle={() => setOpenCat(o => o === cat.key ? null : cat.key)}
                pathname={pathname}
              />
            ))}
          </div>

          <Link href="/" className="relative flex flex-col items-center shrink-0 px-2 -mt-7" onClick={() => setOpenCat(null)}>
            <span className={`flex items-center justify-center size-14 rounded-full shadow-lg ring-4 ring-background transition-all active:scale-95 ${
              pathname === '/' ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background'
            }`}>
              <Home className="size-6" strokeWidth={2.5} />
            </span>
          </Link>

          <div className="flex-1 flex items-end justify-evenly">
            {BOTTOM_CATEGORIES_RIGHT.map(cat => (
              <BottomCategoryButton
                key={cat.key}
                cat={cat}
                isOpen={openCat === cat.key}
                onToggle={() => setOpenCat(o => o === cat.key ? null : cat.key)}
                pathname={pathname}
              />
            ))}
          </div>
        </nav>
      </>
    )}
    <SiteSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}

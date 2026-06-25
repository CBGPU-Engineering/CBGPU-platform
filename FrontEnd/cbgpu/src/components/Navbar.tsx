'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useState, useRef, useLayoutEffect } from 'react';

interface NavLink { href: string; label: string; }
interface NavGroup { label: string; links: NavLink[]; }

const PRIMARY_LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/schedule', label: 'Schedule' },
];

const GROUPS: NavGroup[] = [
  { label: '학교생활', links: [
    { href: '/study', label: '자습신청' },
    { href: '/timetable', label: '시간표' },
    { href: '/meal', label: '급식' },
    { href: '/match', label: '스터디' },
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

export default function Navbar() {
  const { user, profile, isAdmin, isLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const activeGroup = GROUPS.find(g => g.links.some(l => l.href === pathname));
  const activeKey = PRIMARY_LINKS.some(l => l.href === pathname) ? pathname : (activeGroup?.label ?? null);

  // 활성 항목 뒤에서 슬라이드하는 인디케이터 위치 계산
  const railRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!activeKey) { setIndicator(null); return; }
    const el = itemRefs.current.get(activeKey);
    if (!el) { setIndicator(null); return; }
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeKey]);

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
    <nav className="flex items-center justify-between px-6 md:px-10 py-4 bg-background/50 border-b border-border sticky top-0 z-50 backdrop-blur-md">
      <div className="flex items-center gap-4 md:gap-8">
        <Link href="/" className="flex items-center gap-2 group transition-transform active:scale-95">
          <img
            src="https://i.namu.wiki/i/qMgg10XRSaTorhAnQaV-bKbUWK_xIlq2socc7pVyw1SJmovke8gEWfeofFitiIJ1VBMngGy4o1NuAnjrOA0m1w.webp"
            alt="Logo"
            className="w-8 h-8 object-contain group-hover:rotate-12 transition-transform duration-500"
          />
          <span className="text-xl md:text-2xl font-black text-primary tracking-tighter italic">
            CBGPU
          </span>
        </Link>

        {user && !isLoading && (
          <div ref={railRef} className="hidden md:flex items-center gap-1 relative">
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
                className={`${PILL} ${pathname === l.href ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {l.label}
              </Link>
            ))}
            {GROUPS.map(group => (
              <DropdownMenuPrimitive.Root key={group.label}>
                <DropdownMenuPrimitive.Trigger asChild>
                  <button
                    ref={(el) => { if (el) itemRefs.current.set(group.label, el); }}
                    className={`${PILL} flex items-center gap-1 ${activeGroup?.label === group.label ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {group.label}
                    <ChevronDown className="size-3" />
                  </button>
                </DropdownMenuPrimitive.Trigger>
                <DropdownMenuPrimitive.Portal>
                  <DropdownMenuPrimitive.Content
                    align="start"
                    sideOffset={8}
                    className="z-50 min-w-36 rounded-xl bg-popover p-1.5 ring-1 ring-foreground/10 shadow-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
                  >
                    {group.links.map(l => (
                      <DropdownMenuPrimitive.Item key={l.href} asChild>
                        <Link
                          href={l.href}
                          className={`block px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest outline-none transition-colors ${pathname === l.href ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
                        >
                          {l.label}
                        </Link>
                      </DropdownMenuPrimitive.Item>
                    ))}
                  </DropdownMenuPrimitive.Content>
                </DropdownMenuPrimitive.Portal>
              </DropdownMenuPrimitive.Root>
            ))}
            {isAdmin && (
              <Link href="/admin" className={`text-xs transition-colors font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${pathname === '/admin' ? 'bg-orange-500 text-white shadow-lg' : 'text-orange-500 hover:bg-orange-500/10'}`}>
                Admin
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 md:gap-4 items-center">
        <div className="hidden md:flex items-center gap-4">
          <Link href="/contact" className={`text-xs transition-colors font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${pathname === '/contact' ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-muted text-muted-foreground'}`}>
            Contact
          </Link>
          <ThemeToggle />

          {!isLoading && (
            user ? (
              <div className="flex items-center gap-4 pl-4 border-l border-border/50">
                <Link href="/profile" className="flex flex-col items-end group transition-all text-right">
                  <span className="text-[10px] font-black uppercase text-primary leading-none group-hover:underline max-w-[150px] truncate">
                    {profile?.full_name || 'My Profile'}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-medium opacity-70 max-w-[150px] truncate">
                    {user.email}
                  </span>
                </Link>

                <Button variant="outline" size="xs" onClick={handleLogout} className="font-black text-[10px] uppercase h-8 px-3 border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors">
                  Sign Out
                </Button>
              </div>
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
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden">
            {isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-background/95 backdrop-blur-xl border-b border-border py-6 px-6 md:hidden flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-300 max-h-[calc(100vh-72px)] overflow-y-auto">
          {user ? (
            <>
              <div className="flex items-center justify-between pb-4 mb-3 border-b border-border/50">
                <Link href="/profile" onClick={() => setIsMenuOpen(false)} className="flex flex-col">
                  <span className="text-sm font-black uppercase text-primary leading-none">
                    {profile?.full_name || 'My Profile'}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium opacity-70">
                    {user.email}
                  </span>
                </Link>
                <Button variant="destructive" size="xs" onClick={handleLogout} className="font-black text-[10px] uppercase">
                  Sign Out
                </Button>
              </div>

              <Link href="/dashboard" onClick={() => setIsMenuOpen(false)} className={`text-sm font-black uppercase tracking-widest py-2 ${pathname === '/dashboard' ? 'text-primary' : 'text-muted-foreground'}`}>
                Dashboard
              </Link>
              <Link href="/schedule" onClick={() => setIsMenuOpen(false)} className={`text-sm font-black uppercase tracking-widest py-2 ${pathname === '/schedule' ? 'text-primary' : 'text-muted-foreground'}`}>
                Schedule
              </Link>

              {GROUPS.map(group => (
                <div key={group.label} className="mt-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">{group.label}</p>
                  <div className="flex flex-col">
                    {group.links.map(l => (
                      <Link key={l.href} href={l.href} onClick={() => setIsMenuOpen(false)} className={`text-sm font-black uppercase tracking-widest py-2 ${pathname === l.href ? 'text-primary' : 'text-muted-foreground'}`}>
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
  );
}

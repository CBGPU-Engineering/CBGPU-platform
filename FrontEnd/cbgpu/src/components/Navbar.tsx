'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import { toast } from 'sonner';
import { useAuth } from '@/lib/useAuth';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const { user, profile, isAdmin, isLoading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Signed out successfully.");
      router.push('/auth/login');
      setIsMenuOpen(false);
    } catch (err: any) {
      toast.error("Logout failed.");
      console.error(err);
    }
  };

  return (
    <nav className="flex items-center justify-between px-6 md:px-10 py-4 bg-background/50 border-b border-border sticky top-0 z-50 backdrop-blur-md transition-all">
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

        <div className="hidden md:flex gap-1">
          <Link href="/contact" className={`text-xs transition-all duration-300 font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${pathname === '/contact' ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-muted text-muted-foreground'}`}>
            Contact
          </Link>
          {user && !isLoading && (
            <>
              <Link href="/dashboard" className={`text-xs transition-all duration-300 font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${pathname === '/dashboard' ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-muted text-muted-foreground'}`}>
                Dashboard
              </Link>
              {isAdmin && (
                <Link href="/admin" className={`text-xs transition-all duration-300 font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${pathname === '/admin' ? 'bg-orange-500 text-white shadow-lg' : 'text-orange-500 hover:bg-orange-500/10'}`}>
                  Admin
                </Link>
              )}
            </>
          )}
        </div>
      </div>
      
      <div className="flex gap-2 md:gap-4 items-center">
        <div className="hidden md:flex items-center gap-4">
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
                
                <Button variant="outline" size="xs" onClick={handleLogout} className="font-black text-[10px] uppercase h-8 px-3 border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all">
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
        <div className="absolute top-full left-0 w-full bg-background/95 backdrop-blur-xl border-b border-border py-6 px-6 md:hidden flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {user ? (
            <>
              <div className="flex items-center justify-between pb-4 border-b border-border/50">
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
              <Link href="/contact" onClick={() => setIsMenuOpen(false)} className={`text-sm font-black uppercase tracking-widest py-2 ${pathname === '/contact' ? 'text-primary' : 'text-muted-foreground'}`}>
                Contact
              </Link>
              {isAdmin && (
                <Link href="/admin" onClick={() => setIsMenuOpen(false)} className={`text-sm font-black uppercase tracking-widest py-2 ${pathname === '/admin' ? 'text-orange-500' : 'text-orange-400'}`}>
                  Admin Panel
                </Link>
              )}
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
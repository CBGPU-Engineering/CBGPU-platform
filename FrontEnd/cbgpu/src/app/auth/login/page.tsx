'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { toast } from 'sonner';
import { getURL } from '@/lib/utils';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ 
        email, 
        password
      });
      if (error) {
        toast.error("로그인 실패: " + error.message);
      } else {
        toast.success("Welcome back!");
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast.error("오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-card border border-border rounded-2xl shadow-2xl transition-colors duration-500">
      <h2 className="text-3xl font-black mb-6 text-center text-foreground italic uppercase tracking-tighter">Sign In</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Email</label>
          <Input 
            type="email" 
            placeholder="your@email.com" 
            className="bg-background border-input text-foreground font-bold" 
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} 
            required 
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Password</label>
          <Input 
            type="password" 
            placeholder="••••••••" 
            className="bg-background border-input text-foreground font-bold" 
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} 
            required 
          />
        </div>
        <Button 
          disabled={isSubmitting}
          className="w-full bg-primary py-6 text-lg font-black uppercase tracking-widest transition-all active:scale-95"
        >
          {isSubmitting ? "Signing In..." : "Login"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground font-medium">
        No account? <Link href="/auth/signup" className="text-primary font-bold hover:underline ml-1">Create Account</Link>
      </p>
    </div>
  );
}
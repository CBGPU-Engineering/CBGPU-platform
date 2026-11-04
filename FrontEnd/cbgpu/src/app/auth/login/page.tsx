'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useAlert } from '@/lib/alert';
import {safeWorkspacePath} from '@/lib/workspaces';
import {Eye,EyeOff} from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showError } = useAlert();
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
        showError("로그인 실패: " + error.message);
      } else {
        const next = new URLSearchParams(window.location.search).get('next');
        router.replace(safeWorkspacePath(next||'/'));
      }
    } catch {
      showError("오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-card ring-1 ring-foreground/5 rounded-[28px] shadow-lg">
      <h2 className="text-3xl font-black mb-6 text-center text-foreground italic uppercase tracking-tighter">로그인</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="login-email" className="text-[10px] font-black uppercase text-muted-foreground ml-1">이메일</label>
          <Input
            id="login-email" name="email" autoComplete="username" autoCapitalize="none" spellCheck={false} inputMode="email" type="email"
            placeholder="이메일 주소를 입력하세요"
            className="bg-background border-input text-foreground font-bold"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between ml-1">
            <label htmlFor="login-password" className="text-[10px] font-black uppercase text-muted-foreground">비밀번호</label>
            <Link href="/auth/forgot-password" className="text-[10px] font-black uppercase text-primary hover:underline">비밀번호 찾기</Link>
          </div>
          <div className="relative"><Input
            id="login-password" name="password" autoComplete="current-password" type={showPassword?'text':'password'}
            placeholder="••••••••"
            className="bg-background border-input text-foreground font-bold pr-12"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            required
          /><button type="button" aria-label={showPassword?'비밀번호 숨기기':'비밀번호 표시'} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)} className="absolute right-0 top-0 h-full min-w-11 flex items-center justify-center text-muted-foreground">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
        </div>
        <Button
          type="submit" disabled={isSubmitting}
          className="w-full bg-primary py-6 text-lg font-black uppercase tracking-widest transition-all active:scale-95"
        >
          {isSubmitting ? "로그인 중…" : "로그인"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground font-medium">
        처음 이용하시나요? <Link href="/auth/signup" className="text-primary font-bold hover:underline ml-1">계정 만들기</Link>
      </p>
    </div>
  );
}

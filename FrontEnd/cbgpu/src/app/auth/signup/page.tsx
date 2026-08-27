'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useAlert } from '@/lib/alert';
import { getURL } from '@/lib/utils';
import { MailCheck } from 'lucide-react';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  const handleSignup = async (e: any) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // The profiles row is created server-side by a trigger on auth.users
      // (see supabase_account_management_migration.sql) so it works even
      // when email confirmation delays the session — full_name/student_id
      // travel in as user metadata for the trigger to read.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, student_id: studentId },
          emailRedirectTo: getURL() + 'auth/callback',
        }
      });

      if (error) {
        showError("회원가입 실패: " + error.message);
        return;
      }

      if (data.session) {
        // Email confirmation is off (or already auto-confirmed) — the user is signed in now.
        showSuccess('회원가입 완료!');
        router.push('/');
      } else {
        setConfirmEmailSent(true);
      }
    } catch (err: any) {
        showError("회원가입 중 오류가 발생했습니다.");
    } finally {
        setIsSubmitting(false);
    }
  };

  if (confirmEmailSent) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-card ring-1 ring-foreground/5 rounded-[28px] shadow-lg text-center space-y-4">
        <MailCheck className="size-12 mx-auto text-primary" />
        <h2 className="text-2xl font-black text-foreground italic uppercase tracking-tighter">이메일을 확인해주세요</h2>
        <p className="text-sm text-muted-foreground font-medium">
          <span className="font-bold text-foreground">{email}</span>로 인증 메일을 보냈습니다. 메일의 링크를 눌러야 로그인할 수 있습니다.
        </p>
        <Link href="/auth/login" className="inline-block text-primary font-bold hover:underline text-sm">로그인으로 이동</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-8 bg-card ring-1 ring-foreground/5 rounded-[28px] shadow-lg">
      <h2 className="text-3xl font-black mb-6 text-center text-foreground uppercase tracking-tighter italic">Join CBGPU</h2>
      <form onSubmit={handleSignup} className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">이름 (Name)</label>
          <Input 
            placeholder="Name" 
            className="bg-background border-input text-foreground font-bold"
            onChange={(e: any) => setFullName(e.target.value)} 
            required 
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">학번 (Student ID)</label>
          <Input 
            placeholder="Student ID" 
            className="bg-background border-input text-foreground font-bold"
            onChange={(e: any) => setStudentId(e.target.value)} 
            required 
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Email</label>
          <Input 
            type="email" 
            placeholder="your@email.com" 
            className="bg-background border-input text-foreground font-bold"
            onChange={(e: any) => setEmail(e.target.value)} 
            required 
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Password</label>
          <Input 
            type="password" 
            placeholder="••••••••" 
            className="bg-background border-input text-foreground font-bold"
            onChange={(e: any) => setPassword(e.target.value)} 
            required 
          />
        </div>
        <Button 
          disabled={isSubmitting}
          className="w-full bg-primary py-6 text-lg font-black uppercase tracking-widest transition-all active:scale-95 mt-2"
        >
          {isSubmitting ? "Creating..." : "Sign Up"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground font-medium">
        Already have an account? <Link href="/auth/login" className="text-primary font-bold hover:underline ml-1">Log In</Link>
      </p>
    </div>
    );
}
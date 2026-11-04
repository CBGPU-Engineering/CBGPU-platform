'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useAlert } from '@/lib/alert';
import { getURL } from '@/lib/utils';
import { MailCheck } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const { showError } = useAlert();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getURL() + 'auth/reset-password',
      });
      if (error) {
        showError('요청 실패: ' + error.message);
        return;
      }
      setSent(true);
    } catch {
      showError('오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-card ring-1 ring-foreground/5 rounded-[28px] shadow-lg text-center space-y-4">
        <MailCheck className="size-12 mx-auto text-primary" />
        <h2 className="text-2xl font-black text-foreground italic uppercase tracking-tighter">이메일을 확인해주세요</h2>
        <p className="text-sm text-muted-foreground font-medium">
          <span className="font-bold text-foreground">{email}</span>로 비밀번호 재설정 링크를 보냈습니다.
        </p>
        <Link href="/auth/login" className="inline-block text-primary font-bold hover:underline text-sm">로그인으로 이동</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-card ring-1 ring-foreground/5 rounded-[28px] shadow-lg">
      <h2 className="text-3xl font-black mb-2 text-center text-foreground italic uppercase tracking-tighter">비밀번호 찾기</h2>
      <p className="text-sm text-muted-foreground text-center font-medium mb-6">가입한 이메일로 재설정 링크를 보내드립니다.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Email</label>
          <Input
            type="email"
            placeholder="이메일 주소를 입력하세요"
            className="bg-background border-input text-foreground font-bold"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button
          disabled={isSubmitting}
          className="w-full bg-primary py-6 text-lg font-black uppercase tracking-widest transition-all active:scale-95"
        >
          {isSubmitting ? "전송 중..." : "재설정 링크 받기"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground font-medium">
        <Link href="/auth/login" className="text-primary font-bold hover:underline">로그인으로 돌아가기</Link>
      </p>
    </div>
  );
}

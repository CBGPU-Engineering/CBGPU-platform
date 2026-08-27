'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showError('비밀번호는 6자 이상이어야 합니다.'); return;
    }
    if (newPassword !== confirmPassword) {
      showError('비밀번호가 일치하지 않습니다.'); return;
    }

    setIsSubmitting(true);
    try {
      // The recovery link's session is established client-side as the page
      // loads (detectSessionInUrl) — no explicit code exchange needed here.
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showError(
          error.message.toLowerCase().includes('session')
            ? '재설정 링크가 만료되었거나 유효하지 않습니다. 비밀번호 찾기를 다시 시도해주세요.'
            : '비밀번호 변경 실패: ' + error.message
        );
        return;
      }
      showSuccess('비밀번호가 변경됐습니다! 다시 로그인해주세요.');
      await supabase.auth.signOut();
      router.push('/auth/login');
    } catch {
      showError('오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-card ring-1 ring-foreground/5 rounded-[28px] shadow-lg">
      <h2 className="text-3xl font-black mb-6 text-center text-foreground italic uppercase tracking-tighter">새 비밀번호 설정</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">새 비밀번호</label>
          <Input
            type="password"
            placeholder="••••••••"
            className="bg-background border-input text-foreground font-bold"
            value={newPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">새 비밀번호 확인</label>
          <Input
            type="password"
            placeholder="••••••••"
            className="bg-background border-input text-foreground font-bold"
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <Button
          disabled={isSubmitting}
          className="w-full bg-primary py-6 text-lg font-black uppercase tracking-widest transition-all active:scale-95"
        >
          {isSubmitting ? "변경 중..." : "비밀번호 변경"}
        </Button>
      </form>
    </div>
  );
}

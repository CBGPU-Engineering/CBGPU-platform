'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/lib/useAuth';
import { Send, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = ['예약 문의', '계정 문제', '기술 지원', '기타'];

export default function ContactPage() {
  const { user, profile } = useAuth();
  const [form, setForm] = useState({
    name: profile?.full_name || '',
    email: user?.email || '',
    category: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      return toast.error('이름, 이메일, 내용은 필수입니다.');
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('문의가 전송되었습니다. 빠른 시일 내에 답변 드리겠습니다.');
      setForm(prev => ({ ...prev, category: '', message: '' }));
    } catch (err: any) {
      toast.error('전송 실패: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-1">
        <h1 className="text-4xl font-black tracking-tighter italic uppercase flex items-center gap-3">
          <MessageSquare className="size-8" /> Contact
        </h1>
        <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest opacity-60">
          문의사항을 남겨주시면 담당자가 이메일로 답변 드립니다
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 border-2 rounded-3xl p-6 md:p-8 bg-card shadow-xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">이름 *</label>
            <Input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="홍길동"
              className="h-10 font-bold text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">이메일 *</label>
            <Input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="h-10 font-bold text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">분류</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, category: prev.category === cat ? '' : cat }))}
                className={cn(
                  'text-[11px] font-black px-3 py-1.5 rounded-full border transition-all',
                  form.category === cat
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">내용 *</label>
          <textarea
            name="message"
            value={form.message}
            onChange={handleChange}
            placeholder="문의 내용을 자세히 작성해 주세요."
            rows={6}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-bold resize-none focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 font-black uppercase tracking-widest text-xs gap-2 active:scale-95 transition-all"
        >
          <Send className="size-4" />
          {isSubmitting ? '전송 중...' : '문의 보내기'}
        </Button>
      </form>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Megaphone } from 'lucide-react';

/** 관리자가 /admin에서 켜둔 공지를 로그인 여부와 상관없이 모든 페이지 상단에 보여준다. */
export default function SiteBanner() {
  const [banner, setBanner] = useState<{ message: string; is_active: boolean } | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data } = await supabase.from('site_banner').select('message, is_active').eq('id', 1).maybeSingle();
      if (active) setBanner(data);
    };
    load();

    const channel = supabase
      .channel('site-banner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_banner' }, load)
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  if (!banner?.is_active || !banner.message.trim()) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/30 px-4 py-2.5 text-center text-xs md:text-sm font-bold text-primary flex flex-wrap items-center justify-center gap-x-2 gap-y-1 whitespace-pre-wrap">
      <Megaphone className="size-4 shrink-0" />
      <span>{banner.message}</span>
    </div>
  );
}

'use client';

import { useState } from 'react';
import TechNews from '@/components/feed/TechNews';
import Graveyard from '@/components/feed/Graveyard';

const TABS = [
  { id: 'news',      label: '📡 News',      desc: 'AI · Hacking · Embedded' },
  { id: 'graveyard', label: '🪦 Graveyard', desc: '서비스 장례식' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function FeedPage() {
  const [tab, setTab] = useState<TabId>('news');

  return (
    <main className="min-h-screen px-4 py-10 flex flex-col items-center gap-8">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-black uppercase tracking-tighter italic">Feed</h1>
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">AI 학습 대기 중 읽을거리</p>
      </div>

      <div className="flex gap-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
              tab === t.id
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            <span>{t.label}</span>
            <span className={`text-[9px] font-medium mt-0.5 ${tab === t.id ? 'opacity-70' : 'opacity-40'}`}>{t.desc}</span>
          </button>
        ))}
      </div>

      <div className="w-full max-w-2xl">
        {tab === 'news'      && <TechNews />}
        {tab === 'graveyard' && <Graveyard />}
      </div>
    </main>
  );
}

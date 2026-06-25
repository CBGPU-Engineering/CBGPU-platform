'use client';

import { useState } from 'react';
import TechNews from '@/components/feed/TechNews';
import Graveyard from '@/components/feed/Graveyard';
import SchoolNews from '@/components/feed/SchoolNews';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';

const TABS = [
  { id: 'school',    label: '🏫 학교 소식',   desc: '충북과학고 공지' },
  { id: 'news',      label: '📡 Tech News',   desc: 'AI · Hacking · Embedded' },
  { id: 'graveyard', label: '🪦 Graveyard',   desc: '서비스 장례식' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function FeedPage() {
  const [tab, setTab] = useState<TabId>('school');

  return (
    <main className="min-h-screen px-4 py-10 flex flex-col items-center gap-8">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-black uppercase tracking-tighter italic">Feed</h1>
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">AI 학습 대기 중 읽을거리</p>
      </div>

      <SegmentedTabs
        items={TABS.map(t => ({
          value: t.id,
          label: (
            <span className="flex flex-col items-center gap-0.5">
              <span>{t.label}</span>
              <span className="text-[9px] font-medium opacity-70">{t.desc}</span>
            </span>
          ),
        }))}
        value={tab}
        onChange={(v) => setTab(v as TabId)}
      />

      <div className="w-full max-w-2xl">
        {tab === 'school'    && <SchoolNews />}
        {tab === 'news'      && <TechNews />}
        {tab === 'graveyard' && <Graveyard />}
      </div>
    </main>
  );
}

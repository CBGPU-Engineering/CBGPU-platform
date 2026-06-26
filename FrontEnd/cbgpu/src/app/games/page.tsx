'use client';

import { useState } from 'react';
import Snake from '@/components/games/Snake';
import Tetris from '@/components/games/Tetris';
import Game2048 from '@/components/games/Game2048';
import FlappyBird from '@/components/games/FlappyBird';
import MemoryMatch from '@/components/games/MemoryMatch';
import Minesweeper from '@/components/games/Minesweeper';
import WordleKR from '@/components/games/WordleKR';
import PolyBridge from '@/components/games/PolyBridge';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';

const GAMES = [
  { id: 'flappy',     label: 'Flappy',     emoji: '🐦', tag: 'touch' },
  { id: 'memory',     label: 'Memory',     emoji: '🧠', tag: 'touch' },
  { id: 'mines',      label: 'Mines',      emoji: '💣', tag: 'touch' },
  { id: 'wordle',     label: 'Wordle',     emoji: '🇰🇷', tag: 'touch' },
  { id: 'snake',      label: 'Snake',      emoji: '🐍', tag: 'keys'  },
  { id: 'tetris',     label: 'Tetris',     emoji: '🟦', tag: 'keys'  },
  { id: '2048',       label: '2048',       emoji: '🔢', tag: 'touch' },
  { id: 'polybridge', label: 'PolyBridge', emoji: '🌉', tag: 'touch' },
] as const;

type GameId = typeof GAMES[number]['id'];

export default function GamesPage() {
  const [active, setActive] = useState<GameId>('flappy');

  return (
    <main className="min-h-screen px-4 py-10 flex flex-col items-center gap-6">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-black uppercase tracking-tighter italic">Arcade</h1>
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">AI 학습 대기 중 한 판 하세요</p>
      </div>

      <SegmentedTabs
        items={GAMES.map(g => ({
          value: g.id,
          label: (
            <span className="flex flex-col items-center gap-0.5">
              <span>{g.emoji} {g.label}</span>
              <span className={`text-[8px] font-bold ${g.tag === 'touch' ? 'text-green-500/70' : 'text-blue-500/70'}`}>
                {g.tag === 'touch' ? '👆 touch' : '⌨️ keys'}
              </span>
            </span>
          ),
        }))}
        value={active}
        onChange={(v) => setActive(v as GameId)}
        className="max-w-lg"
      />

      <div className={`w-full flex flex-col items-center ${active === 'polybridge' ? 'max-w-2xl' : 'max-w-lg'}`}>
        {active === 'flappy'     && <FlappyBird />}
        {active === 'memory'     && <MemoryMatch />}
        {active === 'mines'      && <Minesweeper />}
        {active === 'wordle'     && <WordleKR />}
        {active === 'snake'      && <Snake />}
        {active === 'tetris'     && <Tetris />}
        {active === '2048'       && <Game2048 />}
        {active === 'polybridge' && <PolyBridge />}
      </div>
    </main>
  );
}

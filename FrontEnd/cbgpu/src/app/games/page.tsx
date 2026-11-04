'use client';

import { useState } from 'react';
import Snake from '@/components/games/Snake';
import Tetris from '@/components/games/Tetris';
import Game2048 from '@/components/games/Game2048';
import FlappyBird from '@/components/games/FlappyBird';
import MemoryMatch from '@/components/games/MemoryMatch';
import Minesweeper from '@/components/games/Minesweeper';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';

const GAMES = [
  { id: 'flappy',     label: 'Flappy',     emoji: '🐦', tag: 'touch' },
  { id: 'memory',     label: 'Memory',     emoji: '🧠', tag: 'touch' },
  { id: 'mines',      label: 'Mines',      emoji: '💣', tag: 'touch' },
  { id: 'snake',      label: 'Snake',      emoji: '🐍', tag: 'keys'  },
  { id: 'tetris',     label: 'Tetris',     emoji: '🟦', tag: 'keys'  },
  { id: '2048',       label: '2048',       emoji: '🔢', tag: 'touch' },
] as const;

type GameId = typeof GAMES[number]['id'];

export default function GamesPage() {
  const [active, setActive] = useState<GameId>('flappy');

  return (
    <section className="cb-page-content min-h-screen max-w-full overflow-x-hidden px-4 py-10 flex flex-col items-center gap-6">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-black uppercase tracking-tighter italic">Arcade</h1>
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">AI 학습 대기 중 한 판 하세요</p>
      </div>

      <SegmentedTabs
        items={GAMES.map(g => ({
          value: g.id,
          label: <span>{g.emoji}</span>,
        }))}
        value={active}
        onChange={(v) => { setActive(v as GameId); }}
        className="max-w-full"
      />
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        {GAMES.find(g => g.id === active)?.label} · {GAMES.find(g => g.id === active)?.tag === 'touch' ? '👆 touch' : '⌨️ keys'}
      </p>

      <div className="w-full max-w-lg flex flex-col items-center">
        {active === 'flappy'     && <FlappyBird />}
        {active === 'memory'     && <MemoryMatch />}
        {active === 'mines'      && <Minesweeper />}
        {active === 'snake'      && <Snake />}
        {active === 'tetris'     && <Tetris />}
        {active === '2048'       && <Game2048 />}
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';
import Snake from '@/components/games/Snake';
import Tetris from '@/components/games/Tetris';
import Game2048 from '@/components/games/Game2048';

const GAMES = [
  { id: 'snake',  label: 'Snake',  emoji: '🐍', desc: 'Classic snake — eat, grow, survive' },
  { id: 'tetris', label: 'Tetris', emoji: '🟦', desc: 'Stack blocks and clear lines' },
  { id: '2048',   label: '2048',   emoji: '🔢', desc: 'Slide tiles and reach 2048' },
] as const;

type GameId = typeof GAMES[number]['id'];

export default function GamesPage() {
  const [active, setActive] = useState<GameId>('snake');

  return (
    <main className="min-h-screen px-4 py-10 flex flex-col items-center gap-8">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-black uppercase tracking-tighter italic">Arcade</h1>
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">AI 학습 대기 중 한 판 하세요</p>
      </div>

      <div className="flex gap-2">
        {GAMES.map(g => (
          <button
            key={g.id}
            onClick={() => setActive(g.id)}
            className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
              active === g.id
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {g.emoji} {g.label}
          </button>
        ))}
      </div>

      <div className="w-full max-w-lg flex flex-col items-center">
        {active === 'snake'  && <Snake />}
        {active === 'tetris' && <Tetris />}
        {active === '2048'   && <Game2048 />}
      </div>
    </main>
  );
}

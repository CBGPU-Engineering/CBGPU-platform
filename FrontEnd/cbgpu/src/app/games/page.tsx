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

const GAMES = [
  { id: 'flappy',     label: 'Flappy',     emoji: '🐦', desc: 'Tap to fly — touch friendly',  tag: 'touch' },
  { id: 'memory',     label: 'Memory',     emoji: '🧠', desc: 'Flip & match cards',            tag: 'touch' },
  { id: 'mines',      label: 'Mines',      emoji: '💣', desc: 'Classic minesweeper',           tag: 'touch' },
  { id: 'wordle',     label: 'Wordle',     emoji: '🇰🇷', desc: '5글자 한국어 단어 맞추기',        tag: 'touch' },
  { id: 'snake',      label: 'Snake',      emoji: '🐍', desc: 'Eat, grow, survive',            tag: 'keys'  },
  { id: 'tetris',     label: 'Tetris',     emoji: '🟦', desc: 'Stack blocks, clear lines',     tag: 'keys'  },
  { id: '2048',       label: '2048',       emoji: '🔢', desc: 'Slide tiles, reach 2048',       tag: 'touch' },
  { id: 'polybridge', label: 'PolyBridge', emoji: '🌉', desc: 'Build bridges, drive across',   tag: 'touch' },
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

      <div className="flex gap-1.5 flex-wrap justify-center max-w-lg">
        {GAMES.map(g => (
          <button
            key={g.id}
            onClick={() => setActive(g.id)}
            className={`flex flex-col items-center px-3 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
              active === g.id
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            <span>{g.emoji} {g.label}</span>
            <span className={`text-[8px] font-bold mt-0.5 ${g.tag === 'touch' ? 'text-green-500/70' : 'text-blue-500/70'} ${active === g.id ? 'opacity-80' : ''}`}>
              {g.tag === 'touch' ? '👆 touch' : '⌨️ keys'}
            </span>
          </button>
        ))}
      </div>

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

'use client';

import { useState } from 'react';
import Snake from '@/components/games/Snake';
import Tetris from '@/components/games/Tetris';
import Game2048 from '@/components/games/Game2048';
import FlappyBird from '@/components/games/FlappyBird';
import MemoryMatch from '@/components/games/MemoryMatch';
import Minesweeper from '@/components/games/Minesweeper';
import PolyBridge from '@/components/games/PolyBridge';
import Adofai from '@/components/games/Adofai';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';

const GAMES = [
  { id: 'adofai',     label: '얼불춤',      emoji: '🔥', tag: 'touch' },
  { id: 'flappy',     label: 'Flappy',     emoji: '🐦', tag: 'touch' },
  { id: 'memory',     label: 'Memory',     emoji: '🧠', tag: 'touch' },
  { id: 'mines',      label: 'Mines',      emoji: '💣', tag: 'touch' },
  { id: 'snake',      label: 'Snake',      emoji: '🐍', tag: 'keys'  },
  { id: 'tetris',     label: 'Tetris',     emoji: '🟦', tag: 'keys'  },
  { id: '2048',       label: '2048',       emoji: '🔢', tag: 'touch' },
  { id: 'polybridge', label: 'PolyBridge', emoji: '🌉', tag: 'touch' },
] as const;

type GameId = typeof GAMES[number]['id'];

export default function GamesPage() {
  const [active, setActive] = useState<GameId>('adofai');
  const [inGame, setInGame] = useState(true);

  return (
    <main className="min-h-screen max-w-full overflow-x-hidden px-4 py-10 flex flex-col items-center gap-6">
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
        onChange={(v) => { setActive(v as GameId); setInGame(true); }}
        className="max-w-full"
      />
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        {GAMES.find(g => g.id === active)?.label} · {GAMES.find(g => g.id === active)?.tag === 'touch' ? '👆 touch' : '⌨️ keys'}
      </p>

      <div className={`w-full max-w-full flex flex-col items-center ${active === 'polybridge' ? 'max-w-2xl' : 'max-w-lg'}`}>
        {inGame && active === 'flappy'     && <FlappyBird />}
        {inGame && active === 'memory'     && <MemoryMatch />}
        {inGame && active === 'mines'      && <Minesweeper />}
        {inGame && active === 'snake'      && <Snake />}
        {inGame && active === 'tetris'     && <Tetris />}
        {inGame && active === '2048'       && <Game2048 />}
        {inGame && active === 'polybridge' && <PolyBridge />}
        {inGame && active === 'adofai'     && <Adofai onExit={() => setInGame(false)} />}
        {!inGame && <p className="rounded-xl border border-border bg-card px-6 py-8 text-center text-sm font-bold text-muted-foreground">위 탭에서 다른 게임을 골라 시작하세요.</p>}
      </div>
    </main>
  );
}

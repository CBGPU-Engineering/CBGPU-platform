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
import { ChevronDown } from 'lucide-react';

const QUICK_GAMES = [
  { id: 'flappy',  label: 'Flappy',  emoji: '🐦', tag: 'touch' },
  { id: 'memory',  label: 'Memory',  emoji: '🧠', tag: 'touch' },
  { id: 'mines',   label: 'Mines',   emoji: '💣', tag: 'touch' },
  { id: 'wordle',  label: 'Wordle',  emoji: '🇰🇷', tag: 'touch' },
  { id: 'snake',   label: 'Snake',   emoji: '🐍', tag: 'keys'  },
  { id: 'tetris',  label: 'Tetris',  emoji: '🟦', tag: 'keys'  },
  { id: '2048',    label: '2048',    emoji: '🔢', tag: 'touch' },
] as const;

type QuickGameId = typeof QUICK_GAMES[number]['id'];

export default function GamesPage() {
  const [active, setActive] = useState<QuickGameId>('flappy');
  const [showPoly, setShowPoly] = useState(false);

  return (
    <main className="min-h-screen px-4 py-10 flex flex-col items-center gap-10">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-black uppercase tracking-tighter italic">Arcade</h1>
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">AI 학습 대기 중 한 판 하세요</p>
      </div>

      <div className="w-full flex flex-col items-center gap-6">
        <SegmentedTabs
          items={QUICK_GAMES.map(g => ({
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
          onChange={(v) => setActive(v as QuickGameId)}
          className="max-w-lg justify-center"
        />

        <div className="w-full max-w-lg flex flex-col items-center">
          {active === 'flappy'  && <FlappyBird />}
          {active === 'memory'  && <MemoryMatch />}
          {active === 'mines'   && <Minesweeper />}
          {active === 'wordle'  && <WordleKR />}
          {active === 'snake'   && <Snake />}
          {active === 'tetris'  && <Tetris />}
          {active === '2048'    && <Game2048 />}
        </div>
      </div>

      {/* 퀵 게임들과는 결이 다른 정밀 퍼즐 — 같은 탭 줄에 섞지 않고 따로 분리해서 둔다 */}
      <div className="w-full max-w-2xl">
        <button
          type="button"
          onClick={() => setShowPoly(v => !v)}
          className="tilt-3d w-full flex items-center gap-4 p-5 rounded-[28px] bg-card ring-1 ring-foreground/5 shadow-sm text-left"
        >
          <span className="flex items-center justify-center size-12 rounded-2xl bg-violet-400/10 text-2xl shrink-0">🌉</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-black text-sm">Poly Bridge</p>
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-400/10 text-violet-500">정밀 퍼즐</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">다리를 설계하고 트럭이 건너가게 하세요 — 시간 들여 푸는 물리 퍼즐</p>
          </div>
          <ChevronDown className={`size-4 text-muted-foreground shrink-0 transition-transform duration-300 ${showPoly ? 'rotate-180' : ''}`} />
        </button>

        {showPoly && (
          <div className="mt-4 flex flex-col items-center animate-in fade-in slide-in-from-top-2 duration-300">
            <PolyBridge />
          </div>
        )}
      </div>
    </main>
  );
}

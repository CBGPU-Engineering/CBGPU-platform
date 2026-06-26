'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

const EMOJIS = ['🐱','🐶','🦊','🐼','🐸','🦁','🐯','🦋','🌈','🍕','🚀','⚡'];

interface Card { id: number; emoji: string; flipped: boolean; matched: boolean }

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function makeCards(count: number): Card[] {
  const pool = EMOJIS.slice(0, count);
  return shuffle([...pool, ...pool]).map((emoji, id) => ({ id, emoji, flipped: false, matched: false }));
}

export default function MemoryMatch() {
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matched, setMatched] = useState(0);
  const [locked, setLocked] = useState(false);
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [pairs, setPairs] = useState(6);
  const [done, setDone] = useState(false);

  const start = useCallback((p = pairs) => {
    setCards(makeCards(p));
    setFlipped([]); setMoves(0); setMatched(0);
    setLocked(false); setTime(0); setRunning(false); setDone(false);
  }, [pairs]);

  useEffect(() => { start(); }, []);

  useEffect(() => {
    if (!running || done) return;
    const t = setInterval(() => setTime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running, done]);

  const flip = useCallback((id: number) => {
    if (locked || done) return;
    const card = cards[id];
    if (card.flipped || card.matched || flipped.includes(id)) return;
    if (!running) setRunning(true);

    const next = [...flipped, id];
    setCards(prev => prev.map((c, i) => i === id ? { ...c, flipped: true } : c));
    setFlipped(next);

    if (next.length === 2) {
      setMoves(m => m + 1);
      setLocked(true);
      const [a, b] = next;
      if (cards[a].emoji === cards[b].emoji) {
        setCards(prev => prev.map((c, i) => next.includes(i) ? { ...c, matched: true } : c));
        setMatched(m => {
          const nm = m + 1;
          if (nm === pairs) { setDone(true); setRunning(false); }
          return nm;
        });
        setFlipped([]);
        setLocked(false);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map((c, i) => next.includes(i) ? { ...c, flipped: false } : c));
          setFlipped([]);
          setLocked(false);
        }, 900);
      }
    }
  }, [locked, done, cards, flipped, running, pairs]);

  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const cols = pairs <= 6 ? 4 : 6;
  const maxBoardPx = pairs <= 6 ? 312 : 396;

  return (
    <div className="flex flex-col items-center gap-5">
      {/* controls */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <div className="flex gap-1">
          {[6, 8, 12].map(p => (
            <button key={p} onClick={() => { setPairs(p); start(p); }}
              className={`px-3 py-1.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all ${
                pairs === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
              {p === 6 ? 'Easy' : p === 8 ? 'Mid' : 'Hard'}
            </button>
          ))}
        </div>
        <div className="flex gap-3 text-sm font-black">
          <span className="text-muted-foreground uppercase tracking-widest text-[11px]">⏱ {fmt(time)}</span>
          <span className="text-muted-foreground uppercase tracking-widest text-[11px]">🔄 {moves}</span>
          <span className="text-muted-foreground uppercase tracking-widest text-[11px]">✅ {matched}/{pairs}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => start()} className="font-black text-xs uppercase">Reset</Button>
      </div>

      {/* grid — 뷰포트 너비에 맞춰 카드 크기가 줄어들도록 vw로 상한을 둔다 */}
      <div
        className="grid gap-2 touch-none"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, width: `min(${maxBoardPx}px, 90vw)` }}
      >
        {cards.map((card, i) => (
          <div
            key={card.id}
            onClick={() => flip(i)}
            onTouchStart={e => { e.preventDefault(); flip(i); }}
            style={{ aspectRatio: '1 / 1', perspective: 600, cursor: 'pointer' }}
          >
            <div style={{
              width: '100%', height: '100%',
              position: 'relative', transformStyle: 'preserve-3d',
              transition: 'transform 0.35s ease',
              transform: card.flipped || card.matched ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}>
              {/* back */}
              <div style={{
                position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                fontSize: 'min(22px, 7vw)', userSelect: 'none',
              }}>❓</div>
              {/* front */}
              <div style={{
                position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)', borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: card.matched ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                border: card.matched ? '2px solid rgba(34,197,94,0.4)' : '2px solid rgba(255,255,255,0.1)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                fontSize: `min(${maxBoardPx / cols * 0.45}px, ${90 / cols * 0.45}vw)`, userSelect: 'none',
                filter: card.matched ? 'none' : undefined,
              }}>{card.emoji}</div>
            </div>
          </div>
        ))}
      </div>

      {done && (
        <div className="text-center space-y-2 p-4 bg-green-500/10 border border-green-500/30 rounded-2xl">
          <p className="font-black text-green-500 uppercase tracking-widest text-lg">🎉 클리어!</p>
          <p className="text-sm text-muted-foreground font-medium">{fmt(time)} · {moves}회 시도</p>
          <Button onClick={() => start()} className="font-black uppercase tracking-widest mt-1">다시 하기</Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground font-medium">카드를 탭해서 짝을 맞추세요</p>
    </div>
  );
}

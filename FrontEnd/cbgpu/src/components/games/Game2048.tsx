'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

type Grid = (number | null)[][];

function createGrid(): Grid {
  return addRandom(addRandom(Array.from({ length: 4 }, () => Array(4).fill(null))));
}

function addRandom(g: Grid): Grid {
  const empty: [number, number][] = [];
  g.forEach((row, r) => row.forEach((v, c) => { if (!v) empty.push([r, c]); }));
  if (!empty.length) return g;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  return g.map((row, ri) => row.map((v, ci) => (ri === r && ci === c ? (Math.random() < 0.9 ? 2 : 4) : v)));
}

function slideRow(row: (number | null)[]): { row: (number | null)[]; score: number } {
  const vals = row.filter(Boolean) as number[];
  let score = 0;
  const merged: (number | null)[] = [];
  let i = 0;
  while (i < vals.length) {
    if (i + 1 < vals.length && vals[i] === vals[i + 1]) { merged.push(vals[i] * 2); score += vals[i] * 2; i += 2; }
    else { merged.push(vals[i]); i++; }
  }
  while (merged.length < 4) merged.push(null);
  return { row: merged, score };
}

function applyMove(g: Grid, dir: 'left' | 'right' | 'up' | 'down'): { grid: Grid; score: number } {
  let score = 0;
  const transpose = (m: Grid): Grid => m[0].map((_, i) => m.map(row => row[i]));
  let grid = g.map(row => [...row]);

  if (dir === 'left') {
    grid = grid.map(row => { const r = slideRow(row); score += r.score; return r.row; });
  } else if (dir === 'right') {
    grid = grid.map(row => { const r = slideRow([...row].reverse()); score += r.score; return r.row.reverse(); });
  } else if (dir === 'up') {
    grid = transpose(transpose(grid).map(row => { const r = slideRow(row); score += r.score; return r.row; }));
  } else {
    grid = transpose(transpose(grid).map(row => { const r = slideRow([...row].reverse()); score += r.score; return r.row.reverse(); }));
  }
  return { grid, score };
}

function isOver(g: Grid): boolean {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    if (!g[r][c]) return false;
    if (c < 3 && g[r][c] === g[r][c + 1]) return false;
    if (r < 3 && g[r][c] === g[r + 1][c]) return false;
  }
  return true;
}

const COLORS: Record<number, string> = {
  2:    'bg-amber-100 text-gray-800',
  4:    'bg-amber-200 text-gray-800',
  8:    'bg-orange-300 text-white',
  16:   'bg-orange-400 text-white',
  32:   'bg-orange-500 text-white',
  64:   'bg-red-500 text-white',
  128:  'bg-yellow-400 text-white',
  256:  'bg-yellow-500 text-white',
  512:  'bg-green-500 text-white',
  1024: 'bg-green-600 text-white',
  2048: 'bg-green-700 text-white',
};

function fontSize(v: number) {
  if (v >= 1024) return 'text-base';
  if (v >= 128) return 'text-lg';
  return 'text-xl';
}

export default function Game2048() {
  const [grid, setGrid] = useState<Grid>(createGrid);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);

  const reset = () => { setGrid(createGrid()); setScore(0); setOver(false); setWon(false); };

  const handleMove = useCallback((dir: 'left' | 'right' | 'up' | 'down') => {
    if (over) return;
    setGrid(prev => {
      const { grid: ng, score: gained } = applyMove(prev, dir);
      if (JSON.stringify(ng) === JSON.stringify(prev)) return prev;
      const final = addRandom(ng);
      setScore(s => { const ns = s + gained; setBest(b => Math.max(b, ns)); return ns; });
      if (!won && final.flat().includes(2048)) setWon(true);
      if (isOver(final)) setOver(true);
      return final;
    });
  }, [over, won]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, 'left' | 'right' | 'up' | 'down'> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      if (map[e.key]) { e.preventDefault(); handleMove(map[e.key]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleMove]);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-6">
        <div className="text-center bg-muted px-4 py-2 rounded-lg"><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Score</p><p className="text-xl font-black">{score}</p></div>
        <div className="text-center bg-muted px-4 py-2 rounded-lg"><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Best</p><p className="text-xl font-black">{best}</p></div>
        <Button onClick={reset} variant="outline" size="sm" className="font-black text-xs uppercase tracking-widest">New Game</Button>
      </div>

      <div className="p-3 bg-muted rounded-2xl shadow-lg">
        <div className="grid grid-cols-4 gap-2">
          {grid.flat().map((val, i) => (
            <div key={i} className={`w-[72px] h-[72px] flex items-center justify-center rounded-xl font-black transition-all duration-100 ${val ? (COLORS[val] || 'bg-emerald-800 text-white') + ' ' + fontSize(val) : 'bg-muted-foreground/10'}`}>
              {val ?? ''}
            </div>
          ))}
        </div>
      </div>

      {won && !over && (
        <div className="flex items-center gap-3 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-xl">
          <p className="text-green-500 font-black uppercase tracking-widest text-sm">You reached 2048!</p>
          <Button onClick={() => setWon(false)} size="sm" variant="outline" className="font-black text-xs">Keep going</Button>
        </div>
      )}
      {over && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-destructive font-black uppercase tracking-widest">Game Over!</p>
          <Button onClick={reset} className="font-black uppercase tracking-widest">Restart</Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground font-medium">Arrow keys to slide tiles · reach 2048!</p>
    </div>
  );
}

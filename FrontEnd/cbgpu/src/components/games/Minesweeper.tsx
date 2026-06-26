'use client';
import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';

type Cell = { mine: boolean; revealed: boolean; flagged: boolean; adj: number };
type Grid = Cell[][];
type Phase = 'idle' | 'playing' | 'won' | 'lost';

const LEVELS = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  medium: { rows: 12, cols: 12, mines: 24 },
  hard:   { rows: 14, cols: 16, mines: 40 },
} as const;
type Level = keyof typeof LEVELS;

function makeGrid(rows: number, cols: number): Grid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, adj: 0 })));
}

function placeMines(grid: Grid, rows: number, cols: number, mines: number, safeR: number, safeC: number): Grid {
  const g = grid.map(r => r.map(c => ({ ...c })));
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (!g[r][c].mine && Math.abs(r - safeR) > 1 || Math.abs(c - safeC) > 1) {
      if (!g[r][c].mine) { g[r][c].mine = true; placed++; }
    }
  }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (g[r][c].mine) continue;
      let cnt = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && g[nr][nc].mine) cnt++;
      }
      g[r][c].adj = cnt;
    }
  return g;
}

function flood(grid: Grid, r: number, c: number, rows: number, cols: number): Grid {
  const g = grid.map(row => row.map(cell => ({ ...cell })));
  const queue: [number, number][] = [[r, c]];
  while (queue.length) {
    const [cr, cc] = queue.shift()!;
    if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) continue;
    const cell = g[cr][cc];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    if (cell.adj === 0)
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++)
        if (dr !== 0 || dc !== 0) queue.push([cr + dr, cc + dc]);
  }
  return g;
}

const ADJ_COLORS = ['', '#3b82f6','#22c55e','#ef4444','#8b5cf6','#f97316','#06b6d4','#e11d48','#6b7280'];

export default function Minesweeper() {
  const [level, setLevel] = useState<Level>('easy');
  const [grid, setGrid] = useState<Grid>(() => makeGrid(9, 9));
  const [phase, setPhase] = useState<Phase>('idle');
  const [flagMode, setFlagMode] = useState(false);
  const [flags, setFlags] = useState(0);
  const [time, setTime] = useState(0);
  const [firstClick, setFirstClick] = useState(true);

  const cfg = LEVELS[level];

  const reset = useCallback((lv: Level = level) => {
    setGrid(makeGrid(LEVELS[lv].rows, LEVELS[lv].cols));
    setPhase('idle'); setFlags(0); setTime(0); setFirstClick(true); setFlagMode(false);
  }, [level]);

  useEffect(() => { reset(level); }, [level]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const t = setInterval(() => setTime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const reveal = useCallback((r: number, c: number) => {
    if (phase === 'won' || phase === 'lost') return;
    let g = grid;
    if (firstClick) {
      g = placeMines(makeGrid(cfg.rows, cfg.cols), cfg.rows, cfg.cols, cfg.mines, r, c);
      setFirstClick(false);
      setPhase('playing');
    }
    const cell = g[r][c];
    if (cell.revealed || cell.flagged) return;
    if (cell.mine) {
      const ng = g.map(row => row.map(cl => ({ ...cl, revealed: cl.mine ? true : cl.revealed })));
      setGrid(ng); setPhase('lost'); return;
    }
    const ng = flood(g, r, c, cfg.rows, cfg.cols);
    setGrid(ng);
    const unrevealed = ng.flat().filter(cl => !cl.mine && !cl.revealed).length;
    if (unrevealed === 0) setPhase('won');
  }, [grid, phase, firstClick, cfg]);

  const flag = useCallback((r: number, c: number) => {
    if (phase === 'won' || phase === 'lost') return;
    const cell = grid[r][c];
    if (cell.revealed) return;
    const ng = grid.map((row, ri) => row.map((cl, ci) =>
      ri === r && ci === c ? { ...cl, flagged: !cl.flagged } : cl
    ));
    setGrid(ng);
    setFlags(f => cell.flagged ? f - 1 : f + 1);
  }, [grid, phase]);

  const handleCell = useCallback((e: React.MouseEvent | React.TouchEvent, r: number, c: number) => {
    e.preventDefault();
    if (flagMode) flag(r, c);
    else reveal(r, c);
  }, [flagMode, flag, reveal]);

  const maxBoardPx = (level === 'hard' ? 28 : level === 'medium' ? 32 : 38) * cfg.cols;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* difficulty + hud */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {(Object.keys(LEVELS) as Level[]).map(lv => (
          <button key={lv} onClick={() => { setLevel(lv); reset(lv); }}
            className={`px-3 py-1.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all ${
              level === lv ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>{lv}</button>
        ))}
        <span className="text-[11px] font-black text-muted-foreground ml-1">💣 {cfg.mines - flags}</span>
        <span className="text-[11px] font-black text-muted-foreground">⏱ {time}s</span>
        <Button variant="outline" size="sm" className="font-black text-xs uppercase" onClick={() => reset()}>Reset</Button>
      </div>

      {/* flag toggle (touch mode) */}
      <button
        onClick={() => setFlagMode(f => !f)}
        className={`px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
          flagMode ? 'bg-amber-500 text-white shadow-md' : 'bg-muted text-muted-foreground'
        }`}
      >
        {flagMode ? '🚩 깃발 모드 ON' : '👆 클릭 모드'}
      </button>

      {/* board — 뷰포트보다 넓어지면 cols당 폭이 줄어들도록 vw로 상한을 둔다 */}
      <div
        className="grid border-2 border-border/50 rounded-xl overflow-hidden shadow-lg"
        style={{ gridTemplateColumns: `repeat(${cfg.cols}, 1fr)`, width: `min(${maxBoardPx}px, 94vw)` }}
        onContextMenu={e => e.preventDefault()}
      >
        {grid.map((row, r) => row.map((cell, c) => {
          let bg = 'bg-muted/30 hover:bg-muted/60';
          if (cell.revealed) bg = cell.mine ? 'bg-red-500/80' : 'bg-muted/10';

          return (
            <div
              key={`${r}-${c}`}
              style={{ aspectRatio: '1 / 1', fontSize: `min(${maxBoardPx / cfg.cols * 0.45}px, ${94 / cfg.cols * 0.45}vw)` }}
              className={`flex items-center justify-center font-black border border-border/20 cursor-pointer select-none transition-colors touch-none ${bg}`}
              onClick={e => handleCell(e, r, c)}
              onTouchStart={e => handleCell(e, r, c)}
              onContextMenu={e => { e.preventDefault(); flag(r, c); }}
            >
              {cell.flagged && !cell.revealed ? '🚩' :
               cell.revealed && cell.mine ? '💣' :
               cell.revealed && cell.adj > 0 ? (
                 <span style={{ color: ADJ_COLORS[cell.adj] }}>{cell.adj}</span>
               ) : null}
            </div>
          );
        }))}
      </div>

      {(phase === 'won' || phase === 'lost') && (
        <div className={`text-center p-4 rounded-2xl border ${phase === 'won' ? 'bg-green-500/10 border-green-500/30' : 'bg-destructive/10 border-destructive/30'}`}>
          <p className={`font-black uppercase tracking-widest text-lg ${phase === 'won' ? 'text-green-500' : 'text-destructive'}`}>
            {phase === 'won' ? '🎉 클리어!' : '💥 폭발!'}
          </p>
          <p className="text-sm text-muted-foreground mt-1 font-medium">{time}초</p>
          <Button onClick={() => reset()} className="mt-2 font-black uppercase tracking-widest">다시 하기</Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground font-medium">
        탭=열기 · 우클릭/깃발모드=깃발 · 숫자=인접 지뢰 수
      </p>
    </div>
  );
}

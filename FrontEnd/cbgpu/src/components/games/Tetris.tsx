'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, ArrowDown, RotateCw, ChevronsDown } from 'lucide-react';

const COLS = 10;
const ROWS = 20;
const CELL = 28;

const PIECES = [
  { shape: [[1,1,1,1]], color: '#06b6d4' },
  { shape: [[1,1],[1,1]], color: '#eab308' },
  { shape: [[0,1,0],[1,1,1]], color: '#a855f7' },
  { shape: [[0,1,1],[1,1,0]], color: '#22c55e' },
  { shape: [[1,1,0],[0,1,1]], color: '#ef4444' },
  { shape: [[1,0,0],[1,1,1]], color: '#3b82f6' },
  { shape: [[0,0,1],[1,1,1]], color: '#f97316' },
];

type Board = (string | null)[][];
type Piece = { shape: number[][]; color: string; x: number; y: number };

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randPiece(): Piece {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  return { shape: p.shape.map(r => [...r]), color: p.color, x: Math.floor(COLS / 2) - Math.floor(p.shape[0].length / 2), y: 0 };
}

function rotate90(shape: number[][]): number[][] {
  return shape[0].map((_, i) => shape.map(row => row[i]).reverse());
}

function valid(board: Board, piece: Piece, dx = 0, dy = 0, shape = piece.shape): boolean {
  return shape.every((row, r) =>
    row.every((cell, c) => {
      if (!cell) return true;
      const nx = piece.x + c + dx, ny = piece.y + r + dy;
      return nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && !board[ny]?.[nx];
    })
  );
}

export default function Tetris() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sRef = useRef({ board: createBoard(), piece: null as Piece | null, next: randPiece(), score: 0, lines: 0, running: false });
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { board, piece } = sRef.current;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c*CELL, 0); ctx.lineTo(c*CELL, ROWS*CELL); ctx.stroke(); }
    for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r*CELL); ctx.lineTo(COLS*CELL, r*CELL); ctx.stroke(); }

    board.forEach((row, r) => row.forEach((color, c) => {
      if (!color) return;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(c*CELL+1, r*CELL+1, CELL-2, CELL-2, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.roundRect(c*CELL+2, r*CELL+2, CELL-4, 6, 2); ctx.fill();
    }));

    if (piece) {
      // ghost piece
      let ghostY = piece.y;
      while (valid(board, piece, 0, ghostY - piece.y + 1)) ghostY++;
      if (ghostY !== piece.y) {
        piece.shape.forEach((row, r) => row.forEach((cell, c) => {
          if (!cell) return;
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.beginPath(); ctx.roundRect((piece.x+c)*CELL+1, (ghostY+r)*CELL+1, CELL-2, CELL-2, 3); ctx.fill();
        }));
      }

      piece.shape.forEach((row, r) => row.forEach((cell, c) => {
        if (!cell) return;
        ctx.fillStyle = piece.color;
        ctx.beginPath(); ctx.roundRect((piece.x+c)*CELL+1, (piece.y+r)*CELL+1, CELL-2, CELL-2, 3); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.roundRect((piece.x+c)*CELL+2, (piece.y+r)*CELL+2, CELL-4, 6, 2); ctx.fill();
      }));
    }
  }, []);

  const lock = useCallback(() => {
    const s = sRef.current;
    if (!s.piece) return;
    s.piece.shape.forEach((row, r) => row.forEach((cell, c) => {
      if (cell) s.board[s.piece!.y + r][s.piece!.x + c] = s.piece!.color;
    }));
    let cleared = 0;
    s.board = s.board.filter(row => { if (row.every(c => c)) { cleared++; return false; } return true; });
    while (s.board.length < ROWS) s.board.unshift(Array(COLS).fill(null));
    const pts = [0, 100, 300, 500, 800];
    s.score += pts[cleared] || 0;
    s.lines += cleared;
    setScore(s.score); setLines(s.lines);
    s.piece = s.next;
    s.next = randPiece();
    if (!valid(s.board, s.piece)) {
      s.running = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      setGameOver(true);
    }
    draw();
  }, [draw]);

  const tick = useCallback(() => {
    const s = sRef.current;
    if (!s.piece || !s.running || pausedRef.current) return;
    if (valid(s.board, s.piece, 0, 1)) { s.piece.y++; draw(); } else lock();
  }, [draw, lock]);

  const start = useCallback(() => {
    const s = sRef.current;
    s.board = createBoard(); s.piece = randPiece(); s.next = randPiece();
    s.score = 0; s.lines = 0; s.running = true;
    setScore(0); setLines(0); setGameOver(false); setStarted(true); setPaused(false);
    pausedRef.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, 400);
    draw();
  }, [tick, draw]);

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }, []);

  const moveLeft = useCallback(() => {
    const s = sRef.current;
    if (!s.piece || !s.running || pausedRef.current) return;
    if (valid(s.board, s.piece, -1)) { s.piece.x--; draw(); }
  }, [draw]);
  const moveRight = useCallback(() => {
    const s = sRef.current;
    if (!s.piece || !s.running || pausedRef.current) return;
    if (valid(s.board, s.piece, 1)) { s.piece.x++; draw(); }
  }, [draw]);
  const softDrop = useCallback(() => {
    const s = sRef.current;
    if (!s.piece || !s.running || pausedRef.current) return;
    if (valid(s.board, s.piece, 0, 1)) { s.piece.y++; draw(); } else lock();
  }, [draw, lock]);
  const rotatePiece = useCallback(() => {
    const s = sRef.current;
    if (!s.piece || !s.running || pausedRef.current) return;
    const rot = rotate90(s.piece.shape);
    if (valid(s.board, s.piece, 0, 0, rot)) { s.piece.shape = rot; draw(); }
  }, [draw]);
  const hardDrop = useCallback(() => {
    const s = sRef.current;
    if (!s.piece || !s.running || pausedRef.current) return;
    while (valid(s.board, s.piece, 0, 1)) s.piece.y++;
    lock();
  }, [lock]);

  useEffect(() => {
    draw();
    const onKey = (e: KeyboardEvent) => {
      const s = sRef.current;
      if (!s.piece || !s.running) return;
      if (e.key === 'p' || e.key === 'P') { togglePause(); return; }
      if (pausedRef.current) return;
      if (['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' '].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowLeft') moveLeft();
      if (e.key === 'ArrowRight') moveRight();
      if (e.key === 'ArrowDown') softDrop();
      if (e.key === 'ArrowUp') rotatePiece();
      if (e.key === ' ') hardDrop();
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [draw, togglePause, moveLeft, moveRight, softDrop, rotatePiece, hardDrop]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-6">
        <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Score</p><p className="text-xl font-black">{score}</p></div>
        <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Lines</p><p className="text-xl font-black">{lines}</p></div>
        {started && !gameOver && <Button variant="outline" size="sm" onClick={togglePause} className="font-black text-xs uppercase">{paused ? 'Resume' : 'Pause'}</Button>}
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef} width={COLS * CELL} height={ROWS * CELL}
          className="border border-border rounded-xl shadow-lg"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
        {paused && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
            <p className="text-2xl font-black uppercase tracking-widest">Paused</p>
          </div>
        )}
      </div>
      {(!started || gameOver) && (
        <div className="flex flex-col items-center gap-2">
          {gameOver && <p className="text-destructive font-black uppercase tracking-widest">Game Over!</p>}
          <Button onClick={start} className="font-black uppercase tracking-widest">{gameOver ? 'Restart' : 'Start Game'}</Button>
        </div>
      )}

      {/* 터치 컨트롤 — 키보드 없는 화면에서도 5가지 동작을 명확히 분리해서 누를 수 있게 */}
      {started && !gameOver && (
        <div className="flex md:hidden items-center gap-2 select-none">
          <button onClick={moveLeft} className="flex items-center justify-center size-12 rounded-2xl bg-card ring-1 ring-foreground/10 shadow-sm active:scale-90 transition-transform"><ArrowLeft className="size-5" /></button>
          <button onClick={rotatePiece} className="flex items-center justify-center size-12 rounded-2xl bg-card ring-1 ring-foreground/10 shadow-sm active:scale-90 transition-transform"><RotateCw className="size-5" /></button>
          <button onClick={moveRight} className="flex items-center justify-center size-12 rounded-2xl bg-card ring-1 ring-foreground/10 shadow-sm active:scale-90 transition-transform"><ArrowRight className="size-5" /></button>
          <button onClick={softDrop} className="flex items-center justify-center size-12 rounded-2xl bg-card ring-1 ring-foreground/10 shadow-sm active:scale-90 transition-transform"><ArrowDown className="size-5" /></button>
          <button onClick={hardDrop} className="flex items-center justify-center size-12 rounded-2xl bg-primary text-primary-foreground shadow-sm active:scale-90 transition-transform"><ChevronsDown className="size-5" /></button>
        </div>
      )}
      <p className="text-xs text-muted-foreground font-medium hidden md:block">← → move · ↑ rotate · ↓ drop · Space hard drop · P pause</p>
    </div>
  );
}

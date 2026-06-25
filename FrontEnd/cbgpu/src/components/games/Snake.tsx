'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

const CELL = 22;
const COLS = 20;
const ROWS = 20;

type Point = { x: number; y: number };
type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const OPPOSITE: Record<Dir, Dir> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

function randFood(snake: Point[]): Point {
  let pos: Point;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
}

export default function Snake() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gRef = useRef({
    snake: [{ x: 10, y: 10 }] as Point[],
    dir: 'RIGHT' as Dir,
    nextDir: 'RIGHT' as Dir,
    food: { x: 5, y: 5 } as Point,
    running: false,
    score: 0,
  });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const g = gRef.current;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= COLS; i++) { ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, ROWS * CELL); ctx.stroke(); }
    for (let i = 0; i <= ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(COLS * CELL, i * CELL); ctx.stroke(); }

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(g.food.x * CELL + CELL / 2, g.food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    g.snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? '#22c55e' : i < 3 ? '#16a34a' : '#15803d';
      const r = i === 0 ? 4 : 2;
      ctx.beginPath();
      ctx.roundRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, r);
      ctx.fill();
    });
  }, []);

  const placePiece = useCallback(() => {
    const g = gRef.current;
    g.dir = g.nextDir;
    const head = g.snake[0];
    const nh: Point = {
      x: head.x + (g.dir === 'RIGHT' ? 1 : g.dir === 'LEFT' ? -1 : 0),
      y: head.y + (g.dir === 'DOWN' ? 1 : g.dir === 'UP' ? -1 : 0),
    };

    if (nh.x < 0 || nh.x >= COLS || nh.y < 0 || nh.y >= ROWS || g.snake.some(s => s.x === nh.x && s.y === nh.y)) {
      g.running = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      setGameOver(true);
      return;
    }

    const ate = nh.x === g.food.x && nh.y === g.food.y;
    g.snake = [nh, ...g.snake];
    if (!ate) g.snake.pop();
    else { g.food = randFood(g.snake); g.score++; setScore(g.score); }
    draw();
  }, [draw]);

  const start = useCallback(() => {
    const g = gRef.current;
    g.snake = [{ x: 10, y: 10 }];
    g.dir = 'RIGHT'; g.nextDir = 'RIGHT';
    g.food = randFood(g.snake);
    g.score = 0; g.running = true;
    setScore(0); setGameOver(false); setStarted(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(placePiece, 110);
    draw();
  }, [placePiece, draw]);

  const setNextDir = useCallback((nd: Dir) => {
    const g = gRef.current;
    if (g.dir !== OPPOSITE[nd]) g.nextDir = nd;
  }, []);

  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const t = e.touches[0];
    touchOrigin.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const origin = touchOrigin.current;
    touchOrigin.current = null;
    if (!origin) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - origin.x;
    const dy = t.clientY - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return;
    if (Math.abs(dx) > Math.abs(dy)) setNextDir(dx > 0 ? 'RIGHT' : 'LEFT');
    else setNextDir(dy > 0 ? 'DOWN' : 'UP');
  };

  useEffect(() => {
    draw();
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT' };
      const nd = map[e.key];
      if (!nd) return;
      e.preventDefault();
      setNextDir(nd);
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [draw, setNextDir]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <span className="text-sm font-black uppercase tracking-widest">Score: {score}</span>
        {started && !gameOver && <Button variant="outline" size="sm" onClick={() => { if (intervalRef.current) clearInterval(intervalRef.current); setGameOver(true); }}>Stop</Button>}
      </div>
      <canvas
        ref={canvasRef} width={COLS * CELL} height={ROWS * CELL}
        className="border border-border rounded-xl shadow-lg touch-none select-none"
        style={{ maxWidth: '100%', height: 'auto' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />
      {(!started || gameOver) && (
        <div className="flex flex-col items-center gap-2">
          {gameOver && <p className="text-destructive font-black uppercase tracking-widest">Game Over!</p>}
          <Button onClick={start} className="font-black uppercase tracking-widest">{gameOver ? 'Restart' : 'Start Game'}</Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground font-medium">화살표/WASD 또는 화면에서 스와이프로 이동</p>
    </div>
  );
}

'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Vec2 { x: number; y: number }
interface PhysNode {
  id: number; x: number; y: number;
  px: number; py: number;
  pinned: boolean;
}
interface Edge {
  id: number; a: number; b: number;
  mat: Material;
  restLen: number;
  stress: number;
  broken: boolean;
}
interface Vehicle {
  x: number; y: number;
  vx: number; vy: number;
  w: number; h: number;
  onGround: boolean;
  done: boolean;
  fell: boolean;
}
type NodeSnapshot = { id: number; x: number; y: number }[];
type Material = 'road' | 'wood' | 'steel' | 'cable';
type Phase = 'build' | 'test' | 'win' | 'lose';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAT: Record<Material, { color: string; maxStress: number; stiffness: number; tensionOnly: boolean; cost: number; label: string }> = {
  road:  { color: '#94a3b8', maxStress: 0.65, stiffness: 0.9,  tensionOnly: false, cost: 10, label: '도로' },
  wood:  { color: '#92400e', maxStress: 0.75, stiffness: 0.85, tensionOnly: false, cost: 6,  label: '나무' },
  steel: { color: '#475569', maxStress: 1.1,  stiffness: 0.98, tensionOnly: false, cost: 18, label: '철골' },
  cable: { color: '#b45309', maxStress: 0.9,  stiffness: 0.6,  tensionOnly: true,  cost: 8,  label: '케이블' },
};

const GRAVITY    = 600;
const SUBSTEPS   = 8;
const MAX_BUDGET = 300;
const W = 640; const H = 420;

const LEFT_CLIFF  = { x: 0,   y: 200, w: 110, h: H - 200 };
const RIGHT_CLIFF = { x: 530, y: 200, w: W - 530, h: H - 200 };
const WATER_Y = H - 60;

const ANCHORS: { x: number; y: number }[] = [
  { x: 110, y: 200 }, { x: 110, y: 240 }, { x: 110, y: 280 },
  { x: 530, y: 200 }, { x: 530, y: 240 }, { x: 530, y: 280 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function dist(a: Vec2, b: Vec2) { return Math.hypot(b.x - a.x, b.y - a.y); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function stressColor(s: number, broken: boolean): string {
  if (broken) return '#ef4444';
  if (s < 0.4) return '#22c55e';
  if (s < 0.7) return `hsl(${lerp(120, 45, (s - 0.4) / 0.3)}, 80%, 50%)`;
  return `hsl(${lerp(45, 0, (s - 0.7) / 0.3)}, 90%, 50%)`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PolyBridge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const s = useRef({
    nodes:        [] as PhysNode[],
    edges:        [] as Edge[],
    vehicle:      null as Vehicle | null,
    phase:        'build' as Phase,
    mat:          'road' as Material,
    budget:       MAX_BUDGET,
    hoverNode:    -1,
    dragFrom:     -1,
    mouseX:       0,
    mouseY:       0,
    nextNodeId:   0,
    nextEdgeId:   0,
    nodeSnapshot: [] as NodeSnapshot,  // positions captured before test
  });
  const rafRef  = useRef<number>(0);
  const lastRef = useRef<number>(0);

  const [phase,  setPhase]  = useState<Phase>('build');
  const [mat,    setMat]    = useState<Material>('road');
  const [budget, setBudget] = useState(MAX_BUDGET);

  useEffect(() => { s.current.mat = mat; }, [mat]);

  // ── Init ──────────────────────────────────────────────────────────────────
  const initLevel = useCallback(() => {
    const r = s.current;
    r.nodes = ANCHORS.map((a, i) => ({
      id: i, x: a.x, y: a.y, px: a.x, py: a.y, pinned: true,
    }));
    r.edges = [];
    r.vehicle = null;
    r.phase = 'build';
    r.budget = MAX_BUDGET;
    r.nextNodeId = ANCHORS.length;
    r.nextEdgeId = 0;
    r.dragFrom = -1;
    r.nodeSnapshot = [];
    setPhase('build');
    setBudget(MAX_BUDGET);
  }, []);

  useEffect(() => { initLevel(); }, [initLevel]);

  // ── Node helpers ──────────────────────────────────────────────────────────
  const nearestNode = (x: number, y: number, maxD = 18): number => {
    const r = s.current;
    let best = -1, bestD = maxD;
    for (const n of r.nodes) {
      const d = dist({ x, y }, n);
      if (d < bestD) { bestD = d; best = n.id; }
    }
    return best;
  };

  const getOrCreateNode = (x: number, y: number): number => {
    const r = s.current;
    const ex = nearestNode(x, y, 16);
    if (ex >= 0) return ex;
    const id = r.nextNodeId++;
    r.nodes.push({ id, x, y, px: x, py: y, pinned: false });
    return id;
  };

  const addEdge = (ai: number, bi: number) => {
    const r = s.current;
    const na = r.nodes.find(n => n.id === ai);
    const nb = r.nodes.find(n => n.id === bi);
    if (!na || !nb || ai === bi) return;
    if (r.edges.some(e => (e.a === ai && e.b === bi) || (e.a === bi && e.b === ai))) return;
    const len = dist(na, nb);
    if (len < 4) return;
    const cost = Math.ceil(len / 30) * MAT[r.mat].cost;
    if (r.budget < cost) return;
    r.budget -= cost;
    setBudget(r.budget);
    r.edges.push({ id: r.nextEdgeId++, a: ai, b: bi, mat: r.mat, restLen: len, stress: 0, broken: false });
  };

  // ── Physics ───────────────────────────────────────────────────────────────
  const physicsStep = (dt: number) => {
    const r = s.current;
    if (r.phase !== 'test') return;

    const sub = dt / SUBSTEPS;

    for (let step = 0; step < SUBSTEPS; step++) {
      // Verlet integration
      for (const n of r.nodes) {
        if (n.pinned) continue;
        const vx = n.x - n.px;
        const vy = n.y - n.py;
        n.px = n.x; n.py = n.y;
        n.x += vx;
        n.y += vy + GRAVITY * sub * sub;
      }

      // Constraint solving
      for (const e of r.edges) {
        if (e.broken) continue;
        const na = r.nodes.find(n => n.id === e.a)!;
        const nb = r.nodes.find(n => n.id === e.b)!;
        const dx = nb.x - na.x;
        const dy = nb.y - na.y;
        const len = Math.hypot(dx, dy) || 0.001;
        const diff = (len - e.restLen) / len;
        if (MAT[e.mat].tensionOnly && diff > 0) continue;
        const correction = diff * MAT[e.mat].stiffness * 0.5;
        e.stress = Math.abs(diff);
        if (!na.pinned) { na.x += dx * correction; na.y += dy * correction; }
        if (!nb.pinned) { nb.x -= dx * correction; nb.y -= dy * correction; }
        if (e.stress > MAT[e.mat].maxStress) e.broken = true;
      }

      // Cliff surface constraint
      for (const n of r.nodes) {
        if (n.pinned) continue;
        if (n.x < LEFT_CLIFF.x + LEFT_CLIFF.w && n.y > LEFT_CLIFF.y) {
          const vy = n.y - n.py;
          n.y = LEFT_CLIFF.y; n.py = n.y + vy * 0.3;
        }
        if (n.x > RIGHT_CLIFF.x && n.y > RIGHT_CLIFF.y) {
          const vy = n.y - n.py;
          n.y = RIGHT_CLIFF.y; n.py = n.y + vy * 0.3;
        }
      }
    }

    // Collapse check
    if (r.nodes.some(n => !n.pinned && n.y > WATER_Y + 10)) {
      r.phase = 'lose'; setPhase('lose'); return;
    }

    // Vehicle update
    const v = r.vehicle;
    if (!v || v.done || v.fell) return;

    v.vx = Math.min(v.vx + 70 * dt, 150);
    v.vy += GRAVITY * dt;

    // Ground detection from road edges
    let groundY = Infinity;
    for (const e of r.edges) {
      if (e.broken || e.mat !== 'road') continue;
      const na = r.nodes.find(n => n.id === e.a)!;
      const nb = r.nodes.find(n => n.id === e.b)!;
      const left  = Math.min(na.x, nb.x);
      const right = Math.max(na.x, nb.x);
      if (v.x + v.w / 2 < left || v.x - v.w / 2 > right) continue;
      const t = Math.max(0, Math.min(1, (v.x - na.x) / ((nb.x - na.x) || 0.001)));
      const ey = na.y + t * (nb.y - na.y);
      if (ey < groundY) groundY = ey;
    }
    // Cliff tops
    if (v.x - v.w / 2 < LEFT_CLIFF.x + LEFT_CLIFF.w)  groundY = Math.min(groundY, LEFT_CLIFF.y);
    if (v.x + v.w / 2 > RIGHT_CLIFF.x)                  groundY = Math.min(groundY, RIGHT_CLIFF.y);

    const vehicleBottom = v.y + v.h / 2;
    if (vehicleBottom >= groundY - 2 && v.vy >= 0) {
      v.y = groundY - v.h / 2;
      v.vy = 0;
      v.onGround = true;
    } else {
      v.onGround = false;
    }

    v.x += v.vx * dt;
    v.y += v.vy * dt;

    if (v.y > WATER_Y)                     { v.fell = true; r.phase = 'lose'; setPhase('lose'); }
    if (v.x > RIGHT_CLIFF.x + RIGHT_CLIFF.w) { v.done = true; r.phase = 'win';  setPhase('win');  }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const r = s.current;

    ctx.clearRect(0, 0, W, H);

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0,   '#0f172a');
    sky.addColorStop(0.7, '#1e3a5f');
    sky.addColorStop(1,   '#1e3a5f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Water
    const water = ctx.createLinearGradient(0, WATER_Y, 0, H);
    water.addColorStop(0, 'rgba(56,189,248,0.7)');
    water.addColorStop(1, 'rgba(2,132,199,0.95)');
    ctx.fillStyle = water;
    ctx.fillRect(0, WATER_Y, W, H - WATER_Y);

    // Water shimmer
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let wy = WATER_Y + 8; wy < H; wy += 14) {
      ctx.beginPath();
      for (let wx = 0; wx < W; wx += 24) {
        ctx.moveTo(wx, wy + Math.sin(wx * 0.08) * 2);
        ctx.lineTo(wx + 12, wy + Math.sin((wx + 12) * 0.08) * 2);
      }
      ctx.stroke();
    }

    // Cliffs
    ctx.fillStyle = '#334155';
    ctx.fillRect(LEFT_CLIFF.x, LEFT_CLIFF.y, LEFT_CLIFF.w, LEFT_CLIFF.h);
    ctx.fillRect(RIGHT_CLIFF.x, RIGHT_CLIFF.y, RIGHT_CLIFF.w, RIGHT_CLIFF.h);
    // Top edge accent
    ctx.fillStyle = '#475569';
    ctx.fillRect(LEFT_CLIFF.x,  LEFT_CLIFF.y, LEFT_CLIFF.w,  4);
    ctx.fillRect(RIGHT_CLIFF.x, RIGHT_CLIFF.y, RIGHT_CLIFF.w, 4);

    // Edges
    for (const e of r.edges) {
      const na = r.nodes.find(n => n.id === e.a)!;
      const nb = r.nodes.find(n => n.id === e.b)!;
      if (!na || !nb) continue;
      ctx.beginPath();
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(nb.x, nb.y);
      ctx.lineWidth = e.mat === 'steel' ? 5 : e.mat === 'road' ? 6 : e.mat === 'cable' ? 2 : 4;
      if (r.phase === 'test') {
        ctx.strokeStyle = stressColor(e.stress, e.broken);
        ctx.setLineDash(e.broken ? [4, 4] : []);
      } else {
        ctx.strokeStyle = MAT[e.mat].color;
        ctx.setLineDash(e.mat === 'cable' ? [4, 3] : []);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Ghost edge while dragging
    if (r.dragFrom >= 0 && r.phase === 'build') {
      const na = r.nodes.find(n => n.id === r.dragFrom);
      if (na) {
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(r.mouseX, r.mouseY);
        ctx.strokeStyle = MAT[r.mat].color + 'aa';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        const len  = dist(na, { x: r.mouseX, y: r.mouseY });
        const cost = Math.ceil(len / 30) * MAT[r.mat].cost;
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`-${cost}`, (na.x + r.mouseX) / 2 + 6, (na.y + r.mouseY) / 2 - 5);
      }
    }

    // Nodes
    for (const n of r.nodes) {
      const isHover = r.hoverNode === n.id && r.phase === 'build';
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.pinned ? 8 : isHover ? 7 : 5, 0, Math.PI * 2);
      if (n.pinned) {
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
        ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = isHover ? '#ffffff' : '#94a3b8';
        ctx.fill();
      }
    }

    // Ghost node at cursor when not near any existing node
    if (r.hoverNode < 0 && r.phase === 'build' && r.mouseX > 0) {
      ctx.beginPath();
      ctx.arc(r.mouseX, r.mouseY, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fill();
    }

    // Vehicle
    const v = r.vehicle;
    if (v) {
      const vx = v.x - v.w / 2;
      const vy = v.y - v.h / 2;
      // Body
      ctx.beginPath();
      ctx.roundRect(vx, vy, v.w, v.h, 5);
      ctx.fillStyle = v.fell ? '#ef4444' : '#f97316';
      ctx.fill();
      // Cabin
      ctx.beginPath();
      ctx.roundRect(vx + v.w * 0.3, vy - v.h * 0.5, v.w * 0.5, v.h * 0.6, 3);
      ctx.fillStyle = v.fell ? '#dc2626' : '#ea580c';
      ctx.fill();
      // Wheels
      const wr = v.h * 0.42;
      for (const wx of [vx + wr, vx + v.w - wr]) {
        ctx.beginPath();
        ctx.arc(wx, vy + v.h, wr, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b'; ctx.fill();
        ctx.beginPath();
        ctx.arc(wx, vy + v.h, wr * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#94a3b8'; ctx.fill();
      }
    }
  }, []);

  // ── RAF loop ──────────────────────────────────────────────────────────────
  const loop = useCallback((ts: number) => {
    const dt = Math.min((ts - (lastRef.current || ts)) / 1000, 0.05);
    lastRef.current = ts;
    physicsStep(dt);
    render();
    rafRef.current = requestAnimationFrame(loop);
  }, [render]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  // ── Canvas event helpers ──────────────────────────────────────────────────
  const canvasXY = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Vec2 => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = W / rect.width, sy = H / rect.height;
    if ('touches' in e) {
      const t = e.touches[0] ?? e.changedTouches[0];
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
    }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (s.current.phase !== 'build') return;
    const { x, y } = canvasXY(e);
    s.current.mouseX = x; s.current.mouseY = y;
    s.current.hoverNode = nearestNode(x, y, 18);
  };
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (s.current.phase !== 'build') return;
    const { x, y } = canvasXY(e);
    const nn = nearestNode(x, y, 18);
    s.current.dragFrom = nn >= 0 ? nn : getOrCreateNode(x, y);
  };
  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (s.current.phase !== 'build' || s.current.dragFrom < 0) return;
    const { x, y } = canvasXY(e);
    let to = nearestNode(x, y, 18);
    if (to < 0) to = getOrCreateNode(x, y);
    addEdge(s.current.dragFrom, to);
    s.current.dragFrom = -1;
  };
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (s.current.phase !== 'build') return;
    const { x, y } = canvasXY(e);
    const nn = nearestNode(x, y, 22);
    s.current.dragFrom = nn >= 0 ? nn : getOrCreateNode(x, y);
    s.current.mouseX = x; s.current.mouseY = y;
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (s.current.phase !== 'build') return;
    const { x, y } = canvasXY(e);
    s.current.mouseX = x; s.current.mouseY = y;
    s.current.hoverNode = nearestNode(x, y, 22);
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (s.current.phase !== 'build' || s.current.dragFrom < 0) return;
    const { x, y } = canvasXY(e);
    let to = nearestNode(x, y, 22);
    if (to < 0) to = getOrCreateNode(x, y);
    addEdge(s.current.dragFrom, to);
    s.current.dragFrom = -1;
  };

  // ── Phase controls ────────────────────────────────────────────────────────
  const startTest = () => {
    const r = s.current;
    // Snapshot node positions for restore
    r.nodeSnapshot = r.nodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
    r.vehicle = {
      x: LEFT_CLIFF.x + LEFT_CLIFF.w - 10, y: LEFT_CLIFF.y - 22,
      vx: 0, vy: 0, w: 44, h: 24, onGround: false, done: false, fell: false,
    };
    r.phase = 'test';
    setPhase('test');
  };

  const backToBuild = () => {
    const r = s.current;
    // Restore node positions from snapshot
    for (const snap of r.nodeSnapshot) {
      const n = r.nodes.find(nd => nd.id === snap.id);
      if (n) { n.x = snap.x; n.y = snap.y; n.px = snap.x; n.py = snap.y; }
    }
    // Reset edge states
    for (const e of r.edges) { e.broken = false; e.stress = 0; }
    r.vehicle = null;
    r.phase = 'build';
    r.nodeSnapshot = [];
    setPhase('build');
  };

  const clearBridge = () => {
    const r = s.current;
    r.edges = [];
    r.nodes = r.nodes.filter(n => n.pinned);
    r.budget = MAX_BUDGET;
    setBudget(MAX_BUDGET);
  };

  const resetAll = () => { initLevel(); };

  const budgetPct = (budget / MAX_BUDGET) * 100;

  return (
    <div className="flex flex-col items-center gap-3 w-full select-none">
      {/* Canvas */}
      <div className="relative w-full" style={{ maxWidth: W }}>
        <canvas
          ref={canvasRef} width={W} height={H}
          className="w-full rounded-2xl border border-border/30 shadow-2xl cursor-crosshair touch-none"
          onMouseMove={onMouseMove}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { s.current.mouseX = -99; s.current.hoverNode = -1; }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />

        {/* Win / Lose overlay */}
        {(phase === 'win' || phase === 'lose') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl bg-black/65 backdrop-blur-sm">
            <p className="text-5xl">{phase === 'win' ? '🎉' : '💧'}</p>
            <p className="font-black text-2xl uppercase tracking-tight text-white">
              {phase === 'win' ? '다리 완성!' : '다리 붕괴!'}
            </p>
            <p className="text-sm text-white/70 font-medium">
              {phase === 'win' ? '차량이 무사히 건넜습니다!' : '차량이 강에 빠졌습니다.'}
            </p>
            <div className="flex gap-2">
              <button onClick={backToBuild}
                className="px-4 py-2 bg-white/20 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-white/30 transition-all">
                수정하기
              </button>
              <button onClick={resetAll}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-xl font-black text-sm uppercase tracking-widest hover:bg-primary/90 transition-all">
                다시 시작
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Budget bar */}
      <div className="w-full" style={{ maxWidth: W }}>
        <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
          <span>예산</span>
          <span className={budgetPct < 15 ? 'text-red-500' : budgetPct < 40 ? 'text-amber-500' : ''}>{budget} / {MAX_BUDGET}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-200" style={{
            width: `${budgetPct}%`,
            background: budgetPct > 40 ? '#22c55e' : budgetPct > 15 ? '#f59e0b' : '#ef4444',
          }} />
        </div>
      </div>

      {/* Controls */}
      <div className="w-full flex flex-col gap-2" style={{ maxWidth: W }}>
        {phase === 'build' && (
          <div className="flex gap-1.5">
            {(Object.entries(MAT) as [Material, typeof MAT[Material]][]).map(([id, m]) => (
              <button key={id} onClick={() => setMat(id as Material)}
                className={`flex-1 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                  mat === id
                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                    : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/70'
                }`}>
                <span className="block">{m.label}</span>
                <span className="text-[8px] font-medium opacity-60">{m.cost}/$30px</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {phase === 'build' && (
            <>
              <button onClick={clearBridge}
                className="px-3 py-2 bg-muted text-muted-foreground rounded-xl font-black text-xs uppercase tracking-widest hover:bg-muted/70 transition-all">
                지우기
              </button>
              <button onClick={startTest}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl font-black text-sm uppercase tracking-widest hover:bg-primary/90 transition-all shadow-md">
                🚗 테스트
              </button>
            </>
          )}
          {phase === 'test' && (
            <>
              <button onClick={backToBuild}
                className="flex-1 py-2 bg-muted text-muted-foreground rounded-xl font-black text-sm uppercase tracking-widest hover:bg-muted/70 transition-all">
                ← 수정하기
              </button>
              <button onClick={resetAll}
                className="px-3 py-2 bg-destructive/10 text-destructive rounded-xl font-black text-xs uppercase tracking-widest hover:bg-destructive/20 transition-all">
                초기화
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hint text */}
      {phase === 'build' && (
        <p className="text-[10px] text-muted-foreground font-medium text-center max-w-sm">
          노란 앵커에서 드래그해 자재를 연결하세요 · 빈 공간 클릭으로 새 노드 생성 · 테스트 버튼으로 차량 주행
        </p>
      )}
      {phase === 'test' && (
        <p className="text-[10px] text-muted-foreground font-medium text-center">
          스트레스: 초록 → 노랑 → 빨강 · 빨간 점선 = 파손됨
        </p>
      )}
    </div>
  );
}

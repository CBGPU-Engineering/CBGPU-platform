'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

const W = 380, H = 520;
const TILE_LEN = 66;
const ORBIT_R = 30;
const CHECKPOINT_EVERY = 15;
const BASE_BPM = 128;
const MAX_BPM = 190;
const HIT_WINDOW_FRACTION = 0.32;
const PERFECT_FRACTION = 0.35;
const GOOD_FRACTION = 0.7;

const TRACKS = [
  { id: '1', label: 'Track 1', src: '/games/adofai/1.mp4', duration: 33.6, beats: [0.896,2.411,2.901,3.243,3.904,5.419,6.123,6.571,6.891,7.232,7.893,8.576,8.896,9.557,9.899,10.24,10.56,11.904,13.717,15.659,16.491,16.832,17.152,17.472,17.813,18.155,18.475,19.136,19.477,19.797,20.459,20.779,21.12,21.781,22.443,22.763,23.104,23.424,23.765,24.256,24.747,25.088,25.408,25.749,26.069,26.411,27.051,27.392,27.733,28.395,28.715,29.056,31.701,32.021,32.341,32.683,33.003] },
  { id: '2', label: 'Track 2', src: '/games/adofai/2.mp4', duration: 20.155, beats: Array.from({ length: 40 }, (_, i) => 0.5 + i * 0.48) },
  { id: '3', label: 'Track 3', src: '/games/adofai/3.mp4', duration: 6.269, beats: [0.604,0.906,1.138,1.37,1.997,2.299,2.67,2.995,3.599,3.947,4.272,4.574,4.992,5.224,5.666] },
  { id: '4', label: 'Track 4', src: '/games/adofai/4.mp4', duration: 15.602, beats: [0.836,1.138,2.113,2.763,5.016,5.341,5.828,7.268,7.918,8.22,10.495,13.096,13.769,14.071,14.745,15.07] },
  { id: '5', label: 'Track 5', src: '/games/adofai/5.mp4', duration: 11.91, beats: [0.65,3.251,4.156,4.621,6.664,8.15,9.15,10.15,11.1] },
] as const;

interface Pt { x: number; y: number }

const ANGLE_POOL = [
  { angle: 180, weight: 30 },
  { angle: 150, weight: 8 }, { angle: 210, weight: 8 },
  { angle: 135, weight: 8 }, { angle: 225, weight: 8 },
  { angle: 120, weight: 6 }, { angle: 240, weight: 6 },
  { angle: 90, weight: 6 }, { angle: 270, weight: 6 },
  { angle: 105, weight: 5 }, { angle: 255, weight: 5 },
  { angle: 75, weight: 4 }, { angle: 285, weight: 4 },
  { angle: 60, weight: 3 }, { angle: 300, weight: 3 },
  { angle: 45, weight: 2 }, { angle: 315, weight: 2 },
];

function pseudoRandom(index: number) {
  return (Math.sin(index * 12.9898 + 78.233) * 43758.5453) % 1 + 1;
}

function pickAngle(hardness: number, index: number) {
  const pool = ANGLE_POOL.map(a => a.angle === 180 ? { ...a, weight: Math.max(4, a.weight * (1 - hardness * 0.7)) } : a);
  const total = pool.reduce((s, a) => s + a.weight, 0);
  let r = pseudoRandom(index) * total;
  for (const a of pool) { r -= a.weight; if (r <= 0) return a.angle; }
  return 180;
}

function unit(deg: number): Pt {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad), y: Math.sin(rad) };
}

function dirOf(i: number) { return i % 2 === 0 ? 1 : -1; }

function bpmFor(i: number) { return Math.min(MAX_BPM, BASE_BPM + Math.floor(i / 25) * 3); }

function hopDurMs(angle: number, i: number) { return (angle / 180) * (60000 / bpmFor(i)); }

// Level.times[i] = the exact chart time (ms from song start) the planet
// must land on tile i — a fixed timeline, like a real rhythm-game chart,
// so audio can be scheduled ahead of input instead of reacting to it.
class Level {
  angles: number[] = [180];
  bearings: number[] = [0];
  points: Pt[] = [{ x: 0, y: 0 }];
  times: number[] = [0];

  constructor(n: number) { this.extend(n); }

  extend(toLength: number) {
    while (this.points.length < toLength) {
      const i = this.points.length - 1;
      if (i === 0) {
        this.points.push({ x: TILE_LEN, y: 0 });
        this.times.push(this.times[0] + hopDurMs(this.angles[0], 0));
        continue;
      }
      const hardness = Math.min(1, i / 140);
      const A = pickAngle(hardness, i);
      this.angles[i] = A;
      const dir = dirOf(i);
      const D = (((this.bearings[i - 1] + 180 + dir * A) % 360) + 360) % 360;
      this.bearings[i] = D;
      const u = unit(D);
      const prev = this.points[i];
      this.points.push({ x: prev.x + TILE_LEN * u.x, y: prev.y + TILE_LEN * u.y });
      this.times.push(this.times[i] + hopDurMs(A, i));
    }
  }
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }
interface Judgment { label: string; color: string; start: number }
interface AdofaiProps { onExit?: () => void }

export default function Adofai({ onExit }: AdofaiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const levelRef = useRef<Level>(new Level(60));
  const audioRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const autoRef = useRef(false);
  const s = useRef({
    running: false,
    cur: 0,
    checkpoint: 0,
    origin: 0,       // performance.now() - origin == chart time (ms)
    camera: { x: 0, y: 0 },
    flash: 0,
    particles: [] as Particle[],
    dying: false,
    judgment: null as Judgment | null,
  });
  const [phase, setPhase] = useState<'idle' | 'running'>('idle');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [combo, setCombo] = useState(0);
  const [autoMode, setAutoMode] = useState(false);
  const [trackId, setTrackId] = useState<(typeof TRACKS)[number]['id']>('1');
  const track = TRACKS.find(item => item.id === trackId)!;

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioRef.current = new Ctx();
    }
    return audioRef.current!;
  }, []);

  const beep = useCallback((freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.18) => {
    const ctx = ensureAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }, [ensureAudio]);

  const noiseBurst = useCallback((dur: number) => {
    const ctx = ensureAudio();
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }, [ensureAudio]);

  const resetTimeline = useCallback((refChartTime: number) => {
    const t0 = performance.now();
    s.current.origin = t0 - refChartTime;
  }, []);

  const spawnBurst = useCallback((p: Pt, color: string) => {
    for (let k = 0; k < 18; k++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 3;
      s.current.particles.push({ x: p.x, y: p.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1, color });
    }
  }, []);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const st = s.current;
    const lvl = levelRef.current;

    // The canvas must stay transparent: the selected MP4 is the actual game
    // background, not a dark decorative layer drawn over it.
    ctx.clearRect(0, 0, W, H);

    if (st.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${st.flash * 0.25})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.translate(W / 2 - st.camera.x, H / 2 - st.camera.y);

    // path
    const from = Math.max(0, st.cur - 2);
    const to = Math.min(lvl.points.length - 1, st.cur + 7);
    // A near-black under-stroke keeps the route visible over both bright and
    // dark sections of the video. The coloured line is drawn on top of it.
    ctx.strokeStyle = 'rgba(5, 10, 24, 0.92)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    for (let i = from; i <= to; i++) {
      const p = lvl.points[i];
      if (i === from) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(65, 230, 255, 0.95)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#25d9ff';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    for (let i = from; i <= to; i++) {
      const p = lvl.points[i];
      const isCur = i === st.cur;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isCur ? 10 : 6, 0, Math.PI * 2);
      if (isCur) {
        ctx.fillStyle = '#ffe066';
        ctx.shadowColor = '#ffe066';
        ctx.shadowBlur = 16;
      } else {
        ctx.fillStyle = '#18243d';
        ctx.strokeStyle = '#77ecff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      if (!isCur) ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // orbiting/stationary planets
    if (st.running || phase === 'idle') {
      const i = st.cur;
      const A = lvl.angles[i] ?? 180;
      const hopDur = Math.max(1, lvl.times[i + 1] - lvl.times[i]);
      const elapsedInHop = st.running ? (performance.now() - st.origin) - lvl.times[i] : 0;
      const progress = Math.min(elapsedInHop / hopDur, 1.2);
      const thetaStart = (i === 0 ? 180 : lvl.bearings[i - 1] + 180);
      const dir = dirOf(i);
      const theta = thetaStart + dir * A * progress;
      const pivot = lvl.points[i];
      const orbitPos = { x: pivot.x + ORBIT_R * Math.cos((theta * Math.PI) / 180), y: pivot.y + ORBIT_R * Math.sin((theta * Math.PI) / 180) };

      const redIsStationary = i % 2 === 0;
      const stationaryColor = redIsStationary ? '#ff4d5e' : '#4da6ff';
      const orbitColor = redIsStationary ? '#4da6ff' : '#ff4d5e';

      ctx.beginPath();
      ctx.arc(pivot.x, pivot.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = stationaryColor;
      ctx.shadowColor = stationaryColor;
      ctx.shadowBlur = 14;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(orbitPos.x, orbitPos.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = orbitColor;
      ctx.shadowColor = orbitColor;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // particles
    st.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.restore();

    if (st.judgment) {
      const age = performance.now() - st.judgment.start;
      if (age < 500) {
        const alpha = 1 - age / 500;
        const rise = (age / 500) * 16;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = st.judgment.color;
        ctx.shadowColor = st.judgment.color;
        ctx.shadowBlur = 14;
        ctx.font = 'bold 26px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(st.judgment.label, W / 2, 56 - rise);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
      } else {
        st.judgment = null;
      }
    }
  }, [phase]);

  const fail = useCallback(() => {
    const st = s.current;
    if (st.dying) return;
    st.dying = true;
    st.running = false;
    videoRef.current?.pause();
    st.judgment = { label: 'MISS', color: '#ff4d5e', start: performance.now() };
    noiseBurst(0.35);
    spawnBurst(levelRef.current.points[st.cur], '#ff884d');
    st.flash = 1;
    setBest(b => Math.max(b, st.cur));

    setTimeout(() => {
      const lvl = levelRef.current;
      st.cur = st.checkpoint;
      st.camera = { ...lvl.points[st.checkpoint] };
      st.dying = false;
      st.running = true;
      resetTimeline(lvl.times[st.checkpoint]);
      const video = videoRef.current;
      if (video) { video.currentTime = lvl.times[st.checkpoint] / 1000; video.play().catch(() => {}); }
      setScore(st.cur);
      setCombo(0);
    }, 550);
  }, [noiseBurst, spawnBurst, resetTimeline]);

  const advance = useCallback(() => {
    const st = s.current;
    const lvl = levelRef.current;
    st.cur += 1;
    st.checkpoint = Math.floor(st.cur / CHECKPOINT_EVERY) * CHECKPOINT_EVERY;
    st.flash = 0.6;
    lvl.extend(st.cur + 20);
    setScore(st.cur);
    setCombo(c => c + 1);
    setBest(b => Math.max(b, st.cur));
  }, []);

  const handleInput = useCallback(() => {
    const st = s.current;
    if (phase !== 'running' || !st.running || st.dying) return;
    // A manual tap always takes control back from autoplay.
    if (autoRef.current) {
      autoRef.current = false;
      setAutoMode(false);
      st.judgment = { label: 'MANUAL', color: '#ffe066', start: performance.now() };
      return;
    }
    const lvl = levelRef.current;
    const i = st.cur;
    const hopDur = lvl.times[i + 1] - lvl.times[i];
    const elapsedInHop = (performance.now() - st.origin) - lvl.times[i];
    // The chart contains real, per-note timestamps from the chosen video's
    // audio. Never use a guessed global BPM here: long and short gaps need
    // their own timing window.
    const windowMs = Math.min(170, hopDur * HIT_WINDOW_FRACTION);
    const diff = elapsedInHop - hopDur;
    const absDiff = Math.abs(diff);
    if (absDiff <= windowMs) {
      let label = 'OK', color = '#ffe066';
      if (absDiff <= windowMs * PERFECT_FRACTION) {
        label = 'PERFECT'; color = '#4dd2ff';
        beep(1300, 0.08, 'sine', 0.09);
      } else if (absDiff <= windowMs * GOOD_FRACTION) { label = 'GOOD'; color = '#7cff6b'; }
      st.judgment = { label, color, start: performance.now() };
      advance();
    } else {
      fail();
    }
  }, [phase, advance, fail, beep]);

  const start = useCallback(() => {
    const ctx = ensureAudio();
    if (ctx.state === 'suspended') ctx.resume();
    const st = s.current;
    st.cur = 0; st.checkpoint = 0; st.dying = false; st.running = true;
    resetTimeline(0);
    st.camera = { ...levelRef.current.points[0] };
    st.particles = [];
    const chart = new Level(track.beats.length + 2);
    chart.times = [0, ...track.beats.map(time => Math.round(time * 1000))];
    levelRef.current = chart;
    const video = videoRef.current;
    if (video) { video.currentTime = 0; video.play().catch(() => {}); }
    setScore(0); setCombo(0);
    setPhase('running');
  }, [ensureAudio, resetTimeline, track]);

  const tap = useCallback(() => {
    if (phase !== 'running') { start(); return; }
    handleInput();
  }, [phase, start, handleInput]);

  const tick = useCallback(() => {
    const st = s.current;
    const lvl = levelRef.current;

    if (st.running && !st.dying) {
      if (videoRef.current && videoRef.current.currentTime >= track.duration - 0.05) {
        st.running = false;
        videoRef.current.pause();
        setPhase('idle');
      }
      const i = st.cur;
      const hopDur = lvl.times[i + 1] - lvl.times[i];
      const elapsedInHop = (performance.now() - st.origin) - lvl.times[i];
      const windowMs = Math.min(170, hopDur * HIT_WINDOW_FRACTION);
      if (autoRef.current && elapsedInHop >= hopDur) {
        st.judgment = { label: 'AUTO', color: '#b88cff', start: performance.now() };
        advance();
      } else if (elapsedInHop > hopDur + windowMs) {
        fail();
      }

      const target = lvl.points[st.cur];
      st.camera.x += (target.x - st.camera.x) * 0.28;
      st.camera.y += (target.y - st.camera.y) * 0.28;
    }

    if (st.flash > 0) st.flash = Math.max(0, st.flash - 0.06);
    st.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.035; });
    st.particles = st.particles.filter(p => p.life > 0);

    draw();
    rafRef.current = requestAnimationFrame(tick);
  }, [advance, draw, fail, track.duration]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.code === 'Space') e.preventDefault();
      tap();
    };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('keydown', onKey); };
  }, [tick, tap]);

  const exit = useCallback(() => {
    const st = s.current;
    st.running = false;
    st.dying = false;
    videoRef.current?.pause();
    if (audioRef.current?.state === 'running') audioRef.current.suspend().catch(() => {});
    setPhase('idle');
    onExit?.();
  }, [onExit]);

  const toggleAuto = useCallback(() => {
    autoRef.current = !autoRef.current;
    setAutoMode(autoRef.current);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {TRACKS.map(item => <button key={item.id} onClick={() => { if (phase === 'idle') setTrackId(item.id); }} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-black ${trackId === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{item.label}</button>)}
        <button aria-pressed={autoMode} onClick={toggleAuto} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-black ${autoMode ? 'bg-violet-600 text-white' : 'text-muted-foreground hover:bg-background hover:text-foreground'}`}>자동 {autoMode ? 'ON' : 'OFF'}</button>
        <button onClick={exit} className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-black text-muted-foreground hover:bg-background hover:text-foreground">나가기</button>
      </div>
      <div className="flex items-center gap-6">
        <span className="text-sm font-black uppercase tracking-widest">Tiles: {score}</span>
        <span className="text-sm font-black uppercase tracking-widest text-muted-foreground">Best: {best}</span>
        <span className="text-sm font-black uppercase tracking-widest text-yellow-500">Combo: {combo}</span>
      </div>
      <div className="relative select-none">
        <video ref={videoRef} src={track.src} className="absolute inset-0 h-full w-full rounded-2xl object-cover" playsInline preload="metadata" />
        <canvas
          ref={canvasRef} width={W} height={H}
          className="relative rounded-2xl shadow-xl border border-border/30 touch-none bg-transparent"
          style={{ maxWidth: '100%' }}
          onClick={tap}
          onTouchStart={e => { e.preventDefault(); tap(); }}
        />
        {phase === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/20 rounded-2xl px-6 text-center">
            <p className="text-white font-black text-2xl uppercase tracking-tight drop-shadow-lg">🔥 얼불춤 ❄️</p>
            <p className="text-white/80 text-sm font-medium leading-relaxed">
              영상과 음악에 맞춰 탭 또는 아무 키나
            </p>
            <p className="text-white/50 text-xs font-medium">실수하면 마지막 체크포인트로 리셋됩니다 · 자동 모드도 지원</p>
            <Button onClick={start} className="font-black uppercase tracking-widest">Start</Button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground font-medium">탭 또는 아무 키나 · 영상의 음악에 맞춰 플레이하세요</p>
    </div>
  );
}

'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Plus, Trash2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';

// ─── Pomodoro ─────────────────────────────────────────────────────────────────
const PRESETS = [
  { label: '집중 25', work: 25, rest: 5 },
  { label: '집중 50', work: 50, rest: 10 },
  { label: '짧게 15', work: 15, rest: 3 },
];

function Ring({ pct, color, size = 160 }: { pct: number; color: string; size?: number }) {
  const r  = (size - 12) / 2;
  const c  = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" className="text-muted/30" strokeWidth={10} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s' }} />
    </svg>
  );
}

function Pomodoro() {
  const [preset, setPreset] = useState(0);
  const [phase,  setPhase]  = useState<'work' | 'rest'>('work');
  const [secs,   setSecs]   = useState(PRESETS[0].work * 60);
  const [running,setRunning]= useState(false);
  const [cycles, setCycles] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const cfg = PRESETS[preset];

  const total = (phase === 'work' ? cfg.work : cfg.rest) * 60;
  const pct   = (secs / total) * 100;
  const mm    = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss    = String(secs % 60).padStart(2, '0');

  const stop = useCallback(() => { if (tickRef.current) clearInterval(tickRef.current); setRunning(false); }, []);

  const notify = (msg: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('CBGPU 포모도로', { body: msg });
    }
  };

  useEffect(() => {
    if (!running) return;
    tickRef.current = setInterval(() => {
      setSecs(s => {
        if (s <= 1) {
          if (phase === 'work') {
            notify('휴식 시간! 5분간 쉬세요 🎉');
            setPhase('rest');
            return cfg.rest * 60;
          } else {
            notify('집중 시간! 다시 시작하세요 💪');
            setCycles(c => c + 1);
            setPhase('work');
            return cfg.work * 60;
          }
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [running, phase, cfg]);

  const reset = () => { stop(); setPhase('work'); setSecs(cfg.work * 60); };
  const selectPreset = (i: number) => { stop(); setPreset(i); setPhase('work'); setSecs(PRESETS[i].work * 60); };

  return (
    <div className="flex flex-col items-center gap-5">
      <SegmentedTabs
        items={PRESETS.map((p, i) => ({ value: String(i), label: p.label }))}
        value={String(preset)}
        onChange={(v) => selectPreset(Number(v))}
        className="justify-center"
      />

      <div className="relative flex items-center justify-center">
        <Ring pct={pct} color={phase === 'work' ? '#6366f1' : '#22c55e'} size={200} />
        <div className="absolute text-center">
          <p className="text-4xl font-black tabular-nums">{mm}:{ss}</p>
          <p className={`text-xs font-black uppercase tracking-widest mt-1 ${phase === 'work' ? 'text-primary' : 'text-green-500'}`}>
            {phase === 'work' ? '집중' : '휴식'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{cycles} 사이클 완료</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => setRunning(r => !r)} className="gap-2 font-black uppercase tracking-widest w-28">
          {running ? <><Pause className="size-4" />일시정지</> : <><Play className="size-4" />{secs === total ? '시작' : '계속'}</>}
        </Button>
        <Button variant="outline" size="icon" onClick={reset}><RotateCcw className="size-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => Notification.requestPermission()} title="알림 허용">
          <Bell className="size-4" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Bell 아이콘으로 알림 허용 시 세션 종료마다 알림을 받습니다</p>
    </div>
  );
}

// ─── D-day ────────────────────────────────────────────────────────────────────
interface DDay { id: string; label: string; date: string; emoji: string }

const EMOJIS = ['📅','🎯','📝','🏆','💡','🔬','📚','⚡','🚀','❤️'];

function DDayCounter() {
  const [items, setItems] = useState<DDay[]>([]);
  const [label, setLabel] = useState('');
  const [date,  setDate]  = useState('');
  const [emoji, setEmoji] = useState('📅');

  useEffect(() => {
    try { setItems(JSON.parse(localStorage.getItem('cbgpu_dday') ?? '[]')); } catch {}
  }, []);

  const save = (next: DDay[]) => { setItems(next); localStorage.setItem('cbgpu_dday', JSON.stringify(next)); };

  const add = () => {
    if (!label.trim() || !date) return;
    save([...items, { id: Date.now().toString(), label, date, emoji }]);
    setLabel(''); setDate('');
  };

  const remove = (id: string) => save(items.filter(x => x.id !== id));

  const diff = (dateStr: string) => {
    const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    if (d === 0) return { label: 'D-Day!', color: 'text-primary' };
    if (d > 0)  return { label: `D-${d}`, color: 'text-foreground' };
    return { label: `+${-d}일 지남`, color: 'text-muted-foreground' };
  };

  const sorted = [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-4 w-full max-w-sm mx-auto">
      <div className="p-4 border border-border/50 rounded-2xl bg-card space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {EMOJIS.map(e => (
            <button key={e} onClick={() => setEmoji(e)}
              className={`w-8 h-8 rounded-lg text-lg transition-all ${emoji===e?'bg-primary/20 scale-110':'hover:bg-muted'}`}>{e}</button>
          ))}
        </div>
        <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="이벤트 이름 (예: 수학 기말고사)" className="font-medium" onKeyDown={e => e.key === 'Enter' && add()} />
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="font-medium" />
        <Button onClick={add} disabled={!label.trim() || !date} className="w-full font-black uppercase gap-2">
          <Plus className="size-4" />추가
        </Button>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && <p className="text-center text-muted-foreground text-sm py-6">D-day 일정을 추가해 보세요.</p>}
        {sorted.map(item => {
          const { label: dl, color } = diff(item.date);
          const dateStr = new Date(item.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
          return (
            <div key={item.id} className="flex items-center gap-3 p-3 border border-border/40 rounded-xl bg-card hover:bg-muted/20 tilt-3d transition-all">
              <span className="text-2xl select-none">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm truncate">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{dateStr}</p>
              </div>
              <span className={`font-black text-sm tabular-nums shrink-0 ${color}`}>{dl}</span>
              <button onClick={() => remove(item.id)} className="text-muted-foreground/30 hover:text-destructive transition-colors"><Trash2 className="size-3.5" /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'pomodoro', label: '⏱ 포모도로', desc: '집중 타이머' },
  { id: 'dday',     label: '📅 D-day',    desc: '날짜 카운트다운' },
] as const;
type TabId = typeof TABS[number]['id'];

export default function ToolsPage() {
  const [tab, setTab] = useState<TabId>('pomodoro');
  return (
    <section className="cb-page-content min-h-screen px-4 py-10 flex flex-col items-center gap-8">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-black uppercase tracking-tighter italic">도구</h1>
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">공부 도우미</p>
      </div>
      <SegmentedTabs
        items={TABS.map(t => ({
          value: t.id,
          label: (
            <span className="flex flex-col items-center gap-0.5">
              <span>{t.label}</span>
              <span className="text-[9px] font-medium opacity-70">{t.desc}</span>
            </span>
          ),
        }))}
        value={tab}
        onChange={(v) => setTab(v as TabId)}
      />
      <div className="w-full max-w-lg">
        {tab === 'pomodoro' && <Pomodoro />}
        {tab === 'dday'     && <DDayCounter />}
      </div>
    </section>
  );
}

'use client';

/**
 * Native `<input type="time">` pops the OS's own big wheel-picker dialog
 * inside the WebView (looks like stock old-Android chrome, not this app) —
 * this is three small styled <select>s instead so the closed state and the
 * whole surrounding row stay in the app's own visual language. The option
 * *list* itself is still browser-native (can't fully reskin that without a
 * custom listbox), but that's a much smaller, much briefer surface than the
 * full-screen wheel dialog it replaces.
 */

interface TimePickerProps {
  /** 24h "HH:MM". */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function to12h(hhmm: string): { period: 'AM' | 'PM'; hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map(Number);
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { period, hour, minute: m };
}

function to24h(period: 'AM' | 'PM', hour: number, minute: number): string {
  let h = hour % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const selectClass =
  'appearance-none bg-muted/60 disabled:opacity-40 rounded-lg pl-2.5 pr-6 py-1.5 text-sm font-bold ' +
  'text-right ring-1 ring-foreground/10 focus:outline-none focus:ring-2 focus:ring-primary ' +
  "bg-[url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27none%27%3E%3Cpath d=%27M5 7l5 5 5-5%27 stroke=%27%23888%27 stroke-width=%271.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E')] " +
  'bg-no-repeat bg-[right_0.35rem_center] bg-[length:14px_14px]';

export function TimePicker({ value, onChange, disabled }: TimePickerProps) {
  const { period, hour, minute } = to12h(value);

  return (
    <div className="flex items-center gap-1.5">
      <select
        aria-label="오전/오후"
        value={period}
        disabled={disabled}
        onChange={(e) => onChange(to24h(e.target.value as 'AM' | 'PM', hour, minute))}
        className={selectClass}
      >
        <option value="AM">오전</option>
        <option value="PM">오후</option>
      </select>
      <select
        aria-label="시"
        value={hour}
        disabled={disabled}
        onChange={(e) => onChange(to24h(period, Number(e.target.value), minute))}
        className={selectClass}
      >
        {HOURS_12.map((h) => (
          <option key={h} value={h}>{h}시</option>
        ))}
      </select>
      <select
        aria-label="분"
        value={minute}
        disabled={disabled}
        onChange={(e) => onChange(to24h(period, hour, Number(e.target.value)))}
        className={selectClass}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>
        ))}
      </select>
    </div>
  );
}

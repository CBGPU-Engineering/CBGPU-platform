'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

interface Person { id: string; full_name: string | null; student_id: string | null; }

/** Combobox for picking one person by searching name or student ID. Lets you
 * jump straight to a match instead of scrolling a long dropdown (used for
 * manager assignment in admin and the manufacturing request forms). */
export function PersonSearchSelect({ candidates, value, onChange, placeholder = '이름 또는 학번 검색' }: {
  candidates: Person[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = candidates.find(c => c.id === value);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = (q
    ? candidates.filter(c => (c.full_name || '').toLowerCase().includes(q) || (c.student_id || '').toLowerCase().includes(q))
    : candidates
  ).slice(0, 8);

  if (selected) {
    return (
      <div className="flex-1 flex items-center justify-between h-9 px-3 rounded-lg border border-input bg-transparent text-sm font-bold">
        <span className="truncate">{selected.full_name || 'Unknown'} <span className="text-muted-foreground opacity-60">({selected.student_id || '-'})</span></span>
        <button type="button" onClick={() => onChange('')} className="text-muted-foreground hover:text-destructive shrink-0 ml-2">
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground opacity-50 pointer-events-none" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-9 w-full rounded-lg border border-input bg-transparent pl-8 pr-3 text-sm font-bold outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>
      {open && (
        <div className="absolute z-20 top-full mt-1 w-full max-h-56 overflow-y-auto rounded-xl bg-popover ring-1 ring-foreground/10 shadow-lg py-1">
          {matches.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-muted-foreground text-center">검색 결과 없음</p>
          ) : (
            matches.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onChange(c.id); setQuery(''); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm font-bold hover:bg-muted transition-colors flex items-center justify-between gap-2"
              >
                <span className="truncate">{c.full_name || 'Unknown'}</span>
                <span className="text-muted-foreground opacity-60 text-xs shrink-0">{c.student_id || '-'}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

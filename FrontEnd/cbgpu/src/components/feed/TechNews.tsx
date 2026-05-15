'use client';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, MessageSquare, ChevronUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CATEGORIES = [
  { id: 'ai',       label: 'AI / ML',   query: 'artificial intelligence machine learning LLM GPT neural' },
  { id: 'security', label: 'Hacking',   query: 'hacking security vulnerability exploit CVE malware' },
  { id: 'embedded', label: 'Embedded',  query: 'embedded firmware microcontroller IoT RTOS raspberry arduino' },
] as const;

type CatId = typeof CATEGORIES[number]['id'];

interface Story {
  objectID: string;
  title: string;
  url?: string;
  author: string;
  points: number;
  num_comments: number;
  created_at: string;
}

function ago(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}d`;
  if (h >= 1) return `${h}h`;
  return `${Math.floor(diff / 60000)}m`;
}

function domain(url?: string): string {
  if (!url) return 'news.ycombinator.com';
  try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}

export default function TechNews() {
  const [cat, setCat] = useState<CatId>('ai');
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshed, setRefreshed] = useState<Date | null>(null);

  const load = useCallback(async (id: CatId) => {
    const q = CATEGORIES.find(c => c.id === id)!.query;
    setLoading(true); setError('');
    try {
      const res = await fetch(
        `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=25`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStories(data.hits);
      setRefreshed(new Date());
    } catch {
      setError('뉴스를 불러오지 못했습니다. 잠시 후 다시 시도하세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(cat); }, [cat, load]);
  useEffect(() => {
    const t = setInterval(() => load(cat), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [cat, load]);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`px-3 py-1.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all ${
                cat === c.id ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {refreshed && (
            <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
              <Zap className="size-2.5 text-green-500" />
              {refreshed.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button variant="ghost" size="icon" className="size-7" onClick={() => load(cat)} disabled={loading}>
            <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && <p className="text-destructive text-xs font-bold p-3 bg-destructive/10 rounded-lg">{error}</p>}

      {loading && stories.length === 0 && (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-[64px] bg-muted/50 animate-pulse rounded-xl" style={{ opacity: 1 - i * 0.07 }} />
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {stories.map((s, i) => (
          <a
            key={s.objectID}
            href={s.url || `https://news.ycombinator.com/item?id=${s.objectID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 items-start p-3 rounded-xl border border-border/40 hover:bg-muted/40 hover:border-border transition-all group"
          >
            <span className="text-[10px] font-black text-muted-foreground/50 w-4 text-right mt-0.5 shrink-0 tabular-nums">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold leading-snug group-hover:text-primary transition-colors">{s.title}</p>
              <div className="flex items-center gap-2.5 mt-1 text-[10px] text-muted-foreground font-medium flex-wrap">
                <span className="flex items-center gap-0.5"><ChevronUp className="size-2.5" />{s.points ?? 0}</span>
                <span className="flex items-center gap-0.5"><MessageSquare className="size-2.5" />{s.num_comments ?? 0}</span>
                <span className="opacity-60 truncate max-w-[160px]">{domain(s.url)}</span>
                <span className="opacity-50">{ago(s.created_at)}</span>
              </div>
            </div>
            <ExternalLink className="size-3 text-muted-foreground/30 shrink-0 mt-1 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>

      {stories.length > 0 && (
        <p className="text-center text-[10px] text-muted-foreground pt-2">
          Powered by{' '}
          <a href="https://news.ycombinator.com" target="_blank" rel="noopener noreferrer" className="hover:underline font-bold">
            Hacker News
          </a>
          {' '}· 5분마다 자동 갱신
        </p>
      )}
    </div>
  );
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, MessageSquare, ChevronUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';

// ─── category config ──────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'ai', label: 'AI / LLM',
    hn: 'LLM GPT Claude artificial intelligence machine learning agent 2025',
    google: 'AI LLM ChatGPT Claude machine learning 2025',
  },
  {
    id: 'security', label: 'Security',
    hn: 'hacking CVE exploit vulnerability malware ransomware zero-day',
    google: 'CVE vulnerability exploit hacking cybersecurity 2025',
  },
  {
    id: 'embedded', label: 'Embedded',
    hn: 'embedded firmware microcontroller IoT RTOS ESP32 RISC-V bare-metal',
    google: 'embedded systems firmware microcontroller IoT RTOS 2025',
  },
  {
    id: 'research', label: 'Research',
    hn: 'arxiv paper preprint neural network deep learning research',
    google: 'machine learning research paper arxiv preprint 2025',
  },
  {
    id: 'oss', label: 'Open Source',
    hn: 'open source release github rust golang typescript new version',
    google: 'open source release new version programming 2025',
  },
  {
    id: 'kr', label: '한국 IT',
    hn: 'korea samsung naver kakao hyundai kia',
    google: '인공지능 한국 스타트업 삼성 네이버 카카오 IT',
    googleLang: 'ko',
  },
] as const;

type CatId = typeof CATEGORIES[number]['id'];
type Source = 'google' | 'hn';

interface HNStory {
  objectID: string;
  title: string;
  url?: string;
  author: string;
  points: number;
  num_comments: number;
  created_at: string;
}

interface GNewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function ago(d: string): string {
  const ms = Date.now() - new Date(d).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d`;
  if (h >= 1) return `${h}h`;
  return `${Math.floor(ms / 60_000)}m`;
}

function domain(url?: string): string {
  if (!url) return '';
  try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}

// ─── HN fetch ─────────────────────────────────────────────────────────────────
async function fetchHN(query: string): Promise<HNStory[]> {
  const res = await fetch(
    `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=50`,
  );
  if (!res.ok) throw new Error('HN fetch failed');
  return (await res.json()).hits as HNStory[];
}

// ─── Google News fetch (via API route) ────────────────────────────────────────
async function fetchGoogle(query: string, lang = 'en-US'): Promise<GNewsItem[]> {
  const res = await fetch(`/api/news?q=${encodeURIComponent(query)}&hl=${lang}`);
  if (!res.ok) throw new Error('Google News fetch failed');
  return (await res.json()).items as GNewsItem[];
}

// ─── component ────────────────────────────────────────────────────────────────
export default function TechNews() {
  const [cat, setCat] = useState<CatId>('ai');
  const [src, setSrc] = useState<Source>('google');
  const [hnStories, setHnStories] = useState<HNStory[]>([]);
  const [gnItems, setGnItems] = useState<GNewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshed, setRefreshed] = useState<Date | null>(null);

  const load = useCallback(async (catId: CatId, source: Source) => {
    const cfg = CATEGORIES.find(c => c.id === catId)!;
    setLoading(true);
    setError('');
    try {
      if (source === 'hn') {
        const data = await fetchHN(cfg.hn);
        setHnStories(data);
      } else {
        const data = await fetchGoogle(cfg.google, 'googleLang' in cfg ? (cfg as { googleLang: string }).googleLang : undefined);
        setGnItems(data);
      }
      setRefreshed(new Date());
    } catch (e) {
      setError(source === 'hn'
        ? 'Hacker News를 불러오지 못했습니다.'
        : 'Google News를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(cat, src); }, [cat, src, load]);
  useEffect(() => {
    const t = setInterval(() => load(cat, src), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [cat, src, load]);

  const stories = src === 'hn' ? hnStories : [];
  const gnNews = src === 'google' ? gnItems : [];
  const total = src === 'hn' ? stories.length : gnNews.length;

  return (
    <div className="w-full space-y-4">
      {/* category tabs */}
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

      {/* source + refresh */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <SegmentedTabs
            items={[{ value: 'google', label: '🔍 Google' }, { value: 'hn', label: '🔶 HN' }]}
            value={src}
            onChange={(v) => setSrc(v as Source)}
          />
          {total > 0 && (
            <span className="text-[10px] text-muted-foreground self-center ml-1 font-medium">{total}건</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {refreshed && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Zap className="size-2.5 text-green-500" />
              {refreshed.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button variant="ghost" size="icon" className="size-7" onClick={() => load(cat, src)} disabled={loading}>
            <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-destructive text-xs font-bold p-3 bg-destructive/10 rounded-lg">{error}</p>
      )}

      {loading && total === 0 && (
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-[60px] bg-muted/50 animate-pulse rounded-xl" style={{ opacity: 1 - i * 0.06 }} />
          ))}
        </div>
      )}

      {/* HN stories */}
      {src === 'hn' && (
        <div className="space-y-1.5">
          {stories.map((s, i) => (
            <a key={s.objectID}
              href={s.url || `https://news.ycombinator.com/item?id=${s.objectID}`}
              target="_blank" rel="noopener noreferrer"
              className="flex gap-3 items-start p-3 rounded-xl border border-border/40 hover:bg-muted/40 hover:border-border transition-all group"
            >
              <span className="text-[10px] font-black text-muted-foreground/40 w-4 text-right mt-0.5 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold leading-snug group-hover:text-primary transition-colors">{s.title}</p>
                <div className="flex items-center gap-2.5 mt-1 text-[10px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-0.5"><ChevronUp className="size-2.5" />{s.points ?? 0}</span>
                  <span className="flex items-center gap-0.5"><MessageSquare className="size-2.5" />{s.num_comments ?? 0}</span>
                  {domain(s.url) && <span className="opacity-60 truncate max-w-[150px]">{domain(s.url)}</span>}
                  <span className="opacity-40">{ago(s.created_at)}</span>
                </div>
              </div>
              <ExternalLink className="size-3 text-muted-foreground/20 shrink-0 mt-1 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
        </div>
      )}

      {/* Google News items */}
      {src === 'google' && (
        <div className="space-y-1.5">
          {gnNews.map((item, i) => (
            <a key={item.link + i}
              href={item.link}
              target="_blank" rel="noopener noreferrer"
              className="flex gap-3 items-start p-3 rounded-xl border border-border/40 hover:bg-muted/40 hover:border-border transition-all group"
            >
              <span className="text-[10px] font-black text-muted-foreground/40 w-4 text-right mt-0.5 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold leading-snug group-hover:text-primary transition-colors">{item.title}</p>
                <div className="flex items-center gap-2.5 mt-1 text-[10px] text-muted-foreground flex-wrap">
                  {item.source && <span className="font-medium opacity-70 truncate max-w-[180px]">{item.source}</span>}
                  {item.pubDate && <span className="opacity-40">{ago(item.pubDate)}</span>}
                </div>
              </div>
              <ExternalLink className="size-3 text-muted-foreground/20 shrink-0 mt-1 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
        </div>
      )}

      {!loading && total === 0 && !error && (
        <p className="text-center text-sm text-muted-foreground py-8">결과가 없습니다.</p>
      )}

      {total > 0 && (
        <p className="text-center text-[10px] text-muted-foreground pt-2">
          {src === 'hn'
            ? <>Via <a href="https://news.ycombinator.com" target="_blank" rel="noopener noreferrer" className="hover:underline font-bold">Hacker News</a></>
            : '🔍 Google News · 5분마다 자동 갱신'}
        </p>
      )}
    </div>
  );
}

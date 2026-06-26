'use client';
import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { LoadingSpinner } from '@/components/ui/spinner';

const TABS = [
  { id: 'notice',   label: '공지사항' },
  { id: 'letter',   label: '가정통신문' },
  { id: 'schedule', label: '학사일정' },
] as const;
type TabId = typeof TABS[number]['id'];

interface Item { title: string; link: string; pubDate: string; author: string }

function fmtDate(d: string) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d.slice(0, 10);
  return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')}`;
}

export default function SchoolNews() {
  const [tab, setTab] = useState<TabId>('notice');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState<Date | null>(null);

  const load = useCallback(async (t: TabId) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/school-news?type=${t}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setItems(data.items);
      setUpdated(new Date());
    } catch (e) {
      setError('공지를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setJustFinished(true);
      setTimeout(() => setJustFinished(false), 600);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SegmentedTabs
          items={TABS.map(t => ({ value: t.id, label: t.label }))}
          value={tab}
          onChange={(v) => setTab(v as TabId)}
        />
        <div className="flex items-center gap-2">
          {updated && <span className="text-[10px] text-muted-foreground">{updated.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })}</span>}
          <Button variant="ghost" size="icon" className="size-7" onClick={() => load(tab)} disabled={loading}>
            <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <a href={`https://school.cbe.go.kr/cbs-h/M010401`} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="size-7"><ExternalLink className="size-3" /></Button>
          </a>
        </div>
      </div>

      {error && <p className="text-destructive text-xs font-bold p-3 bg-destructive/10 rounded-lg">{error}</p>}

      {(loading || justFinished) && (
        <div className="py-10 flex items-center justify-center">
          <LoadingSpinner done={justFinished} size={48} label="공지사항 불러오는 중" />
        </div>
      )}

      <div className={`space-y-1.5 ${loading || justFinished ? 'hidden' : ''}`}>
        {items.map((item, i) => (
          <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
            className="flex gap-3 items-start p-3 rounded-xl border border-border/40 hover:bg-muted/40 hover:border-border transition-all group">
            <span className="text-[10px] font-black text-muted-foreground/40 w-4 text-right mt-0.5 shrink-0">{i+1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold leading-snug group-hover:text-primary transition-colors">{item.title}</p>
              <div className="flex items-center gap-2.5 mt-1 text-[10px] text-muted-foreground flex-wrap">
                {item.author && <span className="font-medium opacity-70">{item.author}</span>}
                {item.pubDate && <span className="opacity-40">{fmtDate(item.pubDate)}</span>}
              </div>
            </div>
            <ExternalLink className="size-3 text-muted-foreground/20 shrink-0 mt-1 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>

      {items.length > 0 && (
        <p className="text-center text-[10px] text-muted-foreground pt-1">
          출처:{' '}
          <a href="https://school.cbe.go.kr/cbs-h" target="_blank" rel="noopener noreferrer" className="hover:underline font-bold">
            충북과학고등학교 홈페이지
          </a>
        </p>
      )}
    </div>
  );
}

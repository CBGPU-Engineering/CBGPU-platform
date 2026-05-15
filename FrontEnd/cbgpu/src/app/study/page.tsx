'use client';
import { useState, useRef } from 'react';
import { useTheme } from 'next-themes';
import { ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SITE_URL = 'https://cbsh.edu-set.com';

export default function StudyPage() {
  const [blocked, setBlocked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const reload = () => {
    if (iframeRef.current) {
      setLoaded(false);
      iframeRef.current.src = SITE_URL;
    }
  };

  return (
    <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 120px)', minHeight: 500 }}>
      {/* toolbar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-muted rounded-xl border border-border/50">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">🏫</span>
          <span className="text-xs font-bold text-muted-foreground truncate">{SITE_URL}</span>
        </div>
        <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={reload}>
          <RefreshCw className="size-3.5" />
        </Button>
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="icon" className="size-8">
            <ExternalLink className="size-3.5" />
          </Button>
        </a>
      </div>

      {/* loading bar */}
      {!loaded && !blocked && (
        <div className="flex-shrink-0 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
        </div>
      )}

      {/* iframe */}
      {!blocked ? (
        <iframe
          ref={iframeRef}
          src={SITE_URL}
          className="flex-1 w-full rounded-2xl border border-border/40 shadow-lg bg-background transition-all duration-300"
          style={isDark ? { filter: 'invert(1) hue-rotate(180deg)' } : undefined}
          onLoad={() => setLoaded(true)}
          onError={() => setBlocked(true)}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          title="충북과학고 자습신청"
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 rounded-2xl border border-border/40 bg-muted/20">
          <AlertTriangle className="size-10 text-amber-500" />
          <div className="text-center space-y-1">
            <p className="font-black text-lg uppercase tracking-tight">임베드 차단됨</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              학교 서버에서 X-Frame-Options 보안 헤더를 설정해 외부 임베드를 차단하고 있습니다.
            </p>
          </div>
          <a href={SITE_URL} target="_blank" rel="noopener noreferrer">
            <Button className="font-black uppercase tracking-widest gap-2">
              <ExternalLink className="size-4" />
              새 탭에서 열기
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}

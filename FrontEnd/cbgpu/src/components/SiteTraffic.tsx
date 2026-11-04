'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function SiteTraffic() {
  const pathname = usePathname();
  useEffect(() => {
    if (navigator.doNotTrack === '1' || pathname.startsWith('/api/') || pathname.startsWith('/backend/')) return;
    const timer = window.setTimeout(() => {
      void fetch('/api/traffic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: pathname }), keepalive: true }).catch(() => {});
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [pathname]);
  return null;
}

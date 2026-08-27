'use client';
import { useEffect, useState } from 'react';
import DxfParser from 'dxf-parser';
import { LoadingSpinner } from '@/components/ui/spinner';

interface Pt { x: number; y: number; bulge?: number }

/** Converts an LWPOLYLINE/POLYLINE bulge segment into an SVG elliptical-arc command. */
function bulgeArc(p1: Pt, p2: Pt, bulge: number) {
  const angle = 4 * Math.atan(bulge);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chord = Math.hypot(dx, dy);
  const r = Math.abs(chord / (2 * Math.sin(angle / 2))) || 0;
  const largeArc = Math.abs(angle) > Math.PI ? 1 : 0;
  const sweep = bulge < 0 ? 1 : 0;
  return `A ${r} ${r} 0 ${largeArc} ${sweep} ${p2.x} ${-p2.y}`;
}

/** Renders a .dxf drawing's 2D geometry (lines, arcs, circles, polylines) as an SVG.
 * Entity types outside that set (splines, text, block inserts, dimensions, ...) are skipped. */
export function DxfPreview({ src }: { src: string }) {
  const [paths, setPaths] = useState<string[] | null>(null);
  const [viewBox, setViewBox] = useState('0 0 100 100');
  const [strokeWidth, setStrokeWidth] = useState(0.5);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPaths(null);
    setError(null);

    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error('fetch failed');
        const text = await res.text();
        const dxf = new DxfParser().parseSync(text);
        if (!dxf) throw new Error('parse failed');

        const segments: string[] = [];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const extend = (x: number, y: number) => {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        };

        for (const e of dxf.entities as any[]) {
          if (e.type === 'LINE' && e.vertices?.length >= 2) {
            const [a, b] = e.vertices;
            extend(a.x, a.y); extend(b.x, b.y);
            segments.push(`M ${a.x} ${-a.y} L ${b.x} ${-b.y}`);
          } else if (e.type === 'CIRCLE') {
            const { center, radius } = e;
            extend(center.x - radius, center.y - radius);
            extend(center.x + radius, center.y + radius);
            segments.push(
              `M ${center.x - radius} ${-center.y} ` +
              `A ${radius} ${radius} 0 1 0 ${center.x + radius} ${-center.y} ` +
              `A ${radius} ${radius} 0 1 0 ${center.x - radius} ${-center.y}`
            );
          } else if (e.type === 'ARC') {
            const { center, radius, startAngle, endAngle } = e;
            const s = (startAngle * Math.PI) / 180;
            const en = (endAngle * Math.PI) / 180;
            const sx = center.x + radius * Math.cos(s);
            const sy = center.y + radius * Math.sin(s);
            const ex = center.x + radius * Math.cos(en);
            const ey = center.y + radius * Math.sin(en);
            let sweepDeg = endAngle - startAngle;
            if (sweepDeg < 0) sweepDeg += 360;
            const largeArc = sweepDeg > 180 ? 1 : 0;
            extend(center.x - radius, center.y - radius);
            extend(center.x + radius, center.y + radius);
            segments.push(`M ${sx} ${-sy} A ${radius} ${radius} 0 ${largeArc} 0 ${ex} ${-ey}`);
          } else if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.vertices?.length) {
            const verts: Pt[] = e.vertices;
            let d = '';
            verts.forEach((v, i) => {
              extend(v.x, v.y);
              if (i === 0) { d += `M ${v.x} ${-v.y} `; return; }
              const prev = verts[i - 1];
              d += prev.bulge ? bulgeArc(prev, v, prev.bulge) + ' ' : `L ${v.x} ${-v.y} `;
            });
            if (e.shape && verts.length > 1) {
              const first = verts[0];
              const last = verts[verts.length - 1];
              d += last.bulge ? bulgeArc(last, first, last.bulge) : 'Z';
            }
            segments.push(d);
          }
        }

        if (cancelled) return;
        if (segments.length === 0) { setError('미리보기 가능한 도형을 찾지 못했습니다.'); return; }

        const w = maxX - minX || 1;
        const h = maxY - minY || 1;
        const pad = Math.max(w, h) * 0.06;
        setViewBox(`${minX - pad} ${-maxY - pad} ${w + pad * 2} ${h + pad * 2}`);
        setStrokeWidth(Math.max(w, h) / 250);
        setPaths(segments);
      } catch {
        if (!cancelled) setError('DXF 미리보기를 불러오지 못했습니다.');
      }
    })();

    return () => { cancelled = true; };
  }, [src]);

  return (
    <div className="w-full rounded-2xl border-2 border-border/60 bg-white flex items-center justify-center overflow-hidden" style={{ height: 360 }}>
      {error ? (
        <p className="text-xs font-bold text-muted-foreground px-6 text-center">{error}</p>
      ) : !paths ? (
        <LoadingSpinner size={36} label="도면 불러오는 중" />
      ) : (
        <svg viewBox={viewBox} className="w-full h-full p-4">
          {paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#111827" strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      )}
    </div>
  );
}

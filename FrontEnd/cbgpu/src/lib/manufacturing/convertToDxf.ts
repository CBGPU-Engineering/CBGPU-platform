export const CONVERTIBLE_2D_EXTENSIONS = ['svg', 'dwg'] as const;

/** Converts a .dwg file to a .dxf Blob using nasjidwg's DWG reader + DXF writer
 * (pure TypeScript, no WASM/native parser). Loaded lazily since it's a sizable
 * library only needed when someone actually uploads a .dwg. */
export async function convertDwgToDxf(file: File): Promise<Blob> {
  const { readDwg, writeDxf } = await import('nasjidwg');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const drawing = readDwg(bytes);
  const dxfText = writeDxf(drawing);
  return new Blob([dxfText], { type: 'application/dxf' });
}

function lwpolylineEntity(points: { x: number; y: number }[]): string {
  let s = `0\nLWPOLYLINE\n8\n0\n90\n${points.length}\n70\n0\n`;
  for (const p of points) s += `10\n${p.x}\n20\n${p.y}\n`;
  return s;
}

/** Converts an .svg file to a .dxf Blob by sampling each shape's outline (via the
 * browser's native SVGGeometryElement.getPointAtLength) into a polyline — this covers
 * arbitrary paths/curves without needing a bezier/arc math library, at the cost of
 * curves becoming many short straight segments rather than true DXF arcs. */
export async function convertSvgToDxf(file: File): Promise<Blob> {
  const svgText = await file.text();
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('invalid SVG');

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '-99999px';
  container.style.width = '1px';
  container.style.height = '1px';
  document.body.appendChild(container);

  try {
    const importedSvg = document.importNode(doc.documentElement, true) as unknown as SVGSVGElement;
    container.appendChild(importedSvg);

    const shapeEls = importedSvg.querySelectorAll('path, line, circle, ellipse, rect, polyline, polygon');
    const entities: string[] = [];

    shapeEls.forEach((el) => {
      if (!(el instanceof SVGGeometryElement)) return;
      let len = 0;
      try { len = el.getTotalLength(); } catch { return; }
      if (!len || !isFinite(len)) return;

      const steps = Math.max(2, Math.min(500, Math.ceil(len / 0.5)));
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= steps; i++) {
        const p = el.getPointAtLength((len * i) / steps);
        pts.push({ x: p.x, y: -p.y }); // SVG is y-down, DXF is y-up
      }
      entities.push(lwpolylineEntity(pts));
    });

    if (entities.length === 0) throw new Error('no drawable shapes found in SVG');

    const dxfText = `0\nSECTION\n2\nENTITIES\n${entities.join('')}0\nENDSEC\n0\nEOF\n`;
    return new Blob([dxfText], { type: 'application/dxf' });
  } finally {
    document.body.removeChild(container);
  }
}

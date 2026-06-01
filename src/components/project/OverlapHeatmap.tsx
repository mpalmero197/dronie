import { forwardRef, useMemo } from "react";
import type { GpsPoint } from "@/lib/photogrammetry";

export interface OverlapHeatmapProps {
  points: GpsPoint[];
  /** Grid resolution in cells per side. */
  gridSize?: number;
}

/**
 * Lightweight density heatmap rendered as an SVG grid.
 * No external dependencies — bins GPS points into a square grid and color-codes by count.
 * Bright green = strong overlap, amber = thin coverage, red = gap.
 */
export const OverlapHeatmap = forwardRef<SVGSVGElement, OverlapHeatmapProps>(
  function OverlapHeatmap({ points, gridSize = 18 }, ref) {
    const { cells, maxCount, gaps, weak } = useMemo(() => {
      const valid = points.filter((p) => p.lat != null && p.lng != null);
      if (valid.length === 0) {
        return { cells: [] as { x: number; y: number; count: number }[], maxCount: 0, gaps: 0, weak: 0 };
      }
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (const p of valid) {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      }
      const latSpan = Math.max(1e-9, maxLat - minLat);
      const lngSpan = Math.max(1e-9, maxLng - minLng);
      const counts = new Map<string, number>();
      for (const p of valid) {
        const cx = Math.min(gridSize - 1, Math.floor(((p.lng - minLng) / lngSpan) * gridSize));
        const cy = Math.min(gridSize - 1, Math.floor(((maxLat - p.lat) / latSpan) * gridSize));
        const k = `${cx}:${cy}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      const cellsArr: { x: number; y: number; count: number }[] = [];
      let maxC = 0;
      let g = 0;
      let w = 0;
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const c = counts.get(`${x}:${y}`) ?? 0;
          if (c > maxC) maxC = c;
          if (c === 0) g++;
          else if (c < 3) w++;
          cellsArr.push({ x, y, count: c });
        }
      }
      return { cells: cellsArr, maxCount: maxC, gaps: g, weak: w };
    }, [points, gridSize]);

    if (cells.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No GPS data to visualize coverage.
        </div>
      );
    }

    const cellPx = 14;
    const size = gridSize * cellPx;

    const colorFor = (c: number) => {
      if (c === 0) return "hsl(var(--muted))";
      const t = Math.min(1, c / Math.max(1, maxCount));
      // 0..1 → red→amber→green via simple hsl mix in css var hsl form
      if (t < 0.25) return `hsl(0 70% 55% / ${0.4 + t})`;
      if (t < 0.6) return `hsl(40 90% 55% / ${0.55 + t * 0.3})`;
      return `hsl(142 70% 45% / ${0.55 + t * 0.4})`;
    };

    return (
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          <span>Image density heatmap</span>
          <span>
            {gaps > 0 && <span className="text-destructive mr-2">{gaps} gap{gaps === 1 ? "" : "s"}</span>}
            {weak > 0 && <span className="text-amber-500">{weak} thin</span>}
          </span>
        </div>
        <svg ref={ref} viewBox={`0 0 ${size} ${size}`} className="w-full h-auto rounded-md" role="img" aria-label="GPS image density heatmap">
          {cells.map((c) => (
            <rect
              key={`${c.x}:${c.y}`}
              x={c.x * cellPx}
              y={c.y * cellPx}
              width={cellPx - 1}
              height={cellPx - 1}
              fill={colorFor(c.count)}
              rx={1.5}
            >
              <title>{c.count} image{c.count === 1 ? "" : "s"}</title>
            </rect>
          ))}
        </svg>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-muted inline-block" /> Empty</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "hsl(0 70% 55%)" }} /> Low</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "hsl(40 90% 55%)" }} /> Mid</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "hsl(142 70% 45%)" }} /> Dense</span>
        </div>
      </div>
    );
  }
);
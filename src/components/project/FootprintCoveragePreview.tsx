import { useMemo } from "react";
import { Layers } from "lucide-react";

export interface FootprintCoveragePreviewProps {
  /** Single image footprint, in metres. */
  footprintWidthM: number;
  footprintHeightM: number;
  /** Distance between adjacent flight lines, in metres. */
  lineSpacingM: number;
  frontOverlapPct: number;
  sideOverlapPct: number;
  /** Total project area in hectares (used to size the synthetic plot). */
  areaHa: number;
}

/**
 * Live, top-down preview of how the chosen GSD / overlap settings will tile
 * a synthetic square plot of the requested area — drawn before any images
 * are uploaded. Mirrors the “coverage map” surveyors see in Pix4D Capture.
 *
 * Each translucent rectangle is one image footprint. Where rectangles stack
 * the colour gets darker, so the user can immediately see overlap density
 * (the same heat-map idea Pix4D / DroneDeploy show).
 */
export function FootprintCoveragePreview({
  footprintWidthM,
  footprintHeightM,
  lineSpacingM,
  frontOverlapPct,
  sideOverlapPct,
  areaHa,
}: FootprintCoveragePreviewProps) {
  const data = useMemo(() => {
    const safeArea = Math.max(0.05, areaHa || 0.05);
    const sideM = Math.sqrt(safeArea * 10_000); // metres of the synthetic square
    const stepFrontM = Math.max(
      1,
      footprintHeightM * (1 - Math.min(0.95, frontOverlapPct / 100))
    );
    const stepSideM = Math.max(1, lineSpacingM);

    // Pad so corner footprints fully cover the area.
    const padW = footprintWidthM / 2;
    const padH = footprintHeightM / 2;

    // X centres of flight lines.
    const xCentres: number[] = [];
    for (let x = padW; x <= sideM - padW + stepSideM / 2; x += stepSideM) {
      xCentres.push(x);
    }
    if (xCentres.length === 0) xCentres.push(sideM / 2);

    // Y centres of waypoints along each line.
    const yCentres: number[] = [];
    for (let y = padH; y <= sideM - padH + stepFrontM / 2; y += stepFrontM) {
      yCentres.push(y);
    }
    if (yCentres.length === 0) yCentres.push(sideM / 2);

    // Soft cap so massive missions still preview smoothly.
    const MAX_FOOTPRINTS = 600;
    const total = xCentres.length * yCentres.length;
    const stride = total > MAX_FOOTPRINTS ? Math.ceil(total / MAX_FOOTPRINTS) : 1;

    const footprints: { cx: number; cy: number }[] = [];
    let i = 0;
    for (let xi = 0; xi < xCentres.length; xi++) {
      // Lawnmower: reverse every other line so the flight path is realistic.
      const ys = xi % 2 === 0 ? yCentres : [...yCentres].reverse();
      for (const cy of ys) {
        if (i % stride === 0) footprints.push({ cx: xCentres[xi], cy });
        i++;
      }
    }

    // Flight path polyline (in metres).
    const path: { x: number; y: number }[] = [];
    for (let xi = 0; xi < xCentres.length; xi++) {
      const ys = xi % 2 === 0 ? yCentres : [...yCentres].reverse();
      path.push({ x: xCentres[xi], y: ys[0] });
      path.push({ x: xCentres[xi], y: ys[ys.length - 1] });
    }

    // Coverage % (sampled grid — fast and accurate enough for a preview).
    const GRID = 60;
    const cell = sideM / GRID;
    let covered = 0;
    for (let gx = 0; gx < GRID; gx++) {
      for (let gy = 0; gy < GRID; gy++) {
        const px = (gx + 0.5) * cell;
        const py = (gy + 0.5) * cell;
        const hit = footprints.some(
          (f) =>
            Math.abs(px - f.cx) <= footprintWidthM / 2 &&
            Math.abs(py - f.cy) <= footprintHeightM / 2,
        );
        if (hit) covered++;
      }
    }
    const coveragePct = Math.round((covered / (GRID * GRID)) * 100);

    return {
      sideM,
      footprints,
      path,
      shownCount: footprints.length,
      totalCount: total,
      coveragePct,
      stepFrontM,
    };
  }, [
    footprintWidthM,
    footprintHeightM,
    lineSpacingM,
    frontOverlapPct,
    sideOverlapPct,
    areaHa,
  ]);

  // SVG viewBox is in metres; we scale via CSS for crisp rendering.
  const VB = data.sideM;
  const fpOpacity = Math.min(0.32, 0.06 + (1 - frontOverlapPct / 100) * 0.4);

  return (
    <div className="rounded-xl border border-border bg-secondary/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/50">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          <Layers className="w-3 h-3" />
          Footprint &amp; coverage preview
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-foreground">
          <span>
            <span className="text-muted-foreground">Coverage</span>{" "}
            <span className={data.coveragePct >= 99 ? "text-primary" : "text-accent"}>
              {data.coveragePct}%
            </span>
          </span>
          <span>
            <span className="text-muted-foreground">Plot</span>{" "}
            {Math.round(data.sideM)}×{Math.round(data.sideM)} m
          </span>
        </div>
      </div>

      <div className="aspect-square w-full bg-[hsl(var(--background))] relative">
        <svg
          viewBox={`0 0 ${VB} ${VB}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
        >
          {/* Plot boundary */}
          <rect
            x={0}
            y={0}
            width={VB}
            height={VB}
            fill="hsl(var(--muted) / 0.25)"
            stroke="hsl(var(--border))"
            strokeWidth={Math.max(0.4, VB / 400)}
            strokeDasharray={`${VB / 60} ${VB / 90}`}
          />

          {/* Footprints — overlap visualises as darker primary */}
          <g>
            {data.footprints.map((f, i) => (
              <rect
                key={i}
                x={f.cx - footprintWidthM / 2}
                y={f.cy - footprintHeightM / 2}
                width={footprintWidthM}
                height={footprintHeightM}
                fill="hsl(var(--primary))"
                fillOpacity={fpOpacity}
                stroke="hsl(var(--primary))"
                strokeOpacity={0.35}
                strokeWidth={Math.max(0.15, VB / 1200)}
              />
            ))}
          </g>

          {/* Flight path polyline */}
          <polyline
            points={data.path.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth={Math.max(0.4, VB / 350)}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.85}
          />

          {/* Scale bar — 50 m */}
          {VB > 80 && (
            <g transform={`translate(${VB * 0.04}, ${VB * 0.96})`}>
              <line
                x1={0}
                y1={0}
                x2={50}
                y2={0}
                stroke="hsl(var(--foreground))"
                strokeWidth={Math.max(0.6, VB / 250)}
              />
              <text
                x={25}
                y={-VB * 0.012}
                fontSize={VB / 45}
                textAnchor="middle"
                fill="hsl(var(--foreground))"
                fontFamily="monospace"
              >
                50 m
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[10px] text-muted-foreground border-t border-border">
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-primary/30 border border-primary/50" />
          image footprint
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-[2px] bg-accent" />
          flight path
        </span>
        <span className="ml-auto font-mono">
          {data.shownCount === data.totalCount
            ? `${data.totalCount} footprints`
            : `${data.shownCount} / ${data.totalCount} shown`}
          {" · "}
          step {Math.round(data.stepFrontM)} m × {Math.round(lineSpacingM)} m
        </span>
      </div>
    </div>
  );
}
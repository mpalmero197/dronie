import { forwardRef, useRef, useState } from "react";
import { Map as MapIcon, ZoomIn, ZoomOut, Maximize2, RotateCcw, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface OrthoPreviewProps {
  /** Direct URL to the orthomosaic asset (PNG preferred, GeoTIFF supported for download only). */
  url: string;
  /** Optional label under the header. */
  caption?: string;
}

const isRasterViewable = (u: string) => /\.(png|jpe?g|webp)(\?|$)/i.test(u);

export const OrthoPreview = forwardRef<HTMLDivElement, OrthoPreviewProps>(
  function OrthoPreview({ url, caption }, ref) {
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [full, setFull] = useState(false);
    const [failed, setFailed] = useState(false);
    const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
    const viewable = isRasterViewable(url) && !failed;

    const reset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

    const onPointerDown = (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    };
    const onPointerMove = (e: React.PointerEvent) => {
      if (!drag.current) return;
      setOffset({
        x: drag.current.ox + (e.clientX - drag.current.x),
        y: drag.current.oy + (e.clientY - drag.current.y),
      });
    };
    const onPointerUp = () => { drag.current = null; };

    const onWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(8, Math.max(1, z * (e.deltaY < 0 ? 1.15 : 0.87))));
    };

    const canvas = (
      <div
        className="relative flex-1 overflow-hidden rounded-xl bg-muted/40 border border-border touch-none"
        onWheel={onWheel}
      >
        {viewable ? (
          <img
            src={url}
            alt="Orthomosaic map preview"
            draggable={false}
            onError={() => setFailed(true)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="w-full h-full object-contain select-none cursor-grab active:cursor-grabbing"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: "center" }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-6">
            <MapIcon className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">GeoTIFF preview not available in-browser</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              This orthomosaic is a georeferenced GeoTIFF. Download it or open the map viewer to inspect it at full resolution.
            </p>
          </div>
        )}

        {viewable && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-card/90 backdrop-blur border border-border p-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z / 1.3))}>
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="text-[11px] font-mono px-1 text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(8, z * 1.3))}>
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Reset view" onClick={reset}>
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    );

    return (
      <>
        <div ref={ref} className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-display font-700 text-foreground flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-primary" />
                Orthomosaic preview
              </h2>
              {caption && <p className="text-xs text-muted-foreground mt-0.5">{caption}</p>}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {viewable && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setFull(true)}>
                  <Maximize2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Full screen</span>
                </Button>
              )}
              <Button asChild size="sm" variant="ghost" className="gap-1.5">
                <a href={url} target="_blank" rel="noopener noreferrer" download>
                  <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Download</span>
                </a>
              </Button>
            </div>
          </div>
          <div className="h-[380px] flex">{canvas}</div>
          {viewable && (
            <p className="text-[11px] text-muted-foreground">Scroll to zoom, drag to pan. Review the full map before you export.</p>
          )}
        </div>

        {full && (
          <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="font-display font-700 text-foreground">Orthomosaic</p>
              <Button size="icon" variant="ghost" aria-label="Close full screen" onClick={() => { setFull(false); reset(); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 flex">{canvas}</div>
          </div>
        )}
      </>
    );
  }
);

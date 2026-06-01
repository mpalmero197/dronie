import { forwardRef, useRef, useState, useCallback } from "react";

export interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

/**
 * Two-image comparison slider for before/after project versions.
 * Drag the handle (or click anywhere on the image) to wipe between revisions.
 */
export const BeforeAfterSlider = forwardRef<HTMLDivElement, BeforeAfterSliderProps>(
  function BeforeAfterSlider(
    { beforeUrl, afterUrl, beforeLabel = "Before", afterLabel = "After", className = "" },
    ref
  ) {
    const [pct, setPct] = useState(50);
    const dragging = useRef(false);
    const container = useRef<HTMLDivElement | null>(null);

    const updateFromX = useCallback((clientX: number) => {
      const el = container.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      setPct((x / rect.width) * 100);
    }, []);

    return (
      <div
        ref={(el) => {
          container.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) (ref as any).current = el;
        }}
        className={`relative w-full aspect-video bg-muted rounded-xl overflow-hidden select-none cursor-ew-resize ${className}`}
        onMouseDown={(e) => { dragging.current = true; updateFromX(e.clientX); }}
        onMouseMove={(e) => dragging.current && updateFromX(e.clientX)}
        onMouseUp={() => (dragging.current = false)}
        onMouseLeave={() => (dragging.current = false)}
        onTouchStart={(e) => updateFromX(e.touches[0].clientX)}
        onTouchMove={(e) => updateFromX(e.touches[0].clientX)}
      >
        <img src={beforeUrl} alt={beforeLabel} className="absolute inset-0 w-full h-full object-cover" draggable={false} loading="lazy" />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${pct}%)` }}>
          <img src={afterUrl} alt={afterLabel} className="w-full h-full object-cover" draggable={false} loading="lazy" />
        </div>
        <span className="absolute top-3 left-3 px-2 py-1 rounded-md bg-background/80 backdrop-blur text-[10px] uppercase tracking-wider font-semibold text-foreground border border-border">
          {beforeLabel}
        </span>
        <span className="absolute top-3 right-3 px-2 py-1 rounded-md bg-background/80 backdrop-blur text-[10px] uppercase tracking-wider font-semibold text-foreground border border-border">
          {afterLabel}
        </span>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_12px_hsl(var(--primary))] pointer-events-none"
          style={{ left: `${pct}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold border-2 border-background shadow-lg">
            ⇆
          </div>
        </div>
      </div>
    );
  }
);
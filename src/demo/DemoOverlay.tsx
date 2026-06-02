import { Pause, Play, SkipBack, SkipForward, X, Sparkles, ChevronUp, ChevronDown, Keyboard } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDemo } from "./DemoContext";
import { stopAllDemoTimers } from "./seedDemo";

export default function DemoOverlay() {
  const demo = useDemo();
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!demo.active || !demo.isPlaying) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 150);
    return () => window.clearInterval(id);
  }, [demo.active, demo.isPlaying, demo.stepIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!demo.active) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") { e.preventDefault(); demo.next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); demo.prev(); }
      else if (e.key === " ") { e.preventDefault(); demo.togglePlay(); }
      else if (e.key === "Escape") { stopAllDemoTimers(); demo.exit(); }
      else if (e.key === "?") setShowHelp((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demo]);

  // Group steps into chapters for the rail (hook must run unconditionally)
  const chapters = useMemo(() => {
    const map = new Map<string, { name: string; from: number; to: number }>();
    demo.steps.forEach((s, i) => {
      const c = map.get(s.chapter);
      if (!c) map.set(s.chapter, { name: s.chapter, from: i, to: i });
      else c.to = i;
    });
    return Array.from(map.values());
  }, [demo.steps]);

  if (!demo.active || !demo.currentStep) return null;

  const elapsed = (tick * 150) % demo.currentStep.durationMs;
  const pct = Math.min(100, (elapsed / demo.currentStep.durationMs) * 100);

  const handleExit = () => {
    stopAllDemoTimers();
    demo.exit();
  };

  const stepNum = demo.stepIndex + 1;
  const total = demo.steps.length;
  const isLast = demo.stepIndex === total - 1;
  const step = demo.currentStep;

  return (
    <>
      {/* Cinematic vignette so the controls feel like a film overlay */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[9998]"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 100%, hsl(var(--primary) / 0.18) 0%, transparent 55%)",
        }}
      />

      <div
        role="region"
        aria-label="Product demo controls"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[min(1080px,calc(100vw-1.5rem))]"
      >
        <div className="rounded-2xl border border-primary-foreground/10 bg-foreground/95 text-primary-foreground backdrop-blur-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] overflow-hidden animate-fade-in">
          {/* Progress bar */}
          <div className="h-1 bg-primary-foreground/10 relative overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent via-accent to-highlight transition-[width] duration-150 ease-linear"
              style={{ width: `${demo.isPlaying ? pct : pct || 4}%` }}
            />
            {/* Chapter ticks */}
            <div className="absolute inset-0 flex">
              {demo.steps.slice(0, -1).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 border-r border-primary-foreground/15"
                />
              ))}
              <div className="flex-1" />
            </div>
          </div>

          {/* Chapter rail */}
          <div className="px-4 pt-3 flex items-center gap-1 overflow-x-auto scrollbar-none">
            {chapters.map((c) => {
              const active = demo.stepIndex >= c.from && demo.stepIndex <= c.to;
              const done = demo.stepIndex > c.to;
              return (
                <button
                  key={c.name}
                  onClick={() => demo.goTo(c.from)}
                  className={`text-[10px] font-semibold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full transition-all whitespace-nowrap ${
                    active
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : done
                      ? "bg-primary-foreground/10 text-primary-foreground/60"
                      : "text-primary-foreground/40 hover:text-primary-foreground/70"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
            <div className="ml-auto flex items-center gap-2 text-[10px] font-mono text-primary-foreground/50">
              <Keyboard className="w-3 h-3" />
              <span className="hidden sm:inline">← / → / space / esc</span>
            </div>
          </div>

          {/* Main panel */}
          <div className="p-4 sm:p-5 flex items-start gap-4">
            <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-accent/15 text-accent items-center justify-center shrink-0 ring-1 ring-accent/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
                <span>Chapter {stepNum} of {total}</span>
                <span className="text-primary-foreground/30">•</span>
                <span className="text-primary-foreground/55">{step.chapter}</span>
              </div>
              <h3 className="mt-1 text-lg sm:text-xl font-display font-700 leading-tight">
                {step.title}
              </h3>
              {expanded && (
                <p className="mt-1.5 text-sm text-primary-foreground/70 leading-relaxed line-clamp-3 sm:line-clamp-none">
                  {step.caption}
                </p>
              )}
              {expanded && step.highlights && step.highlights.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {step.highlights.map((h) => (
                    <li
                      key={h}
                      className="text-[11px] font-medium px-2 py-1 rounded-md bg-primary-foreground/8 text-primary-foreground/80 border border-primary-foreground/10"
                    >
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="flex items-center gap-0.5 rounded-full bg-primary-foreground/8 p-0.5 border border-primary-foreground/10">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={demo.prev}
                  aria-label="Previous step"
                  disabled={demo.stepIndex === 0}
                  className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  onClick={demo.togglePlay}
                  aria-label={demo.isPlaying ? "Pause demo" : "Play demo"}
                  className="h-9 w-9 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {demo.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-[1px]" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={demo.next}
                  aria-label="Next step"
                  disabled={isLast}
                  className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setExpanded((v) => !v)}
                  aria-label={expanded ? "Collapse" : "Expand"}
                  className="h-6 w-6 rounded-full text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10"
                >
                  {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleExit}
                  aria-label="Exit demo"
                  className="h-6 w-6 rounded-full text-primary-foreground/60 hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Step dot rail */}
          <div className="px-4 pb-4 flex items-center gap-1.5">
            {demo.steps.map((s, i) => {
              const active = i === demo.stepIndex;
              const done = i < demo.stepIndex;
              return (
                <button
                  key={s.id}
                  onClick={() => demo.goTo(i)}
                  title={s.title}
                  aria-label={`Jump to: ${s.title}`}
                  className={`group relative h-1.5 flex-1 rounded-full transition-all ${
                    active
                      ? "bg-accent"
                      : done
                      ? "bg-primary-foreground/40"
                      : "bg-primary-foreground/12 hover:bg-primary-foreground/25"
                  }`}
                >
                  {active && (
                    <span
                      className="absolute inset-y-0 left-0 bg-primary-foreground/80 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {showHelp && (
          <div className="mt-2 mx-auto max-w-md rounded-xl bg-foreground/95 text-primary-foreground border border-primary-foreground/10 px-4 py-3 text-xs animate-fade-in">
            <div className="font-semibold mb-1 text-accent">Keyboard shortcuts</div>
            <div className="grid grid-cols-2 gap-y-1 font-mono text-primary-foreground/70">
              <span>← →</span><span>previous / next</span>
              <span>space</span><span>play / pause</span>
              <span>esc</span><span>exit demo</span>
              <span>?</span><span>toggle help</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
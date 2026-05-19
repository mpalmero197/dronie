import { Pause, Play, SkipBack, SkipForward, X, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDemo } from "./DemoContext";
import { stopDemoTimers } from "./seedDemo";

export default function DemoOverlay() {
  const demo = useDemo();
  const [tick, setTick] = useState(0);

  // re-render every 200ms while playing so the progress bar advances visually
  useEffect(() => {
    if (!demo.active || !demo.isPlaying) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, [demo.active, demo.isPlaying, demo.stepIndex]);

  if (!demo.active || !demo.currentStep) return null;

  // Approx progress for the current step (we don't track exact remaining time)
  const elapsed = (tick * 200) % demo.currentStep.durationMs;
  const pct = Math.min(100, (elapsed / demo.currentStep.durationMs) * 100);

  const handleExit = () => {
    stopDemoTimers();
    demo.exit();
  };

  const stepNum = demo.stepIndex + 1;
  const total = demo.steps.length;
  const isLast = demo.stepIndex === total - 1;

  return (
    <div
      role="region"
      aria-label="Product demo controls"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[min(960px,calc(100vw-2rem))]"
    >
      <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-accent transition-[width] duration-200 ease-linear"
            style={{ width: `${demo.isPlaying ? pct : 0}%` }}
          />
        </div>
        <div className="p-3 sm:p-4 flex items-start gap-3">
          <div className="hidden sm:flex w-9 h-9 rounded-full bg-accent/15 text-accent items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent">Demo {stepNum}/{total}</span>
              <span className="truncate text-foreground">{demo.currentStep.title}</span>
            </div>
            <p className="mt-1 text-sm text-foreground/85 leading-snug line-clamp-2">
              {demo.currentStep.caption}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" onClick={demo.prev} aria-label="Previous step" disabled={demo.stepIndex === 0}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={demo.togglePlay} aria-label={demo.isPlaying ? "Pause demo" : "Play demo"}>
              {demo.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={demo.next} aria-label="Next step" disabled={isLast}>
              <SkipForward className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={handleExit} aria-label="Exit demo">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
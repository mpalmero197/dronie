import { useState, useEffect } from "react";
import { X, MousePointer2, Pentagon, Settings2, CheckCircle2 } from "lucide-react";

const STORAGE_KEY = "dronie.planCoachmark.dismissed";

interface PlanCoachmarkProps {
  /** Force show even if previously dismissed (for re-launching from a button) */
  forceShow?: boolean;
  onClose?: () => void;
}

const STEPS = [
  {
    icon: Pentagon,
    title: "1. Draw your survey area",
    body: "The polygon tool is already selected — click points on the map to outline the area you want to map. Double-click to finish.",
  },
  {
    icon: Settings2,
    title: "2. Tune the mission",
    body: "Adjust altitude, overlap, and drone model. Dronie auto-generates the lawnmower path and estimates flight time + battery.",
  },
  {
    icon: CheckCircle2,
    title: "3. Export & fly",
    body: "Download a KMZ for DJI Fly, a PDF briefing, or save the plan to a project so the pilot can follow it on their phone.",
  },
];

export default function PlanCoachmark({ forceShow, onClose }: PlanCoachmarkProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      setStep(0);
      return;
    }
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [forceShow]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
    onClose?.();
  };

  if (!visible) return null;

  const Step = STEPS[step];
  const Icon = Step.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="absolute inset-0 z-[1100] pointer-events-none flex items-end sm:items-center sm:justify-center p-4">
      {/* Subtle backdrop */}
      <div
        className="absolute inset-0 bg-background/40 backdrop-blur-[2px] pointer-events-auto"
        onClick={dismiss}
      />

      <div className="relative pointer-events-auto bg-card border border-border rounded-2xl shadow-2xl p-5 max-w-sm w-full">
        <button
          onClick={dismiss}
          className="absolute top-2.5 right-2.5 p-1 rounded-md hover:bg-secondary text-muted-foreground"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Icon className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">
              Plan a flight · {step + 1} of {STEPS.length}
            </p>
            <h3 className="font-display font-700 text-foreground text-base mt-0.5">{Step.title}</h3>
          </div>
        </div>

        <p className="text-sm text-foreground/80 leading-relaxed mb-4 pl-12">{Step.body}</p>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={dismiss}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-secondary"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5"
            >
              {isLast ? (
                <>
                  Got it <CheckCircle2 className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Next <MousePointer2 className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

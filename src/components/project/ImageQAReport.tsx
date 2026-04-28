import { forwardRef } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, Camera, Layers, Map } from "lucide-react";
import type { QaResult } from "@/lib/photogrammetry";

const PALETTE = {
  pass: { color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", Icon: CheckCircle2, label: "Ready to process" },
  warn: { color: "text-accent", bg: "bg-accent/10", border: "border-accent/20", Icon: AlertTriangle, label: "Process with caution" },
  fail: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", Icon: XCircle, label: "Issues to fix first" },
} as const;

const LEVEL_ICON = { info: Info, warn: AlertTriangle, error: XCircle } as const;

export interface ImageQAReportProps {
  qa: QaResult;
}

export const ImageQAReport = forwardRef<HTMLDivElement, ImageQAReportProps>(
  function ImageQAReport({ qa }, ref) {
    const tone = PALETTE[qa.overall];
    const ToneIcon = tone.Icon;
    return (
      <div ref={ref} className={`rounded-2xl border p-4 space-y-3 ${tone.bg} ${tone.border}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ToneIcon className={`w-4 h-4 ${tone.color}`} />
            <p className={`text-sm font-display font-700 ${tone.color}`}>Pre-flight QA · {tone.label}</p>
          </div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            {qa.totalImages} images
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat icon={Map} label="GPS coverage" value={`${qa.gpsCoveragePct}%`} sub={`${qa.withGps}/${qa.totalImages}`} />
          <Stat icon={Layers} label="Est. overlap" value={qa.estimatedOverlapPct != null ? `${qa.estimatedOverlapPct}%` : "—"} sub="forward" />
          <Stat icon={Map} label="Est. area" value={qa.estimatedAreaHa != null ? `${qa.estimatedAreaHa.toFixed(2)} ha` : "—"} sub={qa.imagesPerHa ? `${qa.imagesPerHa} img/ha` : ""} />
          <Stat icon={Camera} label="Cameras" value={String(qa.uniqueCameras.length || "—")} sub={qa.uniqueCameras[0] || ""} />
        </div>

        {qa.issues.length > 0 && (
          <ul className="space-y-1.5 pt-1">
            {qa.issues.map((iss, i) => {
              const I = LEVEL_ICON[iss.level];
              const c =
                iss.level === "error"
                  ? "text-destructive"
                  : iss.level === "warn"
                  ? "text-accent"
                  : "text-muted-foreground";
              return (
                <li key={i} className={`flex items-start gap-2 text-xs ${c}`}>
                  <I className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{iss.message}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }
);

function Stat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card/60 rounded-lg p-2.5 border border-border/60">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-sm font-display font-700 text-foreground mt-1">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}
import { forwardRef } from "react";
import { Clock, Coins, HardDrive, AlertTriangle } from "lucide-react";
import type { Estimate } from "@/lib/photogrammetry";

export interface EstimatePanelProps {
  estimate: Estimate;
}

export const EstimatePanel = forwardRef<HTMLDivElement, EstimatePanelProps>(
  function EstimatePanel({ estimate }, ref) {
    const hours = Math.floor(estimate.minutes / 60);
    const mins = estimate.minutes % 60;
    const timeLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;
    const storageLabel =
      estimate.storageMb >= 1024
        ? `${(estimate.storageMb / 1024).toFixed(1)} GB`
        : `${estimate.storageMb} MB`;
    return (
      <div ref={ref} className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-accent/5 p-4 space-y-3">
        <p className="text-xs font-display font-700 text-foreground uppercase tracking-wider">
          Estimate
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Stat icon={Clock} label="Time" value={timeLabel} />
          <Stat icon={Coins} label="Credits" value={String(estimate.credits)} />
          <Stat icon={HardDrive} label="Storage" value={storageLabel} />
        </div>
        {estimate.notes.length > 0 && (
          <ul className="space-y-1 pt-1">
            {estimate.notes.map((n, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-accent">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
);

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-card/70 rounded-lg p-2 border border-border/60">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-sm font-display font-700 text-foreground mt-0.5">{value}</div>
    </div>
  );
}
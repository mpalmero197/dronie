import { forwardRef } from "react";
import { MapPin, Target, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { adviseGcps, type GcpPoint } from "@/lib/missionMath";

export interface GcpAdvisorProps {
  gcps: GcpPoint[];
  areaHa: number | null;
  rtkEnabled: boolean;
}

const Z_TONE = {
  good: { Icon: CheckCircle2, color: "text-primary", label: "Elevation on all GCPs" },
  poor: { Icon: AlertCircle,  color: "text-accent",  label: "Some GCPs missing Z" },
  none: { Icon: XCircle,      color: "text-destructive", label: "No GCP elevations" },
} as const;

/** GCP placement & count guidance — what every surveyor checks
 *  before submitting a project to processing. */
export const GcpAdvisor = forwardRef<HTMLDivElement, GcpAdvisorProps>(
  function GcpAdvisor({ gcps, areaHa, rtkEnabled }, ref) {
    const advice = adviseGcps({ gcps, areaHa, rtkEnabled });
    const Z = Z_TONE[advice.zCoverage];

    return (
      <div ref={ref} className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-700 text-foreground flex items-center gap-2 text-base">
            <Target className="w-4 h-4 text-primary" />
            GCP advisor
          </h2>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            {gcps.length} placed
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Cell label="Recommended" value={String(advice.recommendedCount)} sub={`${rtkEnabled ? "RTK adjusted" : "Without RTK"}`} />
          <Cell label="Checkpoints" value={String(advice.recommendedCheckpoints)} sub="Validation only" />
          <Cell label="Edge coverage" value={`${advice.edgeCoveragePct}%`} sub="of bbox corners" />
          <Cell label="Centre point" value={advice.centerHasPoint ? "Yes" : "Missing"} sub={advice.splitWell ? "Distribution OK" : "Cluster risk"} />
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-secondary/40 border border-border px-3 py-2">
          <Z.Icon className={`w-4 h-4 ${Z.color}`} />
          <span className={`text-xs font-semibold ${Z.color}`}>{Z.label}</span>
        </div>

        {advice.notes.length > 0 && (
          <ul className="space-y-1.5 pt-1">
            {advice.notes.map((n, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-border pt-3 text-[11px] text-muted-foreground leading-relaxed">
          Best practice: 4 corners + 1 centre minimum, +1 GCP per 5 ha. Reserve ~30% as
          checkpoints (excluded from bundle adjustment) so reported RMSE is honest.
        </div>
      </div>
    );
  }
);

function Cell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-2.5 border border-border/60">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="text-sm font-display font-700 text-foreground mt-1">{value}</div>
      <div className="text-[10px] text-muted-foreground truncate">{sub}</div>
    </div>
  );
}

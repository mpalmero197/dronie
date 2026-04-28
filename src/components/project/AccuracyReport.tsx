import { forwardRef } from "react";
import { Target, Activity, Layers, Ruler } from "lucide-react";

export interface AccuracyData {
  gsd_cm?: number;
  rmse_m?: number;
  reprojection_error_px?: number;
  registered_images?: number;
  total_images?: number;
  tie_points?: number;
  gcp_residuals?: { name: string; x: number; y: number; z?: number }[];
}

export interface AccuracyReportProps {
  data: AccuracyData;
}

export const AccuracyReport = forwardRef<HTMLDivElement, AccuracyReportProps>(
  function AccuracyReport({ data }, ref) {
    const regPct =
      data.registered_images != null && data.total_images
        ? Math.round((data.registered_images / data.total_images) * 100)
        : null;
    return (
      <div ref={ref} className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-700 text-foreground flex items-center gap-2 text-base">
            <Target className="w-4 h-4 text-primary" />
            Accuracy Report
          </h2>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Reconstruction quality
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Metric icon={Ruler} label="GSD" value={data.gsd_cm != null ? `${data.gsd_cm.toFixed(1)} cm/px` : "—"} />
          <Metric icon={Activity} label="RMSE" value={data.rmse_m != null ? `${data.rmse_m.toFixed(3)} m` : "—"} />
          <Metric icon={Activity} label="Reproj. err" value={data.reprojection_error_px != null ? `${data.reprojection_error_px.toFixed(2)} px` : "—"} />
          <Metric icon={Layers} label="Registered" value={regPct != null ? `${regPct}%` : "—"} sub={data.total_images ? `${data.registered_images}/${data.total_images}` : ""} />
        </div>
        {data.tie_points != null && (
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{data.tie_points.toLocaleString()}</span> tie points across the bundle adjustment.
          </p>
        )}
        {data.gcp_residuals && data.gcp_residuals.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">GCP Residuals</p>
            <div className="space-y-1 text-xs font-mono">
              <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>Name</span><span>X (m)</span><span>Y (m)</span><span>Z (m)</span>
              </div>
              {data.gcp_residuals.slice(0, 8).map((g) => (
                <div key={g.name} className="grid grid-cols-4 gap-2">
                  <span className="truncate font-sans">{g.name}</span>
                  <span>{g.x.toFixed(3)}</span>
                  <span>{g.y.toFixed(3)}</span>
                  <span>{g.z != null ? g.z.toFixed(3) : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

function Metric({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-2.5 border border-border/60">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-sm font-display font-700 text-foreground mt-1">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
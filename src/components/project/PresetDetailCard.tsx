import { forwardRef } from "react";
import { Layers, Clock, Cpu, ImageIcon } from "lucide-react";
import { PRESETS, QUALITY_PROFILE, type PresetId } from "@/lib/photogrammetry";

export interface PresetDetailCardProps {
  presetId: PresetId;
  imageCount?: number | null;
}

/**
 * Shows a compact summary of what a preset produces, expected outputs, and rough ETA.
 * Replaces the previous "blind pick and pray" preset row by giving the user receipts
 * before they hit Process.
 */
export const PresetDetailCard = forwardRef<HTMLDivElement, PresetDetailCardProps>(
  function PresetDetailCard({ presetId, imageCount }, ref) {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return null;
    const s = preset.settings;
    const profile = QUALITY_PROFILE[s.quality];
    // Rough heuristic: minutes/image scales with imageScale + depthmap resolution.
    const minPerImg = 0.06 * Math.max(0.5, s.imageScale ?? 1) * (profile.depthmapResolution / 640);
    const eta = imageCount ? Math.max(1, Math.round(imageCount * minPerImg)) : null;
    const outputs = s.extraOutputs ?? [];

    return (
      <div ref={ref} className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-display font-700 text-foreground">{preset.label}</p>
            <p className="text-[11px] text-muted-foreground leading-snug">{preset.description}</p>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-primary bg-primary/10 border border-primary/20 rounded-md px-2 py-1">
            {s.quality}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat icon={Layers} label="GSD target" value={s.targetGsdCm != null ? `${s.targetGsdCm} cm/px` : "—"} />
          <Stat icon={ImageIcon} label="Mesh" value={s.meshType} />
          <Stat icon={Cpu} label="Outputs" value={String(outputs.length + (s.dsmEnabled ? 1 : 0) + (s.contoursEnabled ? 1 : 0) + 1)} />
          <Stat icon={Clock} label="Est. ETA" value={eta ? `${eta} min` : "—"} />
        </div>
        {outputs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {outputs.map((o: string) => (
              <span
                key={o}
                className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-secondary/60 border border-border rounded-md px-2 py-0.5"
              >
                {o.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }
);

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-2 border border-border/60">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-sm font-display font-700 text-foreground mt-0.5">{value}</div>
    </div>
  );
}
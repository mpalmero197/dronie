import { forwardRef, useMemo, useState } from "react";
import { Ruler, Target, Wind, Clock, AlertTriangle, Sparkles } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { computeMission, altitudeForTargetGsd } from "@/lib/missionMath";
import type { SensorSpec } from "@/lib/sensor-specs";
import { FootprintCoveragePreview } from "./FootprintCoveragePreview";

export interface MissionCalculatorProps {
  spec: SensorSpec;
  initialAreaHa?: number | null;
  initialAltitudeM?: number;
  initialGcps?: number;
}

/** Real flight-planning math, exposed in the project page. Mirrors what
 *  surveyors compute in Pix4D Capture / DJI Pilot before every survey. */
export const MissionCalculator = forwardRef<HTMLDivElement, MissionCalculatorProps>(
  function MissionCalculator({ spec, initialAreaHa, initialAltitudeM = 80, initialGcps = 0 }, ref) {
    const [altitudeM, setAltitudeM] = useState(initialAltitudeM);
    const [front, setFront] = useState(80);
    const [side,  setSide]  = useState(70);
    const [speed, setSpeed] = useState(Math.min(8, spec.maxSpeedMs));
    const [areaHa, setAreaHa] = useState<number>(initialAreaHa ?? 5);
    const [rtk, setRtk] = useState(spec.hasRtk);
    const [gcps, setGcps] = useState(initialGcps);

    const plan = useMemo(
      () =>
        computeMission({
          spec,
          altitudeM,
          frontOverlapPct: front,
          sideOverlapPct: side,
          speedMs: speed,
          areaHa,
          rtkEnabled: rtk,
          gcpCount: gcps,
        }),
      [spec, altitudeM, front, side, speed, areaHa, rtk, gcps]
    );

    function snapAltitudeForGsd(targetCm: number) {
      setAltitudeM(altitudeForTargetGsd(spec, targetCm));
    }

    return (
      <div ref={ref} className="bg-card rounded-2xl border border-border p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-700 text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Mission calculator
          </h2>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            For {spec.model}
          </span>
        </div>

        {/* Quick GSD snap buttons */}
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 5, 8].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => snapAltitudeForGsd(g)}
              className="text-[11px] px-2 py-1 rounded-md bg-secondary/60 hover:bg-primary/15 hover:text-primary text-muted-foreground transition-colors"
            >
              Snap to {g} cm/px
            </button>
          ))}
        </div>

        {/* Sliders */}
        <div className="grid sm:grid-cols-2 gap-4">
          <SliderRow label="Altitude AGL" value={`${altitudeM} m`}>
            <Slider value={[altitudeM]} onValueChange={(v) => setAltitudeM(v[0])} min={20} max={150} step={5} />
          </SliderRow>
          <SliderRow label="Speed" value={`${speed} m/s`}>
            <Slider value={[speed]} onValueChange={(v) => setSpeed(v[0])} min={2} max={Math.max(20, spec.maxSpeedMs + 5)} step={1} />
          </SliderRow>
          <SliderRow label="Front overlap" value={`${front}%`}>
            <Slider value={[front]} onValueChange={(v) => setFront(v[0])} min={50} max={95} step={1} />
          </SliderRow>
          <SliderRow label="Side overlap" value={`${side}%`}>
            <Slider value={[side]} onValueChange={(v) => setSide(v[0])} min={50} max={90} step={1} />
          </SliderRow>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Area (ha)</Label>
            <Input
              type="number" min={0.1} step={0.5}
              value={areaHa}
              onChange={(e) => setAreaHa(parseFloat(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">GCPs (well-distributed)</Label>
            <Input
              type="number" min={0} step={1}
              value={gcps}
              onChange={(e) => setGcps(parseInt(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* RTK switch */}
        <div className="flex items-center justify-between rounded-xl bg-secondary/40 border border-border px-3 py-2">
          <div>
            <p className="text-sm font-semibold text-foreground">RTK / PPK enabled</p>
            <p className="text-[11px] text-muted-foreground">Cuts predicted error in half and reduces GCP requirement.</p>
          </div>
          <Switch checked={rtk} onCheckedChange={setRtk} />
        </div>

        {/* Outputs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat icon={Ruler} label="GSD" value={`${plan.gsdCmPx.toFixed(2)} cm/px`} />
          <Stat icon={Wind} label="Capture every" value={`${plan.captureIntervalS.toFixed(1)} s`} />
          <Stat icon={Ruler} label="Line spacing" value={`${plan.lineSpacingM.toFixed(1)} m`} />
          <Stat icon={Ruler} label="Footprint" value={`${plan.footprintWidthM.toFixed(0)}×${plan.footprintHeightM.toFixed(0)} m`} />
          <Stat icon={Target} label="Predicted H" value={`±${plan.predictedHorizontalCm.toFixed(1)} cm`} />
          <Stat icon={Target} label="Predicted V" value={`±${plan.predictedVerticalCm.toFixed(1)} cm`} />
          <Stat icon={Clock} label="Images" value={plan.estimatedImageCount?.toLocaleString() ?? "—"} />
          <Stat icon={Clock} label="Flight time" value={plan.estimatedFlightMinutes != null ? `${plan.estimatedFlightMinutes} min` : "—"} />
        </div>

        {plan.warnings.length > 0 && (
          <ul className="space-y-1.5 pt-1">
            {plan.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-accent">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Live coverage preview — what the chosen settings will tile on a
            synthetic plot of the requested area, before any images are uploaded. */}
        <FootprintCoveragePreview
          footprintWidthM={plan.footprintWidthM}
          footprintHeightM={plan.footprintHeightM}
          lineSpacingM={plan.lineSpacingM}
          frontOverlapPct={front}
          sideOverlapPct={side}
          areaHa={areaHa}
        />

        <div className="border-t border-border pt-3 text-[11px] text-muted-foreground leading-relaxed">
          GSD math: <span className="font-mono text-foreground">(sensor × alt × 100) / (focal × image px)</span>.
          Predicted accuracy from typical ODM/Metashape RMSE for this sensor class.
        </div>
      </div>
    );
  }
);

function SliderRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
        <span className="text-xs font-mono text-foreground">{value}</span>
      </div>
      {children}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-2.5 border border-border/60">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-sm font-display font-700 text-foreground mt-1 font-mono">{value}</div>
    </div>
  );
}

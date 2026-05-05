import { forwardRef } from "react";
import { Camera, Radio, Zap } from "lucide-react";
import { SENSOR_SPECS, GENERIC_SPEC, type SensorSpec } from "@/lib/sensor-specs";

export interface DroneCameraPickerProps {
  value: SensorSpec;
  onChange: (spec: SensorSpec) => void;
  disabled?: boolean;
}

/** Surveyor-grade picker: groups by manufacturer, surfaces RTK + shutter type
 *  inline so users don't need to read a datasheet. */
export const DroneCameraPicker = forwardRef<HTMLDivElement, DroneCameraPickerProps>(
  function DroneCameraPicker({ value, onChange, disabled }, ref) {
    const groups = SENSOR_SPECS.reduce<Record<string, SensorSpec[]>>((acc, s) => {
      (acc[s.manufacturer] ||= []).push(s);
      return acc;
    }, {});

    const key = `${value.manufacturer}|${value.model}`;
    return (
      <div ref={ref} className="space-y-2">
        <select
          disabled={disabled}
          value={key}
          onChange={(e) => {
            const [mfg, mdl] = e.target.value.split("|");
            const spec =
              SENSOR_SPECS.find((s) => s.manufacturer === mfg && s.model === mdl) ||
              GENERIC_SPEC;
            onChange(spec);
          }}
          className="w-full h-10 rounded-lg bg-secondary/60 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {Object.entries(groups).map(([mfg, list]) => (
            <optgroup key={mfg} label={mfg}>
              {list.map((s) => (
                <option key={s.model} value={`${s.manufacturer}|${s.model}`}>
                  {s.model} — {s.imageWidthPx}×{s.imageHeightPx}{s.hasRtk ? " · RTK" : ""}
                </option>
              ))}
            </optgroup>
          ))}
          <option value={`${GENERIC_SPEC.manufacturer}|${GENERIC_SPEC.model}`}>
            Other — generic 1-inch sensor
          </option>
        </select>

        <div className="rounded-xl bg-secondary/30 border border-border p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-2 text-foreground">
            <Camera className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold">{value.camera}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-muted-foreground">
            <Spec label="Sensor" value={`${value.sensorWidthMm}×${value.sensorHeightMm} mm`} />
            <Spec label="Focal" value={`${value.focalLengthMm} mm`} />
            <Spec label="Image" value={`${(value.imageWidthPx * value.imageHeightPx / 1_000_000).toFixed(1)} MP`} />
          </div>
          <div className="flex items-center gap-3 pt-1 text-[11px]">
            <Pill icon={Radio} active={value.hasRtk} on="RTK onboard" off="No RTK" />
            <Pill icon={Zap}   active={value.hasMechanicalShutter} on="Mechanical shutter" off="Rolling shutter" />
            <span className="text-muted-foreground">Max safe speed {value.maxSpeedMs} m/s</span>
          </div>
          {value.notes && (
            <p className="pt-1.5 text-muted-foreground italic leading-snug">
              {value.notes}
            </p>
          )}
        </div>
      </div>
    );
  }
);

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider">{label}</div>
      <div className="text-foreground font-mono text-xs">{value}</div>
    </div>
  );
}

function Pill({ icon: Icon, active, on, off }: { icon: any; active: boolean; on: string; off: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
        active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
      }`}
    >
      <Icon className="w-3 h-3" />
      {active ? on : off}
    </span>
  );
}

import { forwardRef } from "react";
import { Layers, Building2, Box, Wheat, Mountain, Sliders, Building, Route, Landmark, Satellite } from "lucide-react";
import { PRESETS, type PresetId } from "@/lib/photogrammetry";

const ICONS: Record<PresetId, any> = {
  mapping: Layers,
  inspection: Building2,
  model3d: Box,
  agriculture: Wheat,
  volumetrics: Mountain,
  facade: Building,
  corridor: Route,
  heritage: Landmark,
  rtk_survey: Satellite,
  custom: Sliders,
};

export interface PresetPickerProps {
  value: PresetId;
  onChange: (id: PresetId) => void;
  disabled?: boolean;
}

export const PresetPicker = forwardRef<HTMLDivElement, PresetPickerProps>(
  function PresetPicker({ value, onChange, disabled }, ref) {
    return (
      <div ref={ref} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {PRESETS.map((p) => {
          const Icon = ICONS[p.id];
          const active = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p.id)}
              className={`text-left rounded-xl border p-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                active
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-secondary/40 hover:border-primary/40 hover:bg-secondary/70"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span
                  className={`text-xs font-semibold ${
                    active ? "text-primary" : "text-foreground"
                  }`}
                >
                  {p.label}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug line-clamp-2">
                {p.description}
              </p>
            </button>
          );
        })}
      </div>
    );
  }
);
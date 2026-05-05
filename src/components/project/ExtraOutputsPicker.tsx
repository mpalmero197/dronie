import { forwardRef } from "react";
import { Package } from "lucide-react";
import { EXTRA_OUTPUTS, type ExtraOutputId } from "@/lib/photogrammetry";

export interface ExtraOutputsPickerProps {
  value: ExtraOutputId[];
  onChange: (next: ExtraOutputId[]) => void;
  disabled?: boolean;
}

export const ExtraOutputsPicker = forwardRef<HTMLDivElement, ExtraOutputsPickerProps>(
  function ExtraOutputsPicker({ value, onChange, disabled }, ref) {
    function toggle(id: ExtraOutputId) {
      const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
      onChange(next);
    }
    return (
      <div ref={ref} className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-3 h-3" /> Extra deliverables
          </p>
          <span className="text-[10px] text-muted-foreground">{value.length} selected</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {EXTRA_OUTPUTS.map((o) => {
            const on = value.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                disabled={disabled}
                onClick={() => toggle(o.id)}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-50 ${
                  on
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary/40 hover:border-primary/40"
                }`}
              >
                <span
                  className={`mt-0.5 inline-block w-3.5 h-3.5 rounded border ${
                    on ? "bg-primary border-primary" : "border-muted-foreground"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${on ? "text-primary" : "text-foreground"}`}>{o.label}</p>
                  <p className="text-[10px] text-muted-foreground">{o.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
);

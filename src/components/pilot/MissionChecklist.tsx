import { useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

const ITEMS = [
  "Battery fully charged",
  "Propellers undamaged & secure",
  "GPS lock acquired (≥10 sats)",
  "Compass calibrated",
  "RTH altitude set above tallest obstacle",
  "Weather: wind <10 m/s, no precipitation",
  "Airspace cleared / LAANC approved",
  "Visual line of sight maintained",
  "SD card inserted & formatted",
  "Camera settings verified",
];

export default function MissionChecklist() {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(true);

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const allDone = checked.size === ITEMS.length;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
              allDone
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {allDone ? <Check className="w-3.5 h-3.5" /> : checked.size}
          </div>
          <span className="text-sm font-semibold text-foreground">
            Pre-flight checklist
          </span>
          <span className="text-xs text-muted-foreground">
            {checked.size}/{ITEMS.length}
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <ul className="divide-y divide-border">
          {ITEMS.map((item, i) => (
            <li key={i}>
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/30 transition-colors"
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    checked.has(i)
                      ? "bg-primary border-primary"
                      : "border-border bg-background"
                  }`}
                >
                  {checked.has(i) && (
                    <Check className="w-3 h-3 text-primary-foreground" />
                  )}
                </div>
                <span
                  className={`text-sm ${
                    checked.has(i)
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }`}
                >
                  {item}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

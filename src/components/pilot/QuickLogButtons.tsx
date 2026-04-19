import { useState } from "react";
import { Battery, Camera, AlertTriangle, MapPin, PlaneTakeoff, PlaneLanding } from "lucide-react";
import type { MissionEventType } from "@/lib/pilotMission";

interface Props {
  onLog: (type: MissionEventType, payload?: Record<string, unknown>) => void;
}

export default function QuickLogButtons({ onLog }: Props) {
  const [batteryOpen, setBatteryOpen] = useState(false);
  const [batteryVal, setBatteryVal] = useState(80);

  const Btn = ({
    icon,
    label,
    onClick,
    className = "",
  }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-border bg-card hover:bg-secondary active:scale-95 transition-all min-h-[72px] ${className}`}
    >
      {icon}
      <span className="text-[11px] font-semibold text-foreground">{label}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Btn
          icon={<PlaneTakeoff className="w-5 h-5 text-primary" />}
          label="Takeoff"
          onClick={() => onLog("takeoff")}
        />
        <Btn
          icon={<MapPin className="w-5 h-5 text-amber-500" />}
          label="Waypoint"
          onClick={() => onLog("waypoint_reached")}
        />
        <Btn
          icon={<PlaneLanding className="w-5 h-5 text-primary" />}
          label="Landing"
          onClick={() => onLog("landing")}
        />
        <Btn
          icon={<Battery className="w-5 h-5 text-green-500" />}
          label="Battery"
          onClick={() => setBatteryOpen(true)}
        />
        <Btn
          icon={<Camera className="w-5 h-5 text-blue-500" />}
          label="Photo"
          onClick={() => onLog("photo_taken")}
        />
        <Btn
          icon={<AlertTriangle className="w-5 h-5 text-destructive" />}
          label="Obstacle"
          onClick={() => onLog("obstacle")}
        />
      </div>

      {batteryOpen && (
        <div className="bg-card border border-border rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Battery level</span>
            <span className="text-2xl font-display font-bold tabular-nums text-primary">
              {batteryVal}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={batteryVal}
            onChange={(e) => setBatteryVal(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setBatteryOpen(false)}
              className="flex-1 py-2 rounded-lg border border-border text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onLog("battery_check", { percent: batteryVal });
                setBatteryOpen(false);
              }}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm"
            >
              Log {batteryVal}%
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

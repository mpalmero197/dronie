import { Battery, Compass, Gauge, Clock, MapPin, Video } from "lucide-react";
import type { Drone } from "@/lib/fleet-types";
import DroneStatusBadge from "./DroneStatusBadge";

interface DroneCardProps {
  drone: Drone;
  onSelect?: (drone: Drone) => void;
}

function formatFlightTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function batteryColor(level: number): string {
  if (level > 60) return "text-primary";
  if (level > 25) return "text-amber-500";
  return "text-destructive";
}

export default function DroneCard({ drone, onSelect }: DroneCardProps) {
  return (
    <button
      onClick={() => onSelect?.(drone)}
      className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-lg transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="font-display font-700 text-foreground text-sm truncate">{drone.name}</h3>
          <p className="text-xs text-muted-foreground truncate">{drone.model || "Unknown Model"}</p>
        </div>
        <DroneStatusBadge status={drone.status} />
      </div>

      {/* Telemetry grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Battery className={`w-3.5 h-3.5 ${batteryColor(drone.battery_level)}`} />
          <span className="font-semibold text-foreground">{drone.battery_level}%</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Gauge className="w-3.5 h-3.5" />
          <span>{drone.speed.toFixed(1)} m/s</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" />
          <span>{drone.altitude.toFixed(0)}m alt</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Compass className="w-3.5 h-3.5" />
          <span>{drone.heading.toFixed(0)}°</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatFlightTime(drone.flight_time_minutes)}</span>
        </div>
        {drone.stream_url && (
          <div className="flex items-center gap-1.5 text-primary">
            <Video className="w-3.5 h-3.5" />
            <span className="font-semibold">Live</span>
          </div>
        )}
      </div>

      {drone.serial_number && (
        <p className="mt-2 text-[10px] text-muted-foreground/60 font-mono truncate">
          S/N: {drone.serial_number}
        </p>
      )}
    </button>
  );
}

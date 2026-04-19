import {
  PlaneTakeoff,
  PlaneLanding,
  MapPin,
  Battery,
  Camera,
  AlertTriangle,
  Play,
  Square,
  StickyNote,
  Ban,
} from "lucide-react";
import type { MissionEvent } from "@/lib/pilotMission";

const ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  mission_start: { icon: Play, color: "text-primary", label: "Mission started" },
  mission_end: { icon: Square, color: "text-muted-foreground", label: "Mission ended" },
  takeoff: { icon: PlaneTakeoff, color: "text-primary", label: "Takeoff" },
  landing: { icon: PlaneLanding, color: "text-primary", label: "Landing" },
  waypoint_reached: { icon: MapPin, color: "text-amber-500", label: "Waypoint reached" },
  battery_check: { icon: Battery, color: "text-primary", label: "Battery checked" },
  photo_taken: { icon: Camera, color: "text-accent", label: "Photo captured" },
  obstacle: { icon: AlertTriangle, color: "text-destructive", label: "Obstacle noted" },
  abort: { icon: Ban, color: "text-destructive", label: "Aborted" },
  note: { icon: StickyNote, color: "text-muted-foreground", label: "Note" },
};

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ${min % 60}m ago`;
}

export default function MissionLogList({ events }: { events: MissionEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-muted-foreground">
        No events yet — tap a quick-log button above
      </div>
    );
  }

  return (
    <ol className="space-y-1.5">
      {events.map((e) => {
        const meta = ICONS[e.event_type] ?? ICONS.note;
        const Icon = meta.icon;
        const detail =
          e.event_type === "battery_check" && typeof e.payload?.percent === "number"
            ? ` — ${e.payload.percent}%`
            : "";
        return (
          <li
            key={e.id}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-card border border-border"
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${meta.color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {meta.label}
                {detail}
              </p>
              {e.latitude !== null && e.longitude !== null && (
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {e.latitude.toFixed(5)}, {e.longitude.toFixed(5)}
                </p>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {timeAgo(e.recorded_at)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

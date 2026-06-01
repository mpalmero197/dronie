import { Plane, Clock, Route, Layers, BatteryCharging, Camera } from "lucide-react";

interface Stats {
  waypoints: number;
  distance: number;
  area: number;
  flightTime: number;
  batteries: number;
  gsd: number;
  droneName: string;
}

interface Props {
  stats: Stats | null;
  formatTime: (s: number) => string;
  formatDist: (m: number) => string;
  formatArea: (m: number) => string;
}

/**
 * Floating HUD that overlays live mission estimates on the planner map
 * in step 3. Hidden when there is no polygon yet.
 */
export default function MissionEstimateOverlay({ stats, formatTime, formatDist, formatArea }: Props) {
  if (!stats) return null;
  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-[900] w-[min(640px,calc(100%-1.5rem))]">
      <div className="pointer-events-auto rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-lg px-3 py-2">
        <div className="flex items-center gap-2 mb-1.5">
          <Plane className="w-3.5 h-3.5 text-primary" />
          <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
            Live estimate · {stats.droneName}
          </p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          <HudStat icon={Route} label="Waypoints" value={stats.waypoints.toString()} />
          <HudStat icon={Clock} label="Flight" value={formatTime(stats.flightTime)} />
          <HudStat icon={Route} label="Distance" value={formatDist(stats.distance)} />
          <HudStat icon={Layers} label="Area" value={formatArea(stats.area)} />
          <HudStat icon={Camera} label="GSD" value={`${stats.gsd.toFixed(1)} cm/px`} />
          <HudStat icon={BatteryCharging} label="Batteries" value={stats.batteries.toString()} />
        </div>
      </div>
    </div>
  );
}

function HudStat({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/30 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] uppercase font-semibold text-muted-foreground tracking-wide">
        <Icon className="w-2.5 h-2.5" />
        <span className="truncate">{label}</span>
      </div>
      <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{value}</p>
    </div>
  );
}
import { Wifi, WifiOff, Wrench, Circle } from "lucide-react";
import type { DroneStatus } from "@/lib/fleet-types";

const STATUS_CONFIG: Record<DroneStatus, { label: string; className: string; icon: typeof Circle }> = {
  idle: { label: "Idle", className: "bg-muted text-muted-foreground", icon: Circle },
  active: { label: "Active", className: "bg-primary/15 text-primary border border-primary/30", icon: Wifi },
  maintenance: { label: "Maintenance", className: "bg-amber-500/15 text-amber-600 border border-amber-500/30", icon: Wrench },
  offline: { label: "Offline", className: "bg-destructive/15 text-destructive border border-destructive/30", icon: WifiOff },
};

export default function DroneStatusBadge({ status }: { status: DroneStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${config.className}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

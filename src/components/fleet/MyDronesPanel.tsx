import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Battery, Compass, Gauge, Clock, MapPin, Video, Plane, Wrench,
  ShieldCheck, Activity, Signal, ArrowRight, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Drone, Job, DroneStatus } from "@/lib/fleet-types";
import DroneStatusBadge from "./DroneStatusBadge";

/**
 * MyDronesPanel — read-only live telemetry summary for the signed-in pilot's
 * managed drones. Displays only what RLS already permits (drones where
 * assigned_pilot_id = auth.uid(), plus admin override).
 *
 * SECURITY NOTE: This component intentionally exposes NO command-and-control
 * surface. There are no buttons that send commands to drones in flight — only
 * realtime telemetry display. This prevents the dashboard from becoming an
 * attack surface for drones currently airborne.
 */

function batteryColor(level: number): string {
  if (level > 60) return "text-primary";
  if (level > 25) return "text-amber-500";
  return "text-destructive";
}

function fmtFlightTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function linkQuality(updatedAt: string | null | undefined, status: DroneStatus) {
  if (status === "offline") return { label: "No link", tone: "text-destructive", bars: 0 };
  if (!updatedAt) return { label: "Unknown", tone: "text-muted-foreground", bars: 0 };
  const ageS = (Date.now() - new Date(updatedAt).getTime()) / 1000;
  if (ageS < 15) return { label: "Strong", tone: "text-primary", bars: 3 };
  if (ageS < 60) return { label: "Fair", tone: "text-amber-500", bars: 2 };
  if (ageS < 300) return { label: "Weak", tone: "text-amber-600", bars: 1 };
  return { label: "Stale", tone: "text-muted-foreground", bars: 0 };
}

interface MaintenanceRow {
  id: string;
  drone_id: string;
  task: string;
  due_date: string;
  cycles_left: number;
  health_pct: number;
  status: string;
}

export default function MyDronesPanel() {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // refresh "time ago" labels

  // Re-render time-ago labels every 10s
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10000);
    return () => clearInterval(t);
  }, []);

  async function fetchAll() {
    // RLS handles scoping — no need (and no point) to filter by user_id client-side.
    const [dRes, jRes, mRes] = await Promise.all([
      supabase.from("drones").select("*").order("updated_at", { ascending: false }),
      supabase.from("jobs").select("*").eq("status", "active"),
      supabase.from("drone_maintenance").select("*").neq("status", "done"),
    ]);
    setDrones((dRes.data as Drone[]) || []);
    setActiveJobs((jRes.data as Job[]) || []);
    setMaintenance((mRes.data as MaintenanceRow[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();

    // Live telemetry — RLS still enforced server-side on each event payload.
    const channel = supabase
      .channel("dashboard-drones-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drones" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as Drone;
            setDrones((prev) => prev.filter((d) => d.id !== old.id));
            return;
          }
          const next = payload.new as Drone;
          setDrones((prev) => {
            const exists = prev.some((d) => d.id === next.id);
            return exists
              ? prev.map((d) => (d.id === next.id ? next : d))
              : [next, ...prev];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => {
          // job changes are infrequent; just refetch the small list
          supabase
            .from("jobs")
            .select("*")
            .eq("status", "active")
            .then(({ data }) => setActiveJobs((data as Job[]) || []));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const total = drones.length;
    const flying = drones.filter((d) => d.status === "active").length;
    const offline = drones.filter((d) => d.status === "offline").length;
    const inMaint = drones.filter((d) => d.status === "maintenance").length;
    const lowBattery = drones.filter((d) => d.battery_level <= 25 && d.status === "active").length;
    const totalFlightMin = drones.reduce((s, d) => s + (d.flight_time_minutes || 0), 0);
    return { total, flying, offline, inMaint, lowBattery, totalFlightMin };
  }, [drones]);

  // Reference `tick` so React keeps "ago" labels fresh.
  void tick;

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (drones.length === 0) {
    return (
      <div className="bg-card border border-dashed border-border rounded-2xl p-6 text-center">
        <Plane className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="font-display font-700 text-sm text-foreground">No drones assigned to you yet</p>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          Once a drone is assigned to your account, live telemetry will appear here.
        </p>
        <Link
          to="/fleet"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          Open fleet management <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-700 text-foreground text-sm">My Drones</h2>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
            <Activity className="w-2.5 h-2.5" /> Live
          </span>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground"
            title="This panel is read-only. No flight commands can be sent from the dashboard."
          >
            <ShieldCheck className="w-2.5 h-2.5" /> Read-only
          </span>
        </div>
        <Link
          to="/fleet"
          className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
        >
          Manage fleet <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Fleet stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: "Drones", value: stats.total, tone: "text-primary", bg: "bg-primary/10" },
          { label: "Flying now", value: stats.flying, tone: "text-accent-foreground", bg: "bg-accent/15" },
          { label: "Offline", value: stats.offline, tone: "text-destructive", bg: "bg-destructive/10" },
          { label: "Flight time", value: fmtFlightTime(stats.totalFlightMin), tone: "text-foreground", bg: "bg-secondary" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-3 border border-border ${s.bg}`}>
            <p className={`font-display font-700 text-lg leading-none ${s.tone}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {(stats.lowBattery > 0 || stats.inMaint > 0 || maintenance.length > 0) && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <Wrench className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            {stats.lowBattery > 0 && <strong>{stats.lowBattery} low-battery</strong>}
            {stats.lowBattery > 0 && (stats.inMaint > 0 || maintenance.length > 0) && " · "}
            {stats.inMaint > 0 && <strong>{stats.inMaint} in maintenance</strong>}
            {stats.inMaint > 0 && maintenance.length > 0 && " · "}
            {maintenance.length > 0 && <strong>{maintenance.length} open task{maintenance.length === 1 ? "" : "s"}</strong>}
          </span>
        </div>
      )}

      {/* Drone list with live telemetry */}
      <div className="space-y-2">
        {drones.map((d) => {
          const job = activeJobs.find((j) => j.drone_id === d.id);
          const link = linkQuality(d.updated_at, d.status);
          const droneMaint = maintenance.filter((m) => m.drone_id === d.id);
          const hasGps = d.latitude != null && d.longitude != null;
          return (
            <div
              key={d.id}
              className="bg-card border border-border rounded-xl p-3.5 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-700 text-sm text-foreground truncate">{d.name}</h3>
                    <DroneStatusBadge status={d.status} />
                    {job && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent/15 text-accent-foreground">
                        On mission · {job.mission_type}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {d.model || "Unknown model"}
                    {d.serial_number && <span className="font-mono"> · S/N {d.serial_number}</span>}
                  </p>
                </div>
                <div className={`flex items-center gap-1 text-[11px] font-semibold ${link.tone}`} title={`Last update ${timeAgo(d.updated_at)}`}>
                  <Signal className="w-3.5 h-3.5" />
                  {link.label}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Battery className={`w-3.5 h-3.5 ${batteryColor(d.battery_level)}`} />
                  <div className="flex-1">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          d.battery_level > 60 ? "bg-primary" : d.battery_level > 25 ? "bg-amber-500" : "bg-destructive"
                        }`}
                        style={{ width: `${Math.max(d.battery_level, 2)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-semibold">{d.battery_level}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Gauge className="w-3.5 h-3.5" />
                  <span><strong className="text-foreground font-semibold">{(d.speed ?? 0).toFixed(1)}</strong> m/s</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  <span><strong className="text-foreground font-semibold">{(d.altitude ?? 0).toFixed(0)}</strong> m</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Compass className="w-3.5 h-3.5" />
                  <span><strong className="text-foreground font-semibold">{(d.heading ?? 0).toFixed(0)}°</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{fmtFlightTime(d.flight_time_minutes || 0)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground col-span-1">
                  <Activity className="w-3.5 h-3.5" />
                  <span>{timeAgo(d.updated_at)}</span>
                </div>
                {(d.stream_url || d.stream_mode === "webrtc") && (
                  <div className="flex items-center gap-1.5 text-primary col-span-1">
                    <Video className="w-3.5 h-3.5" />
                    <span className="font-semibold">{d.stream_mode === "webrtc" ? "Broadcast" : "Live feed"}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-muted-foreground col-span-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="truncate font-mono text-[10px]">
                    {hasGps ? `${d.latitude!.toFixed(4)}, ${d.longitude!.toFixed(4)}` : "No GPS fix"}
                  </span>
                </div>
              </div>

              {droneMaint.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-border/60 space-y-1">
                  {droneMaint.slice(0, 2).map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-[11px]">
                      <Wrench className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      <span className="text-foreground font-semibold">{m.task}</span>
                      <span className="text-muted-foreground">due {new Date(m.due_date).toLocaleDateString()}</span>
                      <span className="ml-auto text-muted-foreground">health {m.health_pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1.5">
        <ShieldCheck className="w-3 h-3" />
        Telemetry is read-only and scoped to drones assigned to your account. The dashboard cannot send flight commands.
      </p>
    </section>
  );
}
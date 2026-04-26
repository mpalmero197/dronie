import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Battery, BatteryWarning, Plane, RefreshCw, Wifi, WifiOff,
  Zap, Radio, Satellite, Globe2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Drone } from "@/lib/fleet-types";
import DroneStatusBadge from "@/components/fleet/DroneStatusBadge";

// Project a lat/lng cluster onto a fixed SVG viewport using min/max bounds
function project(
  lat: number,
  lng: number,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  w: number,
  h: number,
  pad = 40,
) {
  const dLat = bounds.maxLat - bounds.minLat || 0.001;
  const dLng = bounds.maxLng - bounds.minLng || 0.001;
  const x = pad + ((lng - bounds.minLng) / dLng) * (w - pad * 2);
  const y = pad + (1 - (lat - bounds.minLat) / dLat) * (h - pad * 2);
  return { x, y };
}

const STATUS_COLORS: Record<string, string> = {
  active: "hsl(152 52% 42%)",
  idle: "hsl(202 75% 50%)",
  maintenance: "hsl(38 95% 52%)",
  offline: "hsl(220 8% 50%)",
};

interface LiveAircraft {
  icao24: string;
  callsign: string;
  origin_country: string;
  latitude: number | null;
  longitude: number | null;
  altitude_m: number | null;
  velocity_ms: number | null;
  heading_deg: number | null;
  on_ground: boolean;
}

export default function SwarmOrchestration() {
  const VIEW_W = 720;
  const VIEW_H = 460;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Live air traffic (OpenSky Network)
  const [liveTraffic, setLiveTraffic] = useState(false);
  const [aircraft, setAircraft] = useState<LiveAircraft[]>([]);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [trafficUpdate, setTrafficUpdate] = useState<Date | null>(null);

  // Initial fetch — admin sees all drones, pilots see assigned (RLS handles it)
  const fetchDrones = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("drones")
      .select("*")
      .order("name");
    if (error) {
      toast({ title: "Failed to load fleet", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setDrones((data ?? []) as Drone[]);
    setLastUpdate(new Date());
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchDrones();
    // Realtime subscription on drones
    const channel = supabase
      .channel("swarm:drones")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drones" },
        (payload) => {
          setLastUpdate(new Date());
          setDrones((cur) => {
            if (payload.eventType === "INSERT") {
              return [...cur, payload.new as Drone];
            }
            if (payload.eventType === "UPDATE") {
              return cur.map((d) => (d.id === (payload.new as Drone).id ? (payload.new as Drone) : d));
            }
            if (payload.eventType === "DELETE") {
              return cur.filter((d) => d.id !== (payload.old as Drone).id);
            }
            return cur;
          });
        },
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Compute lat/lng bounds for plotting
  const located = useMemo(
    () => drones.filter((d) => d.latitude != null && d.longitude != null),
    [drones],
  );

  const bounds = useMemo(() => {
    if (located.length === 0) {
      return { minLat: 37.74, maxLat: 37.79, minLng: -122.45, maxLng: -122.39 };
    }
    const lats = located.map((d) => d.latitude as number);
    const lngs = located.map((d) => d.longitude as number);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    // pad bounds so a single drone isn't pinned to a corner
    const padLat = Math.max(0.05, (maxLat - minLat) * 0.5);
    const padLng = Math.max(0.05, (maxLng - minLng) * 0.5);
    return {
      minLat: minLat - padLat,
      maxLat: maxLat + padLat,
      minLng: minLng - padLng,
      maxLng: maxLng + padLng,
    };
  }, [located]);

  // Poll OpenSky via our edge function whenever live traffic is on
  useEffect(() => {
    if (!liveTraffic) {
      setAircraft([]);
      setTrafficError(null);
      return;
    }
    let cancelled = false;
    const fn = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/live-telemetry`;
    const fetchOnce = async () => {
      try {
        const qs = new URLSearchParams({
          lamin: bounds.minLat.toFixed(4),
          lomin: bounds.minLng.toFixed(4),
          lamax: bounds.maxLat.toFixed(4),
          lomax: bounds.maxLng.toFixed(4),
        });
        const resp = await fetch(`${fn}?${qs}`, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        });
        const json = await resp.json();
        if (cancelled) return;
        if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
        setAircraft(json.aircraft ?? []);
        setTrafficUpdate(new Date());
        setTrafficError(null);
      } catch (e) {
        if (cancelled) return;
        setTrafficError(e instanceof Error ? e.message : "Failed to fetch live traffic");
      }
    };
    fetchOnce();
    const id = setInterval(fetchOnce, 12000);
    return () => { cancelled = true; clearInterval(id); };
  }, [liveTraffic, bounds]);

  const toggleSelect = (id: string) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const launchSwarmJobs = async () => {
    if (!user) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast({ title: "Select at least one drone", variant: "destructive" });
      return;
    }
    const rows = ids.map((drone_id) => ({
      drone_id,
      pilot_id: user.id,
      mission_type: "swarm-survey",
      status: "active" as const,
      notes: `Swarm launch · ${ids.length} aircraft`,
    }));
    const { data, error } = await supabase.from("jobs").insert(rows).select("id");
    if (error) {
      toast({ title: "Failed to launch", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: `Launched ${data?.length ?? ids.length} swarm jobs`,
      description: "Open Active Jobs to coordinate from the pilot side.",
    });
    setSelectedIds(new Set());
  };

  const flying = drones.filter((d) => d.status === "active").length;
  const lowBat = drones.filter((d) => d.battery_level < 25).length;
  const offline = drones.filter((d) => d.status === "offline").length;
  const totalBat = drones.length
    ? Math.round(drones.reduce((s, d) => s + d.battery_level, 0) / drones.length)
    : 0;

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-display font-700 truncate">Swarm Orchestration</h1>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                {realtimeConnected ? (
                  <><Wifi className="w-3 h-3 text-primary" /> Live · {drones.length} aircraft in fleet</>
                ) : (
                  <><WifiOff className="w-3 h-3 text-destructive" /> Realtime offline</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={fetchDrones} disabled={loading} className="gap-1.5">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" onClick={launchSwarmJobs} disabled={selectedIds.size === 0} className="gap-1.5">
              <Zap className="w-4 h-4" /> Launch ({selectedIds.size})
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
        {/* Live map */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Stat icon={<Plane className="w-4 h-4" />} label="Active" value={`${flying}`} accent="text-primary" />
            <Stat icon={<BatteryWarning className="w-4 h-4" />} label="Low battery" value={`${lowBat}`} accent={lowBat > 0 ? "text-destructive" : "text-muted-foreground"} />
            <Stat icon={<WifiOff className="w-4 h-4" />} label="Offline" value={`${offline}`} accent="text-muted-foreground" />
            <Stat icon={<Battery className="w-4 h-4" />} label="Avg battery" value={`${totalBat}%`} accent="text-foreground" />
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Satellite className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm">Live fleet positions</h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : "—"}
              </span>
            </div>
            <div className="bg-secondary relative">
              <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto block">
                <defs>
                  <pattern id="swarm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width={VIEW_W} height={VIEW_H} fill="url(#swarm-grid)" />

                {/* lat/lng frame */}
                <text x={20} y={18} fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="monospace">
                  {bounds.maxLat.toFixed(4)}°N
                </text>
                <text x={20} y={VIEW_H - 8} fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="monospace">
                  {bounds.minLat.toFixed(4)}°N
                </text>
                <text x={VIEW_W - 80} y={VIEW_H - 8} fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="monospace">
                  {bounds.maxLng.toFixed(4)}°E
                </text>

                {/* drones */}
                {located.map((d) => {
                  const { x, y } = project(d.latitude!, d.longitude!, bounds, VIEW_W, VIEW_H);
                  const color = STATUS_COLORS[d.status] ?? STATUS_COLORS.idle;
                  const isSelected = selectedIds.has(d.id);
                  const lowBat = d.battery_level < 25;
                  return (
                    <g key={d.id} transform={`translate(${x} ${y})`} onClick={() => toggleSelect(d.id)} className="cursor-pointer">
                      {isSelected && (
                        <circle r="22" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="3 3" />
                      )}
                      {lowBat && d.status === "active" && (
                        <circle r="14" fill="none" stroke="hsl(var(--destructive))" strokeWidth="1.5">
                          <animate attributeName="r" values="10;18;10" dur="1.4s" repeatCount="indefinite" />
                          <animate attributeName="stroke-opacity" values="0.8;0;0.8" dur="1.4s" repeatCount="indefinite" />
                        </circle>
                      )}
                      <circle r="9" fill={color} stroke="white" strokeWidth="2" />
                      {/* heading indicator */}
                      <line
                        x1="0" y1="0"
                        x2={Math.sin((d.heading * Math.PI) / 180) * 14}
                        y2={-Math.cos((d.heading * Math.PI) / 180) * 14}
                        stroke={color} strokeWidth="2" strokeLinecap="round"
                      />
                      <text y="-14" textAnchor="middle" fontSize="10" fontWeight="700" fill="hsl(var(--foreground))">{d.name}</text>
                      <text y="24" textAnchor="middle" fontSize="9" fill={color} fontWeight="600">{d.battery_level}%</text>
                    </g>
                  );
                })}

                {located.length === 0 && (
                  <text x={VIEW_W / 2} y={VIEW_H / 2} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="13">
                    No drones with GPS coordinates yet
                  </text>
                )}
              </svg>
              <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] text-muted-foreground font-mono pointer-events-none">
                <span>Tap a drone to select for swarm launch</span>
                <span>{selectedIds.size} selected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar fleet roster */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2"><Plane className="w-4 h-4 text-primary" /> Fleet roster</h2>
              <Badge variant="outline" className="text-[10px]">{drones.length}</Badge>
            </div>
            <div className="divide-y divide-border max-h-[520px] overflow-auto">
              {loading && (
                <p className="text-xs text-center text-muted-foreground py-6">Loading fleet…</p>
              )}
              {!loading && drones.length === 0 && (
                <div className="p-5 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">No drones in your fleet yet.</p>
                  <Button size="sm" variant="outline" onClick={() => navigate("/fleet")}>Manage fleet</Button>
                </div>
              )}
              {drones.map((d) => {
                const isSelected = selectedIds.has(d.id);
                const lowBat = d.battery_level < 25;
                return (
                  <button
                    key={d.id}
                    onClick={() => toggleSelect(d.id)}
                    className={`w-full text-left px-4 py-3 grid grid-cols-[auto_1fr_auto] gap-3 items-center transition-colors ${
                      isSelected ? "bg-primary/10" : "hover:bg-secondary"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full ring-2 ring-background flex-shrink-0"
                      style={{ background: STATUS_COLORS[d.status] ?? STATUS_COLORS.idle }}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{d.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {d.model || "—"} · {d.latitude != null ? `${d.latitude.toFixed(4)}, ${d.longitude!.toFixed(4)}` : "no GPS"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <DroneStatusBadge status={d.status} />
                      <span className={`flex items-center gap-1 text-[11px] font-semibold ${lowBat ? "text-destructive" : "text-muted-foreground"}`}>
                        {lowBat ? <BatteryWarning className="w-3 h-3" /> : <Battery className="w-3 h-3" />}
                        {d.battery_level}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/40 p-4 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-primary" /> How swarm launch works
            </p>
            <p>
              Selecting drones and pressing <strong>Launch</strong> creates a real <code>job</code> per aircraft assigned to you as pilot.
              Each pilot then opens the job in <Link to="/jobs" className="text-primary underline">Active Jobs</Link> to fly its segment.
              Telemetry updates from any source (manual, API, or future ground-station bridge) flow back here in realtime.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1.5">{icon} {label}</p>
      <p className={`text-xl font-display font-700 mt-0.5 ${accent}`}>{value}</p>
    </div>
  );
}

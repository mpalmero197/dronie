import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, RefreshCw, Plane, Video, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Drone, DroneStatus } from "@/lib/fleet-types";
import DroneCard from "@/components/fleet/DroneCard";
import CameraFeed from "@/components/fleet/CameraFeed";
import AddDroneDialog from "@/components/fleet/AddDroneDialog";
import DroneStatusBadge from "@/components/fleet/DroneStatusBadge";
import BroadcastButton from "@/components/fleet/BroadcastButton";

export default function FleetManagement() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DroneStatus | "all">("all");
  const [showAddDrone, setShowAddDrone] = useState(false);
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);

  const fetchDrones = useCallback(async () => {
    const { data, error } = await supabase
      .from("drones")
      .select("*")
      .order("name");
    if (!error && data) setDrones(data as unknown as Drone[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchDrones();

    // Realtime subscription for live telemetry
    const channel = supabase
      .channel("drones-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "drones" }, (payload) => {
        if (payload.eventType === "UPDATE") {
          setDrones(prev => prev.map(d => d.id === (payload.new as any).id ? { ...d, ...payload.new } as Drone : d));
        } else if (payload.eventType === "INSERT") {
          setDrones(prev => [...prev, payload.new as unknown as Drone]);
        } else if (payload.eventType === "DELETE") {
          setDrones(prev => prev.filter(d => d.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchDrones]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const filtered = drones.filter(d => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.model.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeDrones = drones.filter(d => d.status === "active");
  const dronesWithCameras = drones.filter(d => d.stream_url || d.stream_mode === "webrtc");

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/dashboard")} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Plane className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-700 text-foreground text-sm">Fleet Management</h1>
              <p className="text-xs text-muted-foreground">{drones.length} drone{drones.length !== 1 ? "s" : ""} · {activeDrones.length} active</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchDrones} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowAddDrone(true)} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Drone
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="fleet" className="space-y-4">
          <TabsList>
            <TabsTrigger value="fleet" className="gap-1.5">
              <Plane className="w-3.5 h-3.5" /> Fleet
            </TabsTrigger>
            <TabsTrigger value="cameras" className="gap-1.5">
              <Video className="w-3.5 h-3.5" /> Camera Feeds
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fleet" className="space-y-4">
            {/* Search & filter */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search drones…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1">
                {(["all", "active", "idle", "maintenance", "offline"] as const).map(s => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(s)}
                    className="text-xs capitalize"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            {/* Drone grid */}
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <Plane className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  {drones.length === 0 ? "No drones registered yet" : "No drones match your filter"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map(drone => (
                  <DroneCard key={drone.id} drone={drone} onSelect={setSelectedDrone} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="cameras" className="space-y-4">
            {dronesWithCameras.length === 0 ? (
              <div className="text-center py-16">
                <Video className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No drones have camera feeds configured</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Add a stream URL to a drone to see its camera here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {dronesWithCameras.map(drone => (
                  <div key={drone.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{drone.name}</h3>
                        <DroneStatusBadge status={drone.status} />
                      </div>
                      <span className="text-xs text-muted-foreground">{drone.battery_level}% battery</span>
                    </div>
                    <CameraFeed drone={drone} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Drone detail side panel */}
        {selectedDrone && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedDrone(null)} />
            <div className="relative w-full max-w-md bg-card border-l border-border shadow-2xl p-6 overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-display font-700 text-foreground text-lg">{selectedDrone.name}</h2>
                  <p className="text-sm text-muted-foreground">{selectedDrone.model}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDrone(null)}>✕</Button>
              </div>

              <DroneStatusBadge status={selectedDrone.status} />

              <div className="mt-4 space-y-3">
                <CameraFeed drone={selectedDrone} />

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Battery</p>
                    <p className="font-bold text-foreground">{selectedDrone.battery_level}%</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Altitude</p>
                    <p className="font-bold text-foreground">{selectedDrone.altitude}m</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Speed</p>
                    <p className="font-bold text-foreground">{selectedDrone.speed.toFixed(1)} m/s</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Heading</p>
                    <p className="font-bold text-foreground">{selectedDrone.heading}°</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Flight Time</p>
                    <p className="font-bold text-foreground">{selectedDrone.flight_time_minutes}m</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Serial</p>
                    <p className="font-bold text-foreground text-xs font-mono truncate">{selectedDrone.serial_number || "—"}</p>
                  </div>
                </div>

                {selectedDrone.latitude && selectedDrone.longitude && (
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs mb-1">Position</p>
                    <p className="font-mono text-xs text-foreground">
                      {selectedDrone.latitude.toFixed(6)}, {selectedDrone.longitude.toFixed(6)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <AddDroneDialog open={showAddDrone} onOpenChange={setShowAddDrone} onAdded={fetchDrones} />
    </div>
  );
}

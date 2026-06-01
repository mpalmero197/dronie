import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plane, MapPin, Calendar, Download, Trash2, Edit3,
  Loader2, Search, Plus, Folder, Filter, AlertCircle, History, CalendarClock, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  haversineDistance, polygonArea, generateLawnmowerPath,
} from "@/lib/flightPathGenerators";
import { generateDJIFlyKMZ } from "@/lib/generateDJIFlyKMZ";
import MissionVersionsDialog from "@/components/plan/MissionVersionsDialog";
import ScheduleMissionDialog from "@/components/plan/ScheduleMissionDialog";

interface SavedPlan {
  id: string;
  name: string;
  project_id: string | null;
  polygon: [number, number][];
  home_position: [number, number] | null;
  params: {
    altitude: number;
    frontOverlap: number;
    sideOverlap: number;
    heading: number;
    speed: number;
    pattern?: string;
    crossHeadingOffset?: number;
    droneModelIdx?: number;
    terrainFollow?: boolean;
    returnToHome?: boolean;
  };
  created_at: string;
  updated_at: string;
}

interface ProjectMeta { id: string; name: string; }

// SVG thumbnail of the polygon, normalized to fit
function PolygonThumb({ polygon, home }: { polygon: [number, number][]; home: [number, number] | null }) {
  const path = useMemo(() => {
    if (polygon.length < 3) return null;
    const lats = polygon.map((p) => p[0]);
    const lngs = polygon.map((p) => p[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const dLat = maxLat - minLat || 1;
    const dLng = maxLng - minLng || 1;
    const pad = 8;
    const W = 120, H = 80;
    const scale = Math.min((W - pad * 2) / dLng, (H - pad * 2) / dLat);
    const offX = (W - dLng * scale) / 2;
    const offY = (H - dLat * scale) / 2;
    const project = (p: [number, number]) => [
      offX + (p[1] - minLng) * scale,
      offY + (maxLat - p[0]) * scale,
    ];
    const pts = polygon.map(project).map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const homePt = home ? project(home) : null;
    return { pts, homePt };
  }, [polygon, home]);

  if (!path) {
    return (
      <div className="w-full aspect-[3/2] rounded-lg bg-secondary/50 flex items-center justify-center">
        <AlertCircle className="w-5 h-5 text-muted-foreground" />
      </div>
    );
  }
  return (
    <svg viewBox="0 0 120 80" className="w-full aspect-[3/2] rounded-lg bg-secondary/40 border border-border">
      <polygon points={path.pts} fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth="1.4" />
      {path.homePt && (
        <circle cx={path.homePt[0]} cy={path.homePt[1]} r="3" fill="#22c55e" stroke="white" strokeWidth="1.2" />
      )}
    </svg>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function SavedMissions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [exporting, setExporting] = useState<string | null>(null);
  const [historyPlan, setHistoryPlan] = useState<SavedPlan | null>(null);
  const [schedulePlan, setSchedulePlan] = useState<SavedPlan | null>(null);

  const reloadPlans = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("saved_flight_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setPlans(((data ?? []) as unknown) as SavedPlan[]);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    (async () => {
      setLoading(true);
      const { data: planData, error } = await supabase
        .from("saved_flight_plans")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) {
        toast({ title: "Failed to load missions", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      setPlans((planData ?? []) as unknown as SavedPlan[]);

      // Fetch project names for the linked plans
      const projectIds = Array.from(new Set((planData ?? []).map((p: any) => p.project_id).filter(Boolean)));
      if (projectIds.length > 0) {
        const { data: projData } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", projectIds as string[]);
        const map: Record<string, string> = {};
        (projData ?? []).forEach((p: ProjectMeta) => { map[p.id] = p.name; });
        setProjects(map);
      }
      setLoading(false);
    })();
  }, [user, authLoading, navigate, toast]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return plans.filter((p) => {
      if (filterProject === "linked" && !p.project_id) return false;
      if (filterProject === "standalone" && p.project_id) return false;
      if (filterProject !== "all" && filterProject !== "linked" && filterProject !== "standalone" && p.project_id !== filterProject) return false;
      if (!s) return true;
      return p.name.toLowerCase().includes(s) ||
        (p.project_id ? (projects[p.project_id] || "").toLowerCase().includes(s) : false);
    });
  }, [plans, search, filterProject, projects]);

  const projectFilterOptions = useMemo(() => {
    const linked = plans.filter((p) => p.project_id).map((p) => p.project_id!);
    const unique = Array.from(new Set(linked));
    return unique.map((id) => ({ id, name: projects[id] || "Unknown project" }));
  }, [plans, projects]);

  const computeStats = useCallback((plan: SavedPlan) => {
    const area = polygonArea(plan.polygon);
    let dist = 0;
    let waypointCount = 0;
    try {
      const path = generateLawnmowerPath(
        plan.polygon, plan.params.altitude, plan.params.frontOverlap, plan.params.sideOverlap, plan.params.heading
      );
      waypointCount = path.length;
      for (let i = 1; i < path.length; i++) dist += haversineDistance(path[i - 1], path[i]);
    } catch { /* ignore */ }
    return { area, dist, waypointCount };
  }, []);

  const reExportKMZ = useCallback(async (plan: SavedPlan) => {
    setExporting(plan.id);
    try {
      const path = generateLawnmowerPath(
        plan.polygon, plan.params.altitude, plan.params.frontOverlap, plan.params.sideOverlap, plan.params.heading
      );
      const blob = await generateDJIFlyKMZ({
        waypoints: path,
        altitude: plan.params.altitude,
        speed: plan.params.speed,
        heading: plan.params.heading,
        name: plan.name,
        homePosition: plan.home_position ?? undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${plan.name.replace(/[^a-z0-9]+/gi, "_")}.kmz`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "KMZ exported", description: `${plan.name} ready for DJI Fly.` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setExporting(null);
    }
  }, [toast]);

  const deletePlan = useCallback(async (plan: SavedPlan) => {
    if (!confirm(`Delete "${plan.name}"? This can't be undone.`)) return;
    const { error } = await supabase.from("saved_flight_plans").delete().eq("id", plan.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    toast({ title: "Mission deleted" });
  }, [toast]);

  const editPlan = useCallback((plan: SavedPlan) => {
    if (plan.project_id) navigate(`/viewer/${plan.project_id}?mode=plan&plan=${plan.id}`);
    else navigate(`/plan?load=${plan.id}`);
  }, [navigate]);

  const duplicatePlan = useCallback(async (plan: SavedPlan) => {
    if (!user) return;
    const { data, error } = await supabase.from("saved_flight_plans").insert({
      user_id: user.id,
      project_id: plan.project_id,
      name: `${plan.name} (copy)`,
      polygon: plan.polygon,
      home_position: plan.home_position,
      params: plan.params,
    }).select().single();
    if (error || !data) {
      toast({ title: "Duplicate failed", description: error?.message, variant: "destructive" });
      return;
    }
    setPlans((prev) => [data as unknown as SavedPlan, ...prev]);
    toast({ title: "Mission duplicated" });
  }, [user, toast]);

  const polygonCenter = useCallback((plan: SavedPlan): [number, number] | null => {
    if (!plan.polygon?.length) return null;
    const lat = plan.polygon.reduce((s, p) => s + p[0], 0) / plan.polygon.length;
    const lng = plan.polygon.reduce((s, p) => s + p[1], 0) / plan.polygon.length;
    return [lat, lng];
  }, []);

  // ---------------- Render ----------------
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Plane className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-700 text-foreground text-base sm:text-lg truncate">Saved Missions</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">All your flight plans, ready to re-fly</p>
            </div>
          </div>
          <Link to="/plan">
            <Button size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">New mission</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search missions or projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="h-10 rounded-md border border-border bg-background px-2 text-sm text-foreground min-w-[140px]"
            >
              <option value="all">All missions</option>
              <option value="linked">Linked to a project</option>
              <option value="standalone">Standalone</option>
              {projectFilterOptions.length > 0 && <option disabled>──────</option>}
              {projectFilterOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Plane className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display font-700 text-foreground text-lg mb-1">No saved missions yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
              Plan your first survey flight in the wizard. Save it here to re-export anytime.
            </p>
            <Link to="/plan">
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Plan a flight
              </Button>
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No missions match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((plan) => {
              const stats = computeStats(plan);
              const projectName = plan.project_id ? projects[plan.project_id] : null;
              return (
                <article
                  key={plan.id}
                  className="rounded-2xl border border-border bg-card overflow-hidden hover:shadow-md hover:border-primary/40 transition-all group"
                >
                  <div className="p-3 pb-2">
                    <PolygonThumb polygon={plan.polygon} home={plan.home_position} />
                  </div>
                  <div className="px-4 pb-4 space-y-3">
                    {/* Title row */}
                    <div className="space-y-1">
                      <h3 className="font-display font-700 text-foreground text-sm leading-snug line-clamp-1" title={plan.name}>
                        {plan.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>Updated {timeAgo(plan.updated_at)}</span>
                      </div>
                    </div>

                    {/* Project chip */}
                    {projectName ? (
                      <Link
                        to={`/project/${plan.project_id}`}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/15 max-w-full"
                      >
                        <Folder className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{projectName}</span>
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary text-muted-foreground text-[11px] font-semibold">
                        <MapPin className="w-3 h-3" /> Standalone
                      </span>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <Stat label="Alt" value={`${plan.params.altitude}m`} />
                      <Stat label="Area" value={stats.area < 10000 ? `${stats.area.toFixed(0)}m²` : `${(stats.area / 10000).toFixed(1)}ha`} />
                      <Stat label="WPs" value={stats.waypointCount.toString()} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => reExportKMZ(plan)}
                        disabled={exporting === plan.id}
                        className="flex-1 gap-1.5 h-8"
                      >
                        {exporting === plan.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        KMZ
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => editPlan(plan)}
                        className="h-8 px-2.5"
                        title="Edit in planner"
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => setSchedulePlan(plan)}
                        className="h-8 px-2.5"
                        title="Schedule with weather check"
                      >
                        <CalendarClock className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => duplicatePlan(plan)}
                        className="h-8 px-2.5"
                        title="Duplicate mission"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => setHistoryPlan(plan)}
                        className="h-8 px-2.5"
                        title="Version history"
                      >
                        <History className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => deletePlan(plan)}
                        className="h-8 px-2.5 hover:border-destructive hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <MissionVersionsDialog
        open={!!historyPlan}
        onOpenChange={(o) => !o && setHistoryPlan(null)}
        planId={historyPlan?.id ?? null}
        planName={historyPlan?.name ?? ""}
        onRestored={reloadPlans}
      />

      <ScheduleMissionDialog
        open={!!schedulePlan}
        onOpenChange={(o) => !o && setSchedulePlan(null)}
        planId={schedulePlan?.id ?? null}
        planName={schedulePlan?.name ?? ""}
        centerLat={schedulePlan ? polygonCenter(schedulePlan)?.[0] : null}
        centerLng={schedulePlan ? polygonCenter(schedulePlan)?.[1] : null}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 px-1.5 py-1">
      <p className="text-[8px] uppercase font-semibold text-muted-foreground tracking-wide">{label}</p>
      <p className="text-[11px] font-semibold text-foreground mt-0.5 truncate">{value}</p>
    </div>
  );
}

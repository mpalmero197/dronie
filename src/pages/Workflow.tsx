import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Plane, MapPin, Cpu, Mountain, Upload, Plus, Trash2,
  CheckCircle2, Loader2, Image as ImageIcon, Activity, ArrowLeft, Eye, FolderOpen,
  Pause, Play, Circle, Layers, Box, Ruler,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import exifr from "exifr";

const CAMERAS = {
  "mavic-3e": { label: "DJI Mavic 3E (4/3 CMOS)", sensorW: 17.3, focal: 12.29, imgW: 5280 },
  "mavic-3m": { label: "DJI Mavic 3 Multispectral", sensorW: 17.3, focal: 12.29, imgW: 5280 },
  "phantom-4-rtk": { label: "DJI Phantom 4 RTK", sensorW: 13.2, focal: 8.8, imgW: 5472 },
  "mini-4-pro": { label: "DJI Mini 4 Pro", sensorW: 9.6, focal: 6.7, imgW: 8064 },
  "air-2s": { label: "DJI Air 2S", sensorW: 13.2, focal: 8.4, imgW: 5472 },
} as const;
type CameraKey = keyof typeof CAMERAS;

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-semibold", highlight && "text-primary text-base")}>{value}</span>
    </div>
  );
}

function FlightGridSVG({ lines, heading }: { lines: number; heading: number }) {
  const w = 320, h = 220, pad = 16;
  const innerW = w - pad * 2, innerH = h - pad * 2;
  const step = innerH / Math.max(lines - 1, 1);
  const path: string[] = [];
  for (let i = 0; i < lines; i++) {
    const y = pad + i * step;
    if (i % 2 === 0) {
      path.push(`${i === 0 ? "M" : "L"} ${pad} ${y}`);
      path.push(`L ${pad + innerW} ${y}`);
    } else {
      path.push(`L ${pad + innerW} ${y}`);
      path.push(`L ${pad} ${y}`);
    }
  }
  const waypoints: { x: number; y: number }[] = [];
  for (let i = 0; i < lines; i++) {
    const y = pad + i * step;
    waypoints.push({ x: i % 2 === 0 ? pad : pad + innerW, y });
    waypoints.push({ x: i % 2 === 0 ? pad + innerW : pad, y });
  }
  return (
    <div
      className="rounded-lg border border-border bg-gradient-to-br from-secondary/40 to-muted/40 p-1"
      style={{ transform: `rotate(${heading}deg)`, transition: "transform 0.3s" }}
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <rect x={pad} y={pad} width={innerW} height={innerH} fill="none" stroke="hsl(var(--primary) / 0.3)" strokeDasharray="4 3" />
        <path d={path.join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} />
        {waypoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="hsl(var(--accent))" />
        ))}
      </svg>
    </div>
  );
}

function StageFlightPlanning() {
  const [camera, setCamera] = useState<CameraKey>("mavic-3e");
  const [altitude, setAltitude] = useState(80);
  const [speed, setSpeed] = useState(8);
  const [frontOverlap, setFrontOverlap] = useState(80);
  const [sideOverlap, setSideOverlap] = useState(70);
  const [heading, setHeading] = useState(0);
  const [areaHa, setAreaHa] = useState(5);
  const cam = CAMERAS[camera];
  const gsd = useMemo(() => (cam.sensorW * altitude * 100) / (cam.focal * cam.imgW), [cam, altitude]);
  const footprintW = useMemo(() => (gsd * cam.imgW) / 100, [gsd, cam.imgW]);
  const footprintH = useMemo(() => footprintW * 0.66, [footprintW]);
  const lineSpacing = useMemo(() => footprintW * (1 - sideOverlap / 100), [footprintW, sideOverlap]);
  const triggerInterval = useMemo(() => (footprintH * (1 - frontOverlap / 100)) / Math.max(speed, 0.1), [footprintH, frontOverlap, speed]);
  const sideM = useMemo(() => Math.sqrt(areaHa * 10_000), [areaHa]);
  const lines = useMemo(() => Math.max(2, Math.ceil(sideM / Math.max(lineSpacing, 1))), [sideM, lineSpacing]);
  const totalDist = useMemo(() => lines * sideM, [lines, sideM]);
  const flightTimeMin = useMemo(() => totalDist / Math.max(speed, 0.1) / 60, [totalDist, speed]);
  const photos = useMemo(() => Math.ceil(totalDist / Math.max(footprintH * (1 - frontOverlap / 100), 0.1)), [totalDist, footprintH, frontOverlap]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Plane className="h-5 w-5 text-primary" />Mission Configuration</CardTitle>
          <CardDescription>Camera, altitude, overlap and trigger interval</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Camera / Drone</Label>
              <Select value={camera} onValueChange={(v) => setCamera(v as CameraKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CAMERAS).map(([k, v]) => (<SelectItem key={k} value={k}>{v.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Heading (°)</Label>
              <Input type="number" min={0} max={359} value={heading} onChange={(e) => setHeading(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><Label>Altitude AGL</Label><span className="font-mono text-muted-foreground">{altitude} m</span></div>
            <Slider value={[altitude]} min={20} max={400} step={5} onValueChange={(v) => setAltitude(v[0])} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><Label>Flight Speed</Label><span className="font-mono text-muted-foreground">{speed} m/s</span></div>
            <Slider value={[speed]} min={1} max={20} step={0.5} onValueChange={(v) => setSpeed(v[0])} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><Label>Frontal Overlap</Label><span className="font-mono text-muted-foreground">{frontOverlap}%</span></div>
              <Slider value={[frontOverlap]} min={60} max={95} step={1} onValueChange={(v) => setFrontOverlap(v[0])} />
              <p className="text-xs text-muted-foreground">Recommended 75–85%</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><Label>Side Overlap</Label><span className="font-mono text-muted-foreground">{sideOverlap}%</span></div>
              <Slider value={[sideOverlap]} min={50} max={90} step={1} onValueChange={(v) => setSideOverlap(v[0])} />
              <p className="text-xs text-muted-foreground">Recommended 65–75%</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><Label>Survey Area</Label><span className="font-mono text-muted-foreground">{areaHa} ha</span></div>
            <Slider value={[areaHa]} min={0.5} max={100} step={0.5} onValueChange={(v) => setAreaHa(v[0])} />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader className="pb-3"><CardTitle className="text-base">Live Calculations</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Stat label="Ground Sample Distance" value={`${gsd.toFixed(2)} cm/px`} highlight />
            <Stat label="Trigger Interval" value={`${triggerInterval.toFixed(2)} s`} />
            <Stat label="Footprint" value={`${footprintW.toFixed(0)} × ${footprintH.toFixed(0)} m`} />
            <Stat label="Line Spacing" value={`${lineSpacing.toFixed(1)} m`} />
            <div className="my-2 border-t border-border" />
            <Stat label="Flight Lines" value={`${lines}`} />
            <Stat label="Total Distance" value={`${(totalDist / 1000).toFixed(2)} km`} />
            <Stat label="Flight Time" value={`${flightTimeMin.toFixed(1)} min`} />
            <Stat label="Photos" value={`~${photos}`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Flight Grid Preview</CardTitle></CardHeader>
          <CardContent>
            <FlightGridSVG lines={Math.min(lines, 20)} heading={heading} />
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-primary" /> Path</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-accent" /> Waypoint</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface GCP { id: string; name: string; latitude: number; longitude: number; elevation: number | null; }
interface CapturedImage { id: string; name: string; size: number; lat: number | null; lng: number | null; alt: number | null; }
interface ProjectOpt { id: string; name: string; status: string; progress: number; }

function StageGroundControl() {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [gcps, setGcps] = useState<GCP[]>([]);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [draft, setDraft] = useState({ name: "", lat: "", lng: "", elev: "" });
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("projects").select("id, name, status, progress").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as ProjectOpt[];
        setProjects(rows);
        if (rows[0]) setProjectId(rows[0].id);
      });
  }, [user]);

  useEffect(() => {
    if (!projectId) return;
    supabase.from("ground_control_points").select("id, name, latitude, longitude, elevation").eq("project_id", projectId)
      .then(({ data }) => setGcps((data ?? []) as GCP[]));
  }, [projectId]);

  const addGcp = async () => {
    if (!user || !projectId) {
      toast({ title: "Select a project first", variant: "destructive" });
      return;
    }
    if (!draft.name || !draft.lat || !draft.lng) {
      toast({ title: "Missing fields", description: "Name, lat and lng are required", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.from("ground_control_points").insert({
      user_id: user.id, project_id: projectId, name: draft.name,
      latitude: Number(draft.lat), longitude: Number(draft.lng),
      elevation: draft.elev ? Number(draft.elev) : null,
    }).select("id, name, latitude, longitude, elevation").single();
    if (error) { toast({ title: "Failed to save", description: error.message, variant: "destructive" }); return; }
    setGcps((p) => [...p, data as GCP]);
    setDraft({ name: "", lat: "", lng: "", elev: "" });
  };

  const removeGcp = async (id: string) => {
    await supabase.from("ground_control_points").delete().eq("id", id);
    setGcps((p) => p.filter((g) => g.id !== id));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setParsing(true);
    try {
      const next: CapturedImage[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        let lat: number | null = null, lng: number | null = null, alt: number | null = null;
        try {
          const meta = await exifr.parse(f, { gps: true });
          if (meta) {
            lat = (meta.latitude as number) ?? null;
            lng = (meta.longitude as number) ?? null;
            alt = (meta.GPSAltitude as number) ?? null;
          }
        } catch { /* no EXIF — leave nulls */ }
        next.push({ id: `${Date.now()}-${i}`, name: f.name, size: f.size, lat, lng, alt });
      }
      setImages((prev) => [...prev, ...next]);
      const withGps = next.filter((i) => i.lat != null).length;
      toast({ title: "EXIF parsed", description: `${withGps}/${next.length} image(s) had GPS metadata` });
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5 text-primary" />Ground Control Points</CardTitle>
          <CardDescription>GNSS rover coordinates (WGS84) saved per project</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue placeholder={projects.length ? "Select project" : "No projects yet"} /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Input placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Input placeholder="Lat" inputMode="decimal" value={draft.lat} onChange={(e) => setDraft({ ...draft, lat: e.target.value })} />
            <Input placeholder="Lng" inputMode="decimal" value={draft.lng} onChange={(e) => setDraft({ ...draft, lng: e.target.value })} />
            <Input placeholder="Elev" inputMode="decimal" value={draft.elev} onChange={(e) => setDraft({ ...draft, elev: e.target.value })} />
            <Button onClick={addGcp} size="sm" className="w-full"><Plus className="mr-1 h-4 w-4" />Add</Button>
          </div>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Lat</TableHead><TableHead>Lng</TableHead>
                <TableHead>Elev</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {gcps.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="font-mono text-xs">{g.latitude.toFixed(5)}</TableCell>
                    <TableCell className="font-mono text-xs">{g.longitude.toFixed(5)}</TableCell>
                    <TableCell className="font-mono text-xs">{g.elevation?.toFixed(2) ?? "—"}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => removeGcp(g.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {gcps.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No GCPs yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><ImageIcon className="h-5 w-5 text-primary" />Image EXIF Inspector</CardTitle>
          <CardDescription>Read GPS / altitude tags from JPEG / TIFF files (in-browser)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:border-primary hover:bg-primary/5"
          >
            {parsing ? <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" /> : <Upload className="mb-2 h-8 w-8 text-muted-foreground" />}
            <p className="text-sm font-medium">{parsing ? "Reading EXIF…" : "Drop images or click to browse"}</p>
            <p className="text-xs text-muted-foreground">JPEG / TIFF — GPS, altitude</p>
            <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Inspected</span>
            <span className="font-mono font-semibold">{images.length} images</span>
          </div>
          {images.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>File</TableHead><TableHead>Lat / Lng</TableHead><TableHead>Alt</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {images.slice(-25).reverse().map((img) => (
                    <TableRow key={img.id}>
                      <TableCell className="max-w-[120px] truncate text-xs">{img.name}</TableCell>
                      <TableCell className="font-mono text-[10px]">{img.lat != null && img.lng != null ? `${img.lat.toFixed(4)}, ${img.lng.toFixed(4)}` : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{img.alt != null ? `${img.alt.toFixed(1)}m` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StageProcessing() {
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectOpt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      const { data } = await supabase.from("projects")
        .select("id, name, status, progress")
        .eq("user_id", user.id)
        .in("status", ["queued", "processing"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (cancelled) return;
      setProject((data as ProjectOpt) ?? null);
      setLoading(false);
    }
    load();
    const channel = supabase.channel("workflow:processing")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "projects" }, (payload) => {
        const next = payload.new as ProjectOpt;
        setProject((cur) => cur && cur.id === next.id ? next : cur);
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user]);

  if (loading) return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Loading…</CardContent></Card>;
  if (!project) return (
    <Card>
      <CardContent className="py-12 text-center">
        <Cpu className="w-8 h-8 text-muted-foreground/60 mx-auto mb-3" />
        <p className="font-display font-700">No project currently processing</p>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto">Upload imagery from the Dashboard to start a real photogrammetry pipeline.</p>
        <Link to="/dashboard"><Button size="sm" className="mt-4 gap-2"><FolderOpen className="w-4 h-4" /> Open Dashboard</Button></Link>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Cpu className="h-5 w-5 text-primary" />Reconstruction Pipeline · {project.name}</CardTitle>
        <CardDescription>Live progress from the processing backend</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-gradient-to-r from-primary/5 to-accent/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Overall · {project.status}</span>
            <span className="font-mono text-2xl font-bold text-primary">{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-3" />
        </div>
        <Link to={`/project/${project.id}`}><Button size="sm" variant="outline" className="gap-2"><Eye className="w-4 h-4" />View project details</Button></Link>
      </CardContent>
    </Card>
  );
}

function StageGeospatial() {
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectOpt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("projects").select("id, name, status, progress").eq("user_id", user.id).eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { setProject((data as ProjectOpt) ?? null); setLoading(false); });
  }, [user]);

  if (loading) return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Loading…</CardContent></Card>;
  if (!project) return (
    <Card>
      <CardContent className="py-12 text-center">
        <Mountain className="w-8 h-8 text-muted-foreground/60 mx-auto mb-3" />
        <p className="font-display font-700">No completed projects yet</p>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto">Geospatial outputs (orthomosaics, DEMs, contours) appear here once a project finishes processing.</p>
        <Link to="/dashboard"><Button size="sm" className="mt-4 gap-2"><FolderOpen className="w-4 h-4" /> Open Dashboard</Button></Link>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Mountain className="h-5 w-5 text-primary" />Geospatial Outputs · {project.name}</CardTitle>
        <CardDescription>Inspect orthomosaic, DEM and 3D outputs in the dedicated viewers</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Link to={`/viewer/${project.id}`}><Button size="sm" className="gap-2"><Eye className="w-4 h-4" />Open Map Viewer</Button></Link>
        <Link to="/reality"><Button size="sm" variant="outline" className="gap-2"><Mountain className="w-4 h-4" />3D Reality Capture</Button></Link>
        <Link to="/insights"><Button size="sm" variant="outline" className="gap-2"><Activity className="w-4 h-4" />AI Insights</Button></Link>
      </CardContent>
    </Card>
  );
}

const STAGES = [
  { id: "plan", icon: Plane, label: "Flight Planning", short: "Plan" },
  { id: "ground", icon: MapPin, label: "Ground Control", short: "Capture" },
  { id: "process", icon: Cpu, label: "Processing", short: "Process" },
  { id: "analyze", icon: Mountain, label: "Geospatial", short: "Analyze" },
] as const;

export default function Workflow() {
  const [stage, setStage] = useState<(typeof STAGES)[number]["id"]>("plan");
  const stageIdx = STAGES.findIndex((s) => s.id === stage);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" />Dashboard</Link>
            </Button>
            <div className="hidden h-6 border-l border-border sm:block" />
            <div className="hidden sm:block">
              <h1 className="text-base font-semibold leading-tight">Photogrammetry Workflow</h1>
              <p className="text-xs text-muted-foreground">End-to-end mission lifecycle</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1">
            <Activity className="h-3 w-3" />Stage {stageIdx + 1} / {STAGES.length}
          </Badge>
        </div>
        <div className="mx-auto max-w-7xl px-2 pb-3 sm:px-4">
          <div className="flex items-center gap-1 overflow-x-auto sm:gap-2">
            {STAGES.map((s, i) => {
              const Icon = s.icon;
              const active = s.id === stage;
              const completed = i < stageIdx;
              return (
                <button
                  key={s.id}
                  onClick={() => setStage(s.id)}
                  className={cn(
                    "flex flex-shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all sm:px-4 sm:text-sm",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : completed
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-mono", active ? "bg-primary-foreground/20" : "bg-muted")}>
                    {completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.short}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {stage === "plan" && <StageFlightPlanning />}
        {stage === "ground" && <StageGroundControl />}
        {stage === "process" && <StageProcessing />}
        {stage === "analyze" && <StageGeospatial />}

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <Button variant="outline" disabled={stageIdx === 0} onClick={() => setStage(STAGES[Math.max(0, stageIdx - 1)].id)}>Previous stage</Button>
          <span className="text-xs text-muted-foreground">{STAGES[stageIdx].label}</span>
          <Button disabled={stageIdx === STAGES.length - 1} onClick={() => setStage(STAGES[Math.min(STAGES.length - 1, stageIdx + 1)].id)}>Next stage</Button>
        </div>
      </main>
    </div>
  );
}

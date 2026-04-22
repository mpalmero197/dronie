import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Plane, MapPin, Cpu, Mountain, Upload, Plus, Trash2, Play, Pause,
  CheckCircle2, Circle, Loader2, Image as ImageIcon, Layers, Ruler,
  Box, Activity, ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

interface GCP { id: string; name: string; lat: number; lng: number; elev: number; marked: boolean; }
interface CapturedImage { id: string; name: string; size: number; lat: number; lng: number; alt: number; pitch: number; roll: number; yaw: number; }

function StageGroundControl() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [gcps, setGcps] = useState<GCP[]>([
    { id: "g1", name: "GCP-01", lat: 45.5231, lng: -122.6765, elev: 42.18, marked: true },
    { id: "g2", name: "GCP-02", lat: 45.5238, lng: -122.6749, elev: 41.92, marked: true },
    { id: "g3", name: "GCP-03", lat: 45.5224, lng: -122.6741, elev: 43.05, marked: false },
  ]);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [draft, setDraft] = useState({ name: "", lat: "", lng: "", elev: "" });

  const addGcp = () => {
    if (!draft.name || !draft.lat || !draft.lng) {
      toast({ title: "Missing fields", description: "Name, lat and lng are required", variant: "destructive" });
      return;
    }
    setGcps((prev) => [...prev, {
      id: `g${Date.now()}`, name: draft.name,
      lat: Number(draft.lat), lng: Number(draft.lng),
      elev: Number(draft.elev) || 0, marked: false,
    }]);
    setDraft({ name: "", lat: "", lng: "", elev: "" });
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const next: CapturedImage[] = Array.from(files).map((f, i) => ({
      id: `${Date.now()}-${i}`, name: f.name, size: f.size,
      lat: 45.5231 + (Math.random() - 0.5) * 0.005,
      lng: -122.6765 + (Math.random() - 0.5) * 0.005,
      alt: 78 + Math.random() * 8,
      pitch: -90 + (Math.random() - 0.5) * 4,
      roll: (Math.random() - 0.5) * 2,
      yaw: Math.random() * 360,
    }));
    setImages((prev) => [...prev, ...next]);
    toast({ title: "EXIF extracted", description: `Read metadata from ${next.length} image(s)` });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5 text-primary" />Ground Control Points</CardTitle>
          <CardDescription>GNSS rover coordinates (WGS84)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <TableHead>Elev</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {gcps.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="font-mono text-xs">{g.lat.toFixed(5)}</TableCell>
                    <TableCell className="font-mono text-xs">{g.lng.toFixed(5)}</TableCell>
                    <TableCell className="font-mono text-xs">{g.elev.toFixed(2)}</TableCell>
                    <TableCell>
                      {g.marked ? (
                        <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Marked</Badge>
                      ) : (<Badge variant="outline">Pending</Badge>)}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => setGcps((p) => p.filter((x) => x.id !== g.id))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {gcps.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No GCPs yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><ImageIcon className="h-5 w-5 text-primary" />Image Capture</CardTitle>
          <CardDescription>EXIF / XMP metadata extraction</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:border-primary hover:bg-primary/5"
          >
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop images or click to browse</p>
            <p className="text-xs text-muted-foreground">JPEG / TIFF — GPS, altitude, gimbal extracted</p>
            <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Captured</span>
            <span className="font-mono font-semibold">{images.length} images</span>
          </div>
          {images.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>File</TableHead><TableHead>Lat / Lng</TableHead>
                  <TableHead>Alt</TableHead><TableHead>Pitch / Roll</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {images.slice(-25).reverse().map((img) => (
                    <TableRow key={img.id}>
                      <TableCell className="max-w-[120px] truncate text-xs">{img.name}</TableCell>
                      <TableCell className="font-mono text-[10px]">{img.lat.toFixed(4)}, {img.lng.toFixed(4)}</TableCell>
                      <TableCell className="font-mono text-xs">{img.alt.toFixed(1)}m</TableCell>
                      <TableCell className="font-mono text-[10px]">{img.pitch.toFixed(1)}° / {img.roll.toFixed(1)}°</TableCell>
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

interface PStage { id: string; name: string; description: string; weight: number; }
const PIPELINE: PStage[] = [
  { id: "feat", name: "Feature Extraction & Matching", description: "SIFT/AKAZE keypoints across image pairs", weight: 1.5 },
  { id: "sfm", name: "Structure from Motion (SfM)", description: "Sparse point cloud + camera poses", weight: 2 },
  { id: "mvs", name: "Multi-View Stereo (MVS)", description: "Dense point cloud reconstruction", weight: 3 },
  { id: "mesh", name: "Meshing & Texturing", description: "Triangulation + UV-mapped textures", weight: 2 },
  { id: "ortho", name: "Orthorectification", description: "DEM-based projection to orthomosaic", weight: 1.5 },
];

function StageProcessing() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>(Object.fromEntries(PIPELINE.map((s) => [s.id, 0])));
  const totalWeight = PIPELINE.reduce((s, x) => s + x.weight, 0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setProgress((prev) => {
        const next = { ...prev };
        const idx = PIPELINE.findIndex((s) => next[s.id] < 100);
        if (idx === -1) { setRunning(false); return prev; }
        const stage = PIPELINE[idx];
        next[stage.id] = Math.min(100, next[stage.id] + 100 / (stage.weight * 20));
        return next;
      });
    }, 150);
    return () => clearInterval(t);
  }, [running]);

  const overall = useMemo(() => {
    let acc = 0;
    PIPELINE.forEach((s) => (acc += (progress[s.id] / 100) * s.weight));
    return Math.round((acc / totalWeight) * 100);
  }, [progress, totalWeight]);

  const reset = () => setProgress(Object.fromEntries(PIPELINE.map((s) => [s.id, 0])));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><Cpu className="h-5 w-5 text-primary" />Reconstruction Pipeline</CardTitle>
            <CardDescription>2D imagery → 3D point cloud → mesh → orthomosaic</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={reset} disabled={running}>Reset</Button>
            <Button size="sm" onClick={() => setRunning((v) => !v)}>
              {running ? (<><Pause className="mr-1 h-4 w-4" />Pause</>) : (<><Play className="mr-1 h-4 w-4" />Start</>)}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border bg-gradient-to-r from-primary/5 to-accent/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="font-mono text-2xl font-bold text-primary">{overall}%</span>
          </div>
          <Progress value={overall} className="h-3" />
        </div>
        <div className="space-y-3">
          {PIPELINE.map((s, i) => {
            const p = progress[s.id];
            const status: "done" | "active" | "queued" = p >= 100 ? "done" : p > 0 ? "active" : "queued";
            return (
              <div key={s.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {status === "done" && <CheckCircle2 className="h-5 w-5 text-primary" />}
                      {status === "active" && <Loader2 className="h-5 w-5 animate-spin text-accent" />}
                      {status === "queued" && <Circle className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                        <span className="font-medium">{s.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">{Math.round(p)}%</span>
                </div>
                <Progress value={p} className="h-1.5" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function GeoCanvas({ layer, contours, classify, contourInterval }: { layer: "ortho" | "dem" | "dtm"; contours: boolean; classify: boolean; contourInterval: number; }) {
  const lines: { d: string; opacity: number }[] = [];
  const count = Math.max(4, Math.round(20 / contourInterval));
  for (let i = 0; i < count; i++) {
    const r = 30 + i * (160 / count);
    lines.push({
      d: `M ${200 + r} 180 Q ${200} ${180 - r * 0.6}, ${200 - r} 180 Q ${200} ${180 + r * 0.4}, ${200 + r} 180 Z`,
      opacity: 0.15 + (i / count) * 0.5,
    });
  }
  const fill = layer === "ortho" ? "url(#orthoGrad)" : layer === "dem" ? "url(#demGrad)" : "url(#dtmGrad)";
  return (
    <div className="aspect-[16/10] overflow-hidden rounded-lg border border-border bg-muted/20">
      <svg viewBox="0 0 400 250" className="h-full w-full">
        <defs>
          <linearGradient id="orthoGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="hsl(85 35% 45%)" />
            <stop offset="0.5" stopColor="hsl(70 40% 55%)" />
            <stop offset="1" stopColor="hsl(35 30% 60%)" />
          </linearGradient>
          <linearGradient id="demGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="hsl(220 70% 30%)" />
            <stop offset="0.5" stopColor="hsl(150 60% 45%)" />
            <stop offset="1" stopColor="hsl(20 80% 55%)" />
          </linearGradient>
          <linearGradient id="dtmGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="hsl(30 40% 35%)" />
            <stop offset="0.5" stopColor="hsl(35 50% 55%)" />
            <stop offset="1" stopColor="hsl(40 60% 75%)" />
          </linearGradient>
        </defs>
        <rect width="400" height="250" fill={fill} />
        {classify && (
          <>
            <circle cx="100" cy="80" r="35" fill="hsl(120 50% 35% / 0.5)" />
            <circle cx="280" cy="60" r="28" fill="hsl(120 50% 35% / 0.5)" />
            <rect x="220" y="160" width="60" height="40" fill="hsl(0 0% 30% / 0.6)" />
            <rect x="60" y="180" width="40" height="30" fill="hsl(0 0% 30% / 0.6)" />
          </>
        )}
        {contours && lines.map((l, i) => (
          <path key={i} d={l.d} fill="none" stroke="hsl(var(--foreground))" strokeWidth={0.6} opacity={l.opacity} />
        ))}
        <g>
          {[[80, 60], [320, 100], [180, 200]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4} fill="hsl(var(--accent))" stroke="white" strokeWidth={1} />
          ))}
        </g>
      </svg>
    </div>
  );
}

function CrossSectionSVG() {
  const w = 280, h = 80;
  const points: string[] = [];
  for (let x = 0; x <= w; x += 4) {
    const y = 60 - Math.sin(x / 18) * 18 - Math.sin(x / 7) * 4;
    points.push(`${x},${y}`);
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <defs>
        <linearGradient id="terrainFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--primary) / 0.4)" />
          <stop offset="1" stopColor="hsl(var(--primary) / 0.05)" />
        </linearGradient>
      </defs>
      <polyline points={`0,${h} ${points.join(" ")} ${w},${h}`} fill="url(#terrainFill)" stroke="hsl(var(--primary))" strokeWidth={1.2} />
    </svg>
  );
}

function StageGeospatial() {
  const [layer, setLayer] = useState<"ortho" | "dem" | "dtm">("ortho");
  const [contours, setContours] = useState(true);
  const [classify, setClassify] = useState(false);
  const [contourInterval, setContourInterval] = useState(1);
  const [cutFill, setCutFill] = useState(0.5);
  const cutVolume = (cutFill * 12_438).toFixed(0);
  const fillVolume = ((1 - cutFill) * 8_921).toFixed(0);
  const net = (Number(cutVolume) - Number(fillVolume)).toFixed(0);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><Mountain className="h-5 w-5 text-primary" />Geospatial Viewer</CardTitle>
              <CardDescription>Orthomosaic, DEM and bare-earth DTM</CardDescription>
            </div>
            <Tabs value={layer} onValueChange={(v) => setLayer(v as typeof layer)}>
              <TabsList>
                <TabsTrigger value="ortho">Ortho</TabsTrigger>
                <TabsTrigger value="dem">DEM</TabsTrigger>
                <TabsTrigger value="dtm">DTM</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <GeoCanvas layer={layer} contours={contours} classify={classify} contourInterval={contourInterval} />
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Pixel: 2.4 cm/px</span><span>·</span>
            <span>Coverage: 5.2 ha</span><span>·</span>
            <span>Mesh: 1.8M triangles</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" />Analysis Layers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div><Label className="text-sm">Contour Lines</Label><p className="text-xs text-muted-foreground">Iso-elevation curves</p></div>
              <Switch checked={contours} onCheckedChange={setContours} />
            </div>
            {contours && (
              <div className="space-y-2 pl-2">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Interval</span><span className="font-mono">{contourInterval} m</span></div>
                <Slider value={[contourInterval]} min={0.5} max={10} step={0.5} onValueChange={(v) => setContourInterval(v[0])} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div><Label className="text-sm">Point Cloud Classification</Label><p className="text-xs text-muted-foreground">Ground / vegetation / built</p></div>
              <Switch checked={classify} onCheckedChange={setClassify} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Box className="h-4 w-4" />Volumetrics</CardTitle>
            <CardDescription>Earthwork cut & fill estimate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Cut / Fill ratio</span><span className="font-mono">{Math.round(cutFill * 100)} / {Math.round((1 - cutFill) * 100)}</span></div>
              <Slider value={[cutFill]} min={0} max={1} step={0.05} onValueChange={(v) => setCutFill(v[0])} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-destructive/10 p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Cut</div>
                <div className="font-mono text-sm font-bold text-destructive">{cutVolume} m³</div>
              </div>
              <div className="rounded-md bg-primary/10 p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Fill</div>
                <div className="font-mono text-sm font-bold text-primary">{fillVolume} m³</div>
              </div>
              <div className="rounded-md bg-accent/10 p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Net</div>
                <div className="font-mono text-sm font-bold">{net} m³</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Ruler className="h-4 w-4" />Cross-Section</CardTitle>
          </CardHeader>
          <CardContent>
            <CrossSectionSVG />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>0 m</span><span>Δh: 12.4 m</span><span>240 m</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
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

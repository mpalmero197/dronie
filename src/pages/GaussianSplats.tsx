import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, FolderOpen, Loader2, RefreshCw, Sparkles, Upload, Trash2,
  AlertCircle, Eye, FileBox, RotateCw, Download, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { TrainDialog } from "@/components/splats/TrainDialog";
import { JobList } from "@/components/splats/JobList";
import { ShareDialog } from "@/components/splats/ShareDialog";
import CaptureRequirements from "@/components/splats/CaptureRequirements";
import { track } from "@/lib/analytics";

interface ProjectOpt { id: string; name: string; }
interface SplatAsset { name: string; url: string; size: number; format: "ply" | "splat" | "ksplat"; }

const SPLAT_RX = /\.(ply|splat|ksplat)$/i;
const BUCKET = "project-outputs";
const SPLAT_PREFIX = "splats";

// Bundled demo scene so paid users can experience the viewer immediately,
// even before they've trained or uploaded their own splat. ~4 MB ksplat
// served from /public so CORS is never an issue.
const DEMO_SCENE: SplatAsset = {
  name: "Demo · Bonsai (sample)",
  url: "/demo/bonsai.ksplat",
  size: 4244696,
  format: "ksplat",
};

function detectFormat(name: string): SplatAsset["format"] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".ksplat")) return "ksplat";
  if (lower.endsWith(".splat")) return "splat";
  return "ply";
}

export default function GaussianSplats() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [assets, setAssets] = useState<SplatAsset[]>([]);
  const [selected, setSelected] = useState<SplatAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewerStatus, setViewerStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobsRefresh, setJobsRefresh] = useState(0);

  // Render controls
  const [splatScale, setSplatScale] = useState<number[]>([1.0]);
  const [alphaThreshold, setAlphaThreshold] = useState<number[]>([5]);
  const [sphericalHarmonics, setSphericalHarmonics] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);

  // Load project list
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id,name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const list = (data ?? []) as ProjectOpt[];
      setProjects(list);
      if (list.length > 0 && !projectId) setProjectId(list[0].id);
    })();
  }, [user]);

  const refresh = async (pid: string) => {
    if (!pid) { setAssets([]); setSelected(null); return; }
    setLoading(true);
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(`${pid}/${SPLAT_PREFIX}`, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error || !data) { setAssets([]); setSelected(null); setLoading(false); return; }
    const eligible = data
      .filter((f) => SPLAT_RX.test(f.name))
      .map((f): SplatAsset => {
        const path = `${pid}/${SPLAT_PREFIX}/${f.name}`;
        const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        return { name: f.name, url, size: f.metadata?.size ?? 0, format: detectFormat(f.name) };
      });
    setAssets(eligible);
    // Prefer the web-optimized .ksplat format when multiple scenes exist —
    // explicit splats are big and .ksplat streams far better on mobile.
    const preferred =
      eligible.find((a) => a.format === "ksplat") ??
      eligible.find((a) => a.format === "splat") ??
      eligible[0] ??
      null;
    setSelected(preferred);
    setLoading(false);
  };

  useEffect(() => { refresh(projectId); }, [projectId]);

  // Mount / re-mount viewer when selection changes
  useEffect(() => {
    let cancelled = false;
    const cleanup = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        if (viewerRef.current) {
          viewerRef.current.dispose?.();
        }
      } catch { /* ignore */ }
      viewerRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };

    if (!selected || !containerRef.current) {
      cleanup();
      setViewerStatus("idle");
      return;
    }

    setViewerStatus("loading");
    setError(null);

    (async () => {
      try {
        const GS = await import("@mkkellogg/gaussian-splats-3d");
        if (cancelled) return;

        cleanup();

        const formatEnum =
          selected.format === "ksplat" ? GS.SceneFormat.KSplat :
          selected.format === "splat" ? GS.SceneFormat.Splat :
          GS.SceneFormat.Ply;

        const viewer = new GS.Viewer({
          rootElement: containerRef.current!,
          cameraUp: [0, -1, -0.6],
          initialCameraPosition: [-1, -4, 6],
          initialCameraLookAt: [0, 1, 0],
          sharedMemoryForWorkers: false,
          gpuAcceleratedSort: true,
          sphericalHarmonicsDegree: sphericalHarmonics ? 2 : 0,
        });
        viewerRef.current = viewer;

        await viewer.addSplatScene(selected.url, {
          format: formatEnum,
          splatAlphaRemovalThreshold: alphaThreshold[0],
          showLoadingUI: true,
          progressiveLoad: true,
          scale: [splatScale[0], splatScale[0], splatScale[0]],
        });
        if (cancelled) { cleanup(); return; }
        viewer.start();
        setViewerStatus("ready");
      } catch (e) {
        console.error("[gaussian-splats] load error", e);
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load splat scene");
          setViewerStatus("error");
        }
      }
    })();

    return () => { cancelled = true; cleanup(); };
    // Only re-init when the asset itself changes; controls below tweak in place
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.url, sphericalHarmonics]);

  // Live updates for scale (re-init avoided; rebuild only on heavy params)
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || viewerStatus !== "ready") return;
    try {
      const scenes = v.splatMesh?.scenes ?? [];
      scenes.forEach((s: any) => {
        s.scale?.set?.(splatScale[0], splatScale[0], splatScale[0]);
      });
      v.splatMesh?.updateTransforms?.();
    } catch { /* ignore */ }
  }, [splatScale, viewerStatus]);

  // Auto-rotate orbit
  useEffect(() => {
    if (!autoRotate || viewerStatus !== "ready") return;
    let theta = 0;
    const radius = 6;
    const tick = () => {
      const v = viewerRef.current;
      if (!v?.camera) return;
      theta += 0.0035;
      v.camera.position.set(Math.cos(theta) * radius, -2.5, Math.sin(theta) * radius);
      v.camera.lookAt(0, 1, 0);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [autoRotate, viewerStatus]);

  const handleUpload = async (file: File) => {
    if (!projectId) {
      toast({ title: "Pick a project first", variant: "destructive" });
      return;
    }
    if (!SPLAT_RX.test(file.name)) {
      toast({ title: "Unsupported file", description: "Use .ply, .splat, or .ksplat", variant: "destructive" });
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 500 MB per scene.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const path = `${projectId}/${SPLAT_PREFIX}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false, contentType: "application/octet-stream",
    });
    setUploading(false);
    if (upErr) {
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "Splat uploaded", description: file.name });
    refresh(projectId);
  };

  const handleDelete = async (asset: SplatAsset) => {
    if (!projectId) return;
    if (!confirm(`Delete ${asset.name}?`)) return;
    const path = `${projectId}/${SPLAT_PREFIX}/${asset.name}`;
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted", description: asset.name });
    if (selected?.name === asset.name) setSelected(null);
    refresh(projectId);
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) { navigate("/auth"); return null; }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-display font-700 truncate">Gaussian Splatting</h1>
                <p className="text-xs text-muted-foreground truncate">Photorealistic 3D scenes from your captures · .ply / .splat / .ksplat</p>
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => refresh(projectId)} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        <CaptureRequirements />

        {/* Project + asset picker */}
        <div className="rounded-2xl border border-border bg-card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-primary" /> Project
            </label>
            {projects.length === 0 ? (
              <Button size="sm" variant="outline" onClick={() => navigate("/dashboard")} className="w-full">
                Create your first project
              </Button>
            ) : (
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <FileBox className="w-3.5 h-3.5 text-primary" /> Splat scene
            </label>
            {assets.length === 0 ? (
              <div className="h-9 px-3 flex items-center text-sm text-muted-foreground border border-dashed border-border rounded-md">
                {loading ? "Loading…" : "No splat scenes yet · upload below"}
              </div>
            ) : (
              <Select value={selected?.name ?? ""} onValueChange={(n) => setSelected(assets.find((a) => a.name === n) ?? null)}>
                <SelectTrigger><SelectValue placeholder="Select scene" /></SelectTrigger>
                <SelectContent>
                  {assets.map((a) => (
                    <SelectItem key={a.name} value={a.name}>
                      {a.name} · {(a.size / 1024 / 1024).toFixed(1)} MB · .{a.format}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          {/* Viewport */}
          <div className="space-y-4">
            <div className="relative rounded-2xl border border-border overflow-hidden bg-[hsl(220_30%_8%)] aspect-[16/10] sm:aspect-[16/9]">
              <div ref={containerRef} className="absolute inset-0" />
              {viewerStatus === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm pointer-events-none">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Decoding splats…
                  </div>
                </div>
              )}
              {viewerStatus === "error" && (
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  <div className="max-w-sm rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
                    <div className="flex items-center gap-2 font-semibold text-destructive mb-1">
                      <AlertCircle className="w-4 h-4" /> Failed to load scene
                    </div>
                    <p className="text-muted-foreground text-xs break-words">{error}</p>
                  </div>
                </div>
              )}
              {viewerStatus === "idle" && !selected && (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                  <div className="max-w-sm space-y-2">
                    <Sparkles className="w-10 h-10 mx-auto text-primary" />
                    <p className="font-display font-700 text-base">No scene selected</p>
                    <p className="text-xs text-muted-foreground">
                      Upload a 3D Gaussian Splatting file (.ply, .splat, .ksplat) trained from your drone imagery,
                      or render one from a finished WebODM project.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {selected && (
              <div className="rounded-2xl border border-border bg-card p-3 flex items-center justify-between gap-2 text-xs flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Eye className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="font-mono truncate">{selected.name}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                        <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs">
                      <DropdownMenuItem
                        onClick={() => {
                          track("splats_export", { format: selected.format, native: true });
                          window.open(selected.url, "_blank");
                        }}
                      >
                        Original (.{selected.format})
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          track("splats_export", { format: "ply" });
                          toast({ title: ".ply export", description: selected.format === "ply" ? "This scene is already .ply — use Original above." : "Conversion runs server-side; coming online soon." });
                        }}
                      >
                        .ply (raw)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          track("splats_export", { format: "splat" });
                          toast({ title: ".splat export", description: "Compact format — server-side conversion coming online soon." });
                        }}
                      >
                        .splat (compact)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          track("splats_export", { format: "ksplat" });
                          toast({ title: ".ksplat export", description: "Web-optimized format — server-side conversion coming online soon." });
                        }}
                      >
                        .ksplat (web-optimized)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ShareDialog
                    projectId={projectId}
                    assetPath={`${projectId}/${SPLAT_PREFIX}/${selected.name}`}
                    assetName={selected.name}
                  />
                  <button onClick={() => handleDelete(selected)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-destructive/15 text-destructive">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            )}

            {selected && selected.size > 250 * 1024 * 1024 && selected.format !== "ksplat" && (
              <div className="rounded-2xl border border-highlight/30 bg-highlight/10 p-3 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-highlight flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">
                    Heavy scene ({(selected.size / 1024 / 1024).toFixed(0)} MB) — consider .ksplat
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Explicit Gaussians scale fast. Convert this scene to <code>.ksplat</code> for vector-quantized
                    web streaming — mobile viewers will thank you. Use the Export menu above to queue a conversion.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Controls + upload + training */}
          <div className="space-y-4">
            <Tabs defaultValue="render" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="render">Render</TabsTrigger>
                <TabsTrigger value="train">Train</TabsTrigger>
              </TabsList>

              <TabsContent value="render" className="space-y-4 mt-3">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
              <h3 className="font-display font-700 text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" /> Render quality
              </h3>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Label className="text-muted-foreground">Splat scale</Label>
                  <span className="font-mono">{splatScale[0].toFixed(2)}×</span>
                </div>
                <Slider value={splatScale} onValueChange={setSplatScale} min={0.1} max={3} step={0.05} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Label className="text-muted-foreground">Alpha cutoff</Label>
                  <span className="font-mono">{alphaThreshold[0]}</span>
                </div>
                <Slider value={alphaThreshold} onValueChange={setAlphaThreshold} min={1} max={50} step={1} />
                <p className="text-[10px] text-muted-foreground">Hides faint splats. Reload scene to apply.</p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Spherical harmonics</Label>
                  <p className="text-[10px] text-muted-foreground">View-dependent color (slower)</p>
                </div>
                <Switch checked={sphericalHarmonics} onCheckedChange={setSphericalHarmonics} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs flex items-center gap-1"><RotateCw className="w-3 h-3" /> Auto-rotate</Label>
                  <p className="text-[10px] text-muted-foreground">Cinematic orbit</p>
                </div>
                <Switch checked={autoRotate} onCheckedChange={setAutoRotate} />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <h3 className="font-display font-700 text-sm flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-primary" /> Upload splat scene
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Train with{" "}
                <a className="text-primary hover:underline" href="https://github.com/graphdeco-inria/gaussian-splatting" target="_blank" rel="noreferrer">
                  INRIA 3DGS
                </a>{" "}
                or{" "}
                <a className="text-primary hover:underline" href="https://github.com/nerfstudio-project/nerfstudio" target="_blank" rel="noreferrer">
                  Nerfstudio
                </a>{" "}
                from your drone images, then drop the resulting <code className="text-[10px]">.ply</code> /{" "}
                <code className="text-[10px]">.splat</code> here.
              </p>
              <label className="block">
                <input
                  type="file"
                  accept=".ply,.splat,.ksplat"
                  className="hidden"
                  disabled={uploading || !projectId}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
                <span className={`block text-center text-sm py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                  uploading ? "border-muted text-muted-foreground" : "border-primary/40 text-primary hover:bg-primary/5"
                }`}>
                  {uploading ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</span> : "Choose .ply / .splat / .ksplat"}
                </span>
              </label>
              <p className="text-[10px] text-muted-foreground">Max 500 MB per scene. Stored under your project outputs.</p>
            </div>
              </TabsContent>

              <TabsContent value="train" className="space-y-4 mt-3">
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display font-700 text-sm flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-primary" /> Cloud training
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Inspired by Luma AI, DJI Terra and Nerfstudio.
                      </p>
                    </div>
                    <TrainDialog
                      projectId={projectId}
                      disabled={!projectId}
                      onJobCreated={() => setJobsRefresh((n) => n + 1)}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <h3 className="font-display font-700 text-sm">Recent jobs</h3>
                  <JobList projectId={projectId} refreshKey={jobsRefresh} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

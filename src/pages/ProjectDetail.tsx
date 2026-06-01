import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Map, Loader2, CheckCircle2, Circle, Clock,
  Play, Settings2, ImageIcon, FileArchive, Package,
  Download, Eye, Share2, Trash2, UploadCloud, FileText,
  AlertCircle, X, ChevronRight, Sliders, Layers,
  Mountain, Grid3X3, Ruler, FileType, MapPin, Upload,
} from "lucide-react";
import GpsMapPreview from "@/components/project/GpsMapPreview";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Project } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useRef } from "react";
import { LivePipeline } from "@/components/project/LivePipeline";
import { PresetPicker } from "@/components/project/PresetPicker";
import { EstimatePanel } from "@/components/project/EstimatePanel";
import { ImageQAReport } from "@/components/project/ImageQAReport";
import { DeliverableCard } from "@/components/project/DeliverableCard";
import { OverlapHeatmap } from "@/components/project/OverlapHeatmap";
import { PresetDetailCard } from "@/components/project/PresetDetailCard";
import { DeliverableShareDialog } from "@/components/project/DeliverableShareDialog";
import { AnnotationsPanel } from "@/components/project/AnnotationsPanel";
import { AccuracyReport, type AccuracyData } from "@/components/project/AccuracyReport";
import { DroneCameraPicker } from "@/components/project/DroneCameraPicker";
import { MissionCalculator } from "@/components/project/MissionCalculator";
import { GcpAdvisor } from "@/components/project/GcpAdvisor";
import { CrsPicker } from "@/components/project/CrsPicker";
import { ExtraOutputsPicker } from "@/components/project/ExtraOutputsPicker";
import { GENERIC_SPEC, type SensorSpec } from "@/lib/sensor-specs";
import { detectSensorFromImage } from "@/lib/exif-detect";
import {
   PRESETS,
   DEFAULT_SETTINGS as PG_DEFAULT_SETTINGS,
   estimateProcessing,
   runImageQa,
   QUALITY_PROFILE,
   type VerticalDatum,
   type ExtraOutputId,
   type PresetId,
   type ProcessingSettings as PgSettings,
   type GpsPoint,
} from "@/lib/photogrammetry";

/* ────── Types ────── */

interface FlightPlan {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

interface DroneImage {
  name: string;
  id: string;
  created_at: string;
  metadata: { size: number; mimetype: string } | null;
}

interface UploadItem {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

interface GCP {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  created_at: string;
}

type ProcessingSettings = PgSettings;
const DEFAULT_SETTINGS: ProcessingSettings = PG_DEFAULT_SETTINGS;

/* ────── Pipeline Steps ────── */

const PIPELINE_STEPS = [
  { key: "alignment", label: "Image Alignment", desc: "Feature matching & camera calibration", threshold: 20, icon: Layers },
  { key: "pointcloud", label: "Dense Point Cloud", desc: "Multi-view stereo reconstruction", threshold: 42, icon: Grid3X3 },
  { key: "mesh", label: "Mesh Generation", desc: "Surface reconstruction from point cloud", threshold: 58, icon: Mountain },
  { key: "ortho", label: "Orthomosaic", desc: "Georeferenced composite image", threshold: 74, icon: Map },
  { key: "dsm", label: "DSM / DTM", desc: "Digital surface & terrain models", threshold: 88, icon: Layers },
  { key: "contours", label: "Contour Extraction", desc: "Elevation contour lines", threshold: 95, icon: Ruler },
  { key: "export", label: "Final Export", desc: "Package deliverables", threshold: 100, icon: Package },
];

const OUTPUT_META: Record<string, { ext: string; desc: string; key: string }> = {
  "Orthomosaic": { ext: ".png", desc: "Georeferenced composite image", key: "orthomosaic" },
  "GeoTIFF": { ext: ".tif", desc: "Georeferenced orthomosaic", key: "orthomosaic" },
  "LAZ Point Cloud": { ext: ".laz", desc: "3D dense point cloud", key: "pointcloud" },
  "DSM": { ext: ".asc", desc: "Digital Surface Model", key: "dsm" },
  "DTM": { ext: ".asc", desc: "Digital Terrain Model", key: "dtm" },
  "Contours GeoJSON": { ext: ".geojson", desc: "Elevation contour lines", key: "contours" },
  "Contours SHP": { ext: ".shp", desc: "Contour lines shapefile", key: "contours" },
  "Flight Report PDF": { ext: ".pdf", desc: "Processing report & accuracy", key: "report" },
  "All Assets (ZIP)": { ext: ".zip", desc: "Complete output archive", key: "all_assets" },
};

/* ────── Helpers ────── */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/* ────── Sub-components ────── */

function StepIndicator({ step, progress, status }: {
  step: typeof PIPELINE_STEPS[0];
  progress: number;
  status: string;
}) {
  const Icon = step.icon;
  const isComplete = status === "complete" || progress >= step.threshold;
  const isActive = status === "processing" && progress < step.threshold && progress >= (PIPELINE_STEPS[PIPELINE_STEPS.indexOf(step) - 1]?.threshold ?? 0);
  const isPending = !isComplete && !isActive;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
      isActive ? "bg-accent/10 border border-accent/20" :
      isComplete ? "bg-primary/5 border border-primary/10" :
      "bg-muted/30 border border-transparent"
    }`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isComplete ? "bg-primary text-primary-foreground" :
        isActive ? "bg-accent text-accent-foreground" :
        "bg-muted text-muted-foreground"
      }`}>
        {isComplete ? <CheckCircle2 className="w-4 h-4" /> :
         isActive ? <Loader2 className="w-4 h-4 animate-spin" /> :
         <Icon className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${
          isComplete ? "text-primary" : isActive ? "text-accent" : "text-muted-foreground"
        }`}>{step.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
        {isActive && (
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-700 animate-pulse" style={{ width: "60%" }} />
          </div>
        )}
      </div>
      <div className="flex-shrink-0">
        {isComplete && <span className="text-xs font-medium text-primary">Done</span>}
        {isActive && <span className="text-xs font-medium text-accent">Running</span>}
        {isPending && <span className="text-xs text-muted-foreground">Pending</span>}
      </div>
    </div>
  );
}

function UploadRow({ item, onDismiss }: { item: UploadItem; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-2.5 bg-secondary/60 rounded-lg px-3 py-2 text-xs">
      {item.status === "uploading" && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />}
      {item.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
      {item.status === "error" && <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
      {item.status === "pending" && <Loader2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      <span className="flex-1 truncate text-foreground/80">{item.file.name}</span>
      {item.status === "error" && <span className="text-destructive truncate max-w-[120px]">{item.error}</span>}
      {(item.status === "done" || item.status === "error") && (
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground ml-1"><X className="w-3 h-3" /></button>
      )}
    </div>
  );
}

/* ────── Main Page ────── */

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, loading: authLoading, subscriptionTier } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [flightPlans, setFlightPlans] = useState<FlightPlan[]>([]);
  const [droneImages, setDroneImages] = useState<DroneImage[]>([]);
  const [loadingFP, setLoadingFP] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULT_SETTINGS);
  const [fpUploads, setFpUploads] = useState<UploadItem[]>([]);
  const [imgUploads, setImgUploads] = useState<UploadItem[]>([]);
  const [fpDragging, setFpDragging] = useState(false);
  const [imgDragging, setImgDragging] = useState(false);
  const [gcps, setGcps] = useState<GCP[]>([]);
  const [loadingGcps, setLoadingGcps] = useState(false);
  const [description, setDescription] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [presetId, setPresetId] = useState<PresetId>(
    (DEFAULT_SETTINGS.preset as PresetId) || "mapping"
  );
  const [sensor, setSensor] = useState<SensorSpec>(GENERIC_SPEC);
  const [sensorAutoDetected, setSensorAutoDetected] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedDeliverables, setSelectedDeliverables] = useState<string[]>([]);

  const fpInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const gcpInputRef = useRef<HTMLInputElement>(null);

  /* ── Load project ── */
  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth"); return; }
    if (!user || !projectId) return;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
      if (error || !data) {
        toast({ title: "Project not found", variant: "destructive" });
        navigate("/dashboard");
        return;
      }
      setProject(data as Project);
      setDescription(data.description || "");
      setLoading(false);
    }
    load();
  }, [user, authLoading, projectId]);

  /* ── Realtime ── */
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`project-${projectId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${projectId}` },
        (payload) => setProject(payload.new as Project)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  /* ── Load assets ── */
  const loadFlightPlans = useCallback(async () => {
    if (!project) return;
    setLoadingFP(true);
    const { data } = await supabase.from("flight_plans").select("*").eq("project_id", project.id).order("created_at", { ascending: false });
    if (data) setFlightPlans(data);
    setLoadingFP(false);
  }, [project]);

  const loadDroneImages = useCallback(async () => {
    if (!project || !user) return;
    setLoadingImages(true);
    const { data } = await supabase.storage.from("drone-images").list(`${user.id}/${project.id}`, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
    if (data) setDroneImages(data.filter((f) => f.name !== ".emptyFolderPlaceholder") as DroneImage[]);
    setLoadingImages(false);
  }, [project, user]);

  const loadGcps = useCallback(async () => {
    if (!project) return;
    setLoadingGcps(true);
    const { data } = await supabase.from("ground_control_points").select("*").eq("project_id", project.id).order("created_at", { ascending: true });
    if (data) setGcps(data as GCP[]);
    setLoadingGcps(false);
  }, [project]);

  useEffect(() => {
    if (project) { loadFlightPlans(); loadDroneImages(); loadGcps(); }
  }, [project?.id]);

  /* ── Upload handlers ── */
  const uploadFlightPlan = useCallback(async (file: File) => {
    if (!project || !user) return;
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".kml") && !ext.endsWith(".kmz")) {
      toast({ title: "Invalid file", description: "Only KML/KMZ accepted.", variant: "destructive" });
      return;
    }
    const item: UploadItem = { file, status: "uploading", progress: 0 };
    setFpUploads((p) => [...p, item]);
    const path = `${user.id}/${project.id}/${Date.now()}_${file.name}`;
    const { error: se } = await supabase.storage.from("flight-plans").upload(path, file);
    if (se) { setFpUploads((p) => p.map((u, i) => i === p.length - 1 ? { ...u, status: "error", error: se.message } : u)); return; }
    const { error: de } = await supabase.from("flight_plans").insert({ project_id: project.id, user_id: user.id, file_name: file.name, file_path: path, file_size: file.size, file_type: ext.endsWith(".kmz") ? "kmz" : "kml" });
    if (de) { setFpUploads((p) => p.map((u, i) => i === p.length - 1 ? { ...u, status: "error", error: de.message } : u)); }
    else { setFpUploads((p) => p.map((u, i) => i === p.length - 1 ? { ...u, status: "done", progress: 100 } : u)); loadFlightPlans(); }
  }, [project, user, loadFlightPlans, toast]);

  const uploadImages = useCallback(async (files: File[]) => {
    if (!project || !user) return;
    const validExts = [".jpg", ".jpeg", ".tiff", ".tif", ".dng", ".png"];
    const valid = files.filter((f) => validExts.some((e) => f.name.toLowerCase().endsWith(e)));
    if (!valid.length) { toast({ title: "No valid images", variant: "destructive" }); return; }

    // Auto-detect drone/sensor + RTK from first uploaded image's EXIF.
    if (!sensorAutoDetected) {
      const probe = valid.find((f) => /\.(jpe?g|tiff?|dng)$/i.test(f.name)) ?? valid[0];
      detectSensorFromImage(probe).then((res) => {
        if (!res) return;
        setSensor(res.spec);
        setSensorAutoDetected(true);
        toast({
          title: res.matched ? `Detected ${res.spec.manufacturer} ${res.spec.model}` : "Sensor inferred from EXIF",
          description: `${res.spec.imageWidthPx}×${res.spec.imageHeightPx} · ${res.spec.focalLengthMm} mm${res.rtkLikely ? " · RTK fix detected" : ""}`,
        });
      });
    }

    const items: UploadItem[] = valid.map((f) => ({ file: f, status: "pending" as const, progress: 0 }));
    setImgUploads((p) => [...p, ...items]);
    let count = 0;
    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      const idx = imgUploads.length + i;
      setImgUploads((p) => p.map((u, j) => j === idx ? { ...u, status: "uploading" } : u));
      const path = `${user.id}/${project.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("drone-images").upload(path, file);
      setImgUploads((p) => p.map((u, j) => j === idx ? { ...u, status: error ? "error" : "done", progress: error ? 0 : 100, error: error?.message } : u));
      if (!error) count++;
    }
    if (count > 0) {
      const nc = (project.image_count || 0) + count;
      const { data } = await supabase.from("projects").update({ image_count: nc }).eq("id", project.id).select().single();
      if (data) setProject(data as Project);
      loadDroneImages();
      toast({ title: `${count} image${count > 1 ? "s" : ""} uploaded` });
    }
  }, [project, user, imgUploads.length, loadDroneImages, toast, sensorAutoDetected]);

  async function deleteFlightPlan(fp: FlightPlan) {
    await supabase.storage.from("flight-plans").remove([fp.file_path]);
    await supabase.from("flight_plans").delete().eq("id", fp.id);
    setFlightPlans((p) => p.filter((f) => f.id !== fp.id));
    toast({ title: "Flight plan deleted" });
  }

  async function deleteDroneImage(img: DroneImage) {
    if (!project || !user) return;
    await supabase.storage.from("drone-images").remove([`${user.id}/${project.id}/${img.name}`]);
    setDroneImages((p) => p.filter((i) => i.name !== img.name));
    const nc = Math.max(0, (project.image_count || 0) - 1);
    const { data } = await supabase.from("projects").update({ image_count: nc }).eq("id", project.id).select().single();
    if (data) setProject(data as Project);
    toast({ title: "Image deleted" });
  }

  /* ── GCP upload ── */
  async function uploadGcpCsv(file: File) {
    if (!project || !user) return;
    try {
      const text = await file.text();
      const lines = text.trim().split("\n");
      const header = lines[0].toLowerCase();
      const hasHeader = header.includes("name") || header.includes("lat");
      const dataLines = hasHeader ? lines.slice(1) : lines;
      const rows: { name: string; latitude: number; longitude: number; elevation: number | null }[] = [];
      for (const line of dataLines) {
        const parts = line.split(",").map(s => s.trim());
        if (parts.length < 3) continue;
        const name = parts[0];
        const lat = parseFloat(parts[1]);
        const lng = parseFloat(parts[2]);
        const elev = parts[3] ? parseFloat(parts[3]) : null;
        if (isNaN(lat) || isNaN(lng)) continue;
        rows.push({ name, latitude: lat, longitude: lng, elevation: elev });
      }
      if (!rows.length) { toast({ title: "No valid GCPs found", variant: "destructive" }); return; }
      const inserts = rows.map(r => ({ ...r, project_id: project.id, user_id: user.id }));
      const { error } = await supabase.from("ground_control_points").insert(inserts);
      if (error) throw error;
      toast({ title: `${rows.length} GCPs imported` });
      loadGcps();
    } catch (err: any) {
      toast({ title: "GCP import failed", description: err.message, variant: "destructive" });
    }
  }

  async function deleteGcp(id: string) {
    await supabase.from("ground_control_points").delete().eq("id", id);
    setGcps(prev => prev.filter(g => g.id !== id));
    toast({ title: "GCP deleted" });
  }

  /* ── Save description ── */
  async function saveDescription() {
    if (!project) return;
    setSavingDesc(true);
    const { data } = await supabase.from("projects").update({ description }).eq("id", project.id).select().single();
    if (data) setProject(data as Project);
    setSavingDesc(false);
    toast({ title: "Description saved" });
  }

  /* ── Apply preset ── */
  function applyPreset(id: PresetId) {
    setPresetId(id);
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setSettings({ ...p.settings, preset: id });
  }

  /* ── Cancel processing ── */
  async function cancelProcessing() {
    if (!project) return;
    setCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const pid = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${pid}.supabase.co/functions/v1/cancel-project`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ project_id: project.id }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Cancel failed");
      }
      toast({ title: "Cancellation requested", description: "The pipeline will stop at the next checkpoint." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  }

  /* ── Submit processing ── */
  async function submitForProcessing() {
    if (project?.status === "processing") return;
    if (!project || !user) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const pid = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${pid}.supabase.co/functions/v1/process-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ project_id: project.id, settings, subscription_tier: subscriptionTier }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      const result = await res.json();
      const priorityMsg = result.priority_processing
        ? "Priority processing enabled — your project is at the front of the queue."
        : result.queue_position > 0
          ? `Your project is in position ${result.queue_position + 1} in the queue. Upgrade for priority processing.`
          : "Watch the pipeline steps update in real-time.";
      toast({ title: "Processing started!", description: priorityMsg });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Loading state ── */
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) return null;

  const status = project.status;
  const progress = project.progress ?? 0;
  const isComplete = status === "complete";
  const isProcessing = status === "processing";
  const canProcess = status === "queued" || status === "failed";

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{`${project.name} · Project · Dronie`}</title>
        <meta
          name="description"
          content={
            project.description ||
            `Drone mapping project "${project.name}" — processing pipeline, deliverables and accuracy report on Dronie.`
          }
        />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href={`https://dronieapp.com/project/${project.id}`} />
      </Helmet>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
            </Link>
            <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
              <Map className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-700 text-foreground text-lg">{project.name}</h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{formatDate(project.created_at)}</span>
                {project.image_count > 0 && <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" />{project.image_count} images</span>}
                {project.area_ha && <span>{project.area_ha} ha</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isComplete && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShareOpen(true)}>
                  <Share2 className="w-3 h-3" /> Share
                </Button>
                <Button size="sm" className="gap-1.5 text-xs bg-primary text-primary-foreground" onClick={() => navigate(`/viewer/${project.id}`)}>
                  <Eye className="w-3 h-3" /> Open Viewer
                </Button>
              </>
            )}
            {canProcess && (
              <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground" onClick={submitForProcessing} disabled={submitting}>
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {submitting ? "Starting…" : "Start Processing"}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {/* Editable description */}
        <div className="bg-card rounded-2xl border border-border p-4 mb-6">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            placeholder="Add project notes or description…"
            className="w-full bg-transparent text-sm text-foreground resize-none outline-none placeholder:text-muted-foreground min-h-[60px]"
            rows={2}
          />
          {savingDesc && <p className="text-xs text-muted-foreground mt-1">Saving…</p>}
        </div>

        {/* Plan a Flight CTA */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 shadow">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-700 text-foreground text-sm sm:text-base">
              {flightPlans.length > 0 ? "Edit Flight Plan" : "Plan a Flight"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {flightPlans.length > 0
                ? `${flightPlans.length} plan${flightPlans.length > 1 ? "s" : ""} attached. Open the planner to draw or refine your survey area.`
                : "Draw your survey area on the map. Dronie generates the lawnmower path, KMZ for DJI Fly, and a PDF briefing."}
            </p>
          </div>
          <Button
            onClick={() => navigate(`/plan?project=${project.id}`)}
            className="gap-2 flex-shrink-0"
          >
            <MapPin className="w-4 h-4" />
            <span className="hidden sm:inline">{flightPlans.length > 0 ? "Open Planner" : "Plan Flight"}</span>
            <span className="sm:hidden">Plan</span>
          </Button>
        </div>

        {/* GPS Map Preview */}
        {project.gps_points && Array.isArray(project.gps_points) && (project.gps_points as any[]).length > 0 && (
          <GpsMapPreview gpsPoints={project.gps_points as any} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Pipeline + Outputs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Pipeline */}
            <LivePipeline
              projectId={project.id}
              initial={{
                id: project.id,
                status: project.status,
                progress: project.progress ?? 0,
                current_stage: (project.current_stage as string | null) ?? null,
                stage_progress: project.stage_progress ?? null,
                stage_started_at: project.stage_started_at ?? null,
                eta_seconds: project.eta_seconds ?? null,
                stage_log: (project.stage_log as any) ?? [],
                outputs_urls: project.outputs_urls ?? null,
              }}
              canCancel
              onCancel={cancelProcessing}
              cancelling={cancelling}
            />

            {/* Accuracy Report */}
            {isComplete && project.accuracy_report && (
              <AccuracyReport data={project.accuracy_report as AccuracyData} />
            )}

            {/* Deliverables */}
            {isComplete && project.outputs && project.outputs.length > 0 && (
              <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-700 text-foreground flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    Deliverables
                  </h2>
                  <span className="text-xs text-muted-foreground">{project.outputs.length} files</span>
                </div>
                {project.outputs_urls?.error && (
                  <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
                    <p className="text-xs text-destructive font-medium">
                      Processing error: {project.outputs_urls.error}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {project.outputs.map((name) => {
                    const meta = OUTPUT_META[name] || { ext: "", desc: name, key: "default" };
                    const downloadUrl = project.outputs_urls?.[meta.key] as string | undefined;
                    const previewUrl = meta.key === "orthomosaic" ? downloadUrl : undefined;
                    const viewerHref = meta.key === "orthomosaic" ? `/viewer/${project.id}` : undefined;
                    return (
                      <DeliverableCard
                        key={name}
                        name={name}
                        description={meta.desc}
                        kind={meta.key as any}
                        downloadUrl={project.outputs_urls?.error ? null : downloadUrl}
                        previewUrl={previewUrl}
                        viewerHref={viewerHref}
                        selected={selectedDeliverables.includes(meta.key)}
                        onSelect={(sel) => setSelectedDeliverables((p) => sel ? [...p, meta.key] : p.filter((k) => k !== meta.key))}
                      />
                    );
                  })}
                </div>
                {user && (
                  <DeliverableShareDialog
                    open={shareOpen}
                    onOpenChange={setShareOpen}
                    projectId={project.id}
                    ownerId={user.id}
                    selectedKeys={selectedDeliverables}
                    availableKeys={project.outputs.map((name) => {
                      const meta = OUTPUT_META[name] || { ext: "", desc: name, key: "default" };
                      return { key: meta.key, label: name };
                    })}
                  />
                )}
              </div>
            )}

            {/* Files Tab */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <Tabs defaultValue="images">
                <TabsList className="w-full">
                  <TabsTrigger value="images" className="flex-1 gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Images
                    {droneImages.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-primary text-primary-foreground font-semibold">{droneImages.length}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="flight-plans" className="flex-1 gap-1.5">
                    <FileArchive className="w-3.5 h-3.5" />
                    Flight Plans
                    {flightPlans.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-primary text-primary-foreground font-semibold">{flightPlans.length}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="gcps" className="flex-1 gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    GCPs
                    {gcps.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-primary text-primary-foreground font-semibold">{gcps.length}</span>}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="images" className="space-y-3 pt-4">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setImgDragging(true); }}
                    onDragLeave={() => setImgDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setImgDragging(false); uploadImages(Array.from(e.dataTransfer.files)); }}
                    onClick={() => imgInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${imgDragging ? "border-accent bg-accent/5" : "border-border hover:border-primary/40 hover:bg-secondary/50"}`}
                  >
                    <input ref={imgInputRef} type="file" accept=".jpg,.jpeg,.tiff,.tif,.dng,.png" multiple className="hidden" onChange={(e) => uploadImages(Array.from(e.target.files || []))} />
                    <UploadCloud className={`w-8 h-8 mx-auto mb-2 ${imgDragging ? "text-accent" : "text-muted-foreground"}`} />
                    <p className="font-semibold text-sm text-foreground">{imgDragging ? "Drop images here" : "Upload drone images"}</p>
                    <p className="text-xs text-muted-foreground mt-1">JPEG · TIFF · DNG · PNG · Up to 100 MB each</p>
                  </div>

                  {imgUploads.length > 0 && (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {imgUploads.map((u, i) => <UploadRow key={i} item={u} onDismiss={() => setImgUploads((p) => p.filter((_, j) => j !== i))} />)}
                    </div>
                  )}

                  {loadingImages ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                  ) : droneImages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No images uploaded yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {droneImages.map((img) => (
                        <div key={img.id || img.name} className="flex items-center gap-3 bg-secondary/40 rounded-lg px-3 py-2">
                          <ImageIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{img.name}</p>
                            {img.metadata?.size && <p className="text-xs text-muted-foreground">{formatBytes(img.metadata.size)}</p>}
                          </div>
                          <Button variant="ghost" size="sm" className="w-6 h-6 p-0 hover:text-destructive" onClick={() => deleteDroneImage(img)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="flight-plans" className="space-y-3 pt-4">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setFpDragging(true); }}
                    onDragLeave={() => setFpDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setFpDragging(false); Array.from(e.dataTransfer.files).forEach(uploadFlightPlan); }}
                    onClick={() => fpInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${fpDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-secondary/50"}`}
                  >
                    <input ref={fpInputRef} type="file" accept=".kml,.kmz" multiple className="hidden" onChange={(e) => Array.from(e.target.files || []).forEach(uploadFlightPlan)} />
                    <FileArchive className={`w-8 h-8 mx-auto mb-2 ${fpDragging ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="font-semibold text-sm text-foreground">{fpDragging ? "Drop KML/KMZ here" : "Upload flight plan"}</p>
                    <p className="text-xs text-muted-foreground mt-1">KML or KMZ from Google Earth Pro</p>
                  </div>

                  {fpUploads.length > 0 && (
                    <div className="space-y-1.5">
                      {fpUploads.map((u, i) => <UploadRow key={i} item={u} onDismiss={() => setFpUploads((p) => p.filter((_, j) => j !== i))} />)}
                    </div>
                  )}

                  {loadingFP ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                  ) : flightPlans.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No flight plans uploaded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {flightPlans.map((fp) => (
                        <div key={fp.id} className="flex items-center gap-3 bg-secondary/40 rounded-lg px-3 py-2.5">
                          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{fp.file_name}</p>
                            <p className="text-xs text-muted-foreground">{fp.file_type.toUpperCase()} · {formatBytes(fp.file_size)} · {formatDate(fp.created_at)}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="w-7 h-7 p-0 hover:text-destructive" onClick={() => deleteFlightPlan(fp)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="gcps" className="space-y-3 pt-4">
                  <div
                    onClick={() => gcpInputRef.current?.click()}
                    className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all border-border hover:border-primary/40 hover:bg-secondary/50"
                  >
                    <input ref={gcpInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadGcpCsv(f); e.target.value = ""; }} />
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="font-semibold text-sm text-foreground">Upload GCP file</p>
                    <p className="text-xs text-muted-foreground mt-1">CSV format: name, latitude, longitude, elevation (optional)</p>
                  </div>

                  {loadingGcps ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                  ) : gcps.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No ground control points added yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-muted-foreground px-3 py-1">
                        <span>Name</span><span>Latitude</span><span>Longitude</span><span>Elevation</span><span></span>
                      </div>
                      {gcps.map((gcp) => (
                        <div key={gcp.id} className="grid grid-cols-5 gap-2 items-center bg-secondary/40 rounded-lg px-3 py-2 text-xs">
                          <span className="font-medium text-foreground truncate">{gcp.name}</span>
                          <span className="text-muted-foreground">{gcp.latitude.toFixed(6)}</span>
                          <span className="text-muted-foreground">{gcp.longitude.toFixed(6)}</span>
                          <span className="text-muted-foreground">{gcp.elevation?.toFixed(1) ?? "—"}</span>
                          <Button variant="ghost" size="sm" className="w-6 h-6 p-0 hover:text-destructive justify-self-end" onClick={() => deleteGcp(gcp.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Right: Settings Panel */}
          <div className="space-y-6">
            {/* Drone & sensor */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <h2 className="font-display font-700 text-foreground flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                Drone &amp; sensor
              </h2>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Used for GSD math, RTK detection, and rolling-shutter warnings.
              </p>
              <DroneCameraPicker
                value={sensor}
                onChange={(s) => { setSensor(s); setSensorAutoDetected(true); }}
                disabled={isProcessing}
              />
              {sensorAutoDetected && (
                <p className="text-[11px] text-primary flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" /> Auto-detected from image EXIF
                </p>
              )}
            </div>

            {/* Mission calculator — pre-flight planning math */}
            <MissionCalculator
              spec={sensor}
              initialAreaHa={project.area_ha}
              initialGcps={gcps.length}
            />

            {/* GCP advisor */}
            <GcpAdvisor
              gcps={gcps.map((g) => ({
                latitude: g.latitude,
                longitude: g.longitude,
                elevation: g.elevation,
              }))}
              areaHa={project.area_ha}
              rtkEnabled={sensor.hasRtk}
            />

            {/* Preset Picker */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <h2 className="font-display font-700 text-foreground flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                Industry Preset
              </h2>
              <PresetPicker value={presetId} onChange={applyPreset} disabled={isProcessing} />
              <PresetDetailCard presetId={presetId} imageCount={project.image_count || droneImages.length} />
            </div>

            {/* Estimate */}
            <EstimatePanel
              estimate={estimateProcessing({
                imageCount: project.image_count || droneImages.length,
                areaHa: project.area_ha,
                settings,
              })}
            />

            {/* Image QA */}
            {(droneImages.length > 0 || (project.gps_points && Array.isArray(project.gps_points))) && (
              <div className="space-y-3">
                <ImageQAReport
                  qa={runImageQa({
                    totalImages: project.image_count || droneImages.length,
                    gpsPoints: (Array.isArray(project.gps_points) ? (project.gps_points as GpsPoint[]) : []),
                  })}
                />
                {Array.isArray(project.gps_points) && (project.gps_points as any[]).length > 0 && (
                  <OverlapHeatmap points={project.gps_points as GpsPoint[]} />
                )}
              </div>
            )}

            <div className="bg-card rounded-2xl border border-border p-5 space-y-5 sticky top-24">
              <h2 className="font-display font-700 text-foreground flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                Advanced Settings
              </h2>

              {/* Quality */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quality Preset</Label>
                <Select value={settings.quality} onValueChange={(v) => setSettings({ ...settings, quality: v as any })} disabled={isProcessing}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low — Fast preview</SelectItem>
                    <SelectItem value="medium">Medium — Balanced</SelectItem>
                    <SelectItem value="high">High — Production</SelectItem>
                    <SelectItem value="ultra">Ultra — Maximum detail</SelectItem>
                  </SelectContent>
                </Select>
                <div className="rounded-lg bg-secondary/40 border border-border p-2.5 text-[11px] text-muted-foreground space-y-1">
                  <p className="text-foreground">
                    {QUALITY_PROFILE[settings.quality].description}
                  </p>
                  <p className="font-mono">
                    image_scale={QUALITY_PROFILE[settings.quality].imageScale} ·
                    depthmap={QUALITY_PROFILE[settings.quality].depthmapResolution}px ·
                    octree={QUALITY_PROFILE[settings.quality].meshOctreeDepth}
                  </p>
                </div>
              </div>

              {/* Point Density */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Point Density</Label>
                  <span className="text-xs text-muted-foreground">{settings.pointDensity[0]}%</span>
                </div>
                <Slider
                  value={settings.pointDensity}
                  onValueChange={(v) => setSettings({ ...settings, pointDensity: v })}
                  min={10} max={100} step={5}
                  disabled={isProcessing}
                />
              </div>

              {/* Mesh Type */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mesh Type</Label>
                <Select value={settings.meshType} onValueChange={(v) => setSettings({ ...settings, meshType: v as any })} disabled={isProcessing}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3d">Full 3D Mesh</SelectItem>
                    <SelectItem value="2.5d">2.5D Surface</SelectItem>
                    <SelectItem value="none">No Mesh</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Output Format */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Output Format</Label>
                <Select value={settings.outputFormat} onValueChange={(v) => setSettings({ ...settings, outputFormat: v as any })} disabled={isProcessing}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geotiff">GeoTIFF (.tif)</SelectItem>
                    <SelectItem value="cog">Cloud-Optimized GeoTIFF</SelectItem>
                    <SelectItem value="ecw">ECW</SelectItem>
                    <SelectItem value="jpg2000">JPEG 2000</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* CRS + Vertical datum */}
              <CrsPicker
                horizontal={settings.crs}
                vertical={(settings.verticalDatum as VerticalDatum) || "egm96"}
                onHorizontalChange={(epsg) => setSettings({ ...settings, crs: epsg })}
                onVerticalChange={(d) => setSettings({ ...settings, verticalDatum: d })}
                centroid={(() => {
                  const pts = (project.gps_points as any[]) || [];
                  if (!Array.isArray(pts) || pts.length === 0) return null;
                  const lat = pts.reduce((s, p) => s + (p.lat ?? 0), 0) / pts.length;
                  const lng = pts.reduce((s, p) => s + (p.lng ?? 0), 0) / pts.length;
                  return { lat, lng };
                })()}
                disabled={isProcessing}
              />

              {/* Extra deliverables */}
              <ExtraOutputsPicker
                value={(settings.extraOutputs as ExtraOutputId[]) || []}
                onChange={(next) => setSettings({ ...settings, extraOutputs: next })}
                disabled={isProcessing}
              />

              <div className="border-t border-border pt-4 space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Output Layers</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">DSM (Surface Model)</span>
                    <Switch checked={settings.dsmEnabled} onCheckedChange={(v) => setSettings({ ...settings, dsmEnabled: v })} disabled={isProcessing} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">DTM (Terrain Model)</span>
                    <Switch checked={settings.dtmEnabled} onCheckedChange={(v) => setSettings({ ...settings, dtmEnabled: v })} disabled={isProcessing} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Contour Lines</span>
                    <Switch checked={settings.contoursEnabled} onCheckedChange={(v) => setSettings({ ...settings, contoursEnabled: v })} disabled={isProcessing} />
                  </div>
                </div>

                {settings.contoursEnabled && (
                  <div className="space-y-1.5 pl-1">
                    <Label className="text-xs text-muted-foreground">Contour Interval (m)</Label>
                    <Input
                      type="number"
                      min={0.25}
                      max={10}
                      step={0.25}
                      value={settings.contourInterval}
                      onChange={(e) => setSettings({ ...settings, contourInterval: parseFloat(e.target.value) || 1 })}
                      disabled={isProcessing}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
              </div>

              {canProcess && (
                <Button className="w-full gap-2 bg-primary text-primary-foreground" onClick={submitForProcessing} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {submitting ? "Starting…" : "Start Processing"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

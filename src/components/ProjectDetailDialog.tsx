import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  UploadCloud, FileText, ImageIcon, Trash2, Loader2,
  CheckCircle2, AlertCircle, X, Map, FileArchive,
  Download, Play, Package, ExternalLink, FileType,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase, Project } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRef } from "react";

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const OUTPUT_META: Record<string, { icon: typeof FileType; ext: string; desc: string }> = {
  "GeoTIFF": { icon: FileType, ext: ".tif", desc: "Georeferenced orthomosaic" },
  "LAZ Point Cloud": { icon: Package, ext: ".laz", desc: "3D dense point cloud" },
  "DSM": { icon: FileType, ext: ".tif", desc: "Digital Surface Model" },
  "DTM": { icon: FileType, ext: ".tif", desc: "Digital Terrain Model" },
  "Contours SHP": { icon: FileType, ext: ".shp", desc: "Contour lines shapefile" },
  "Flight Report PDF": { icon: FileText, ext: ".pdf", desc: "Processing report & accuracy" },
};

function OutputItem({ name, projectName }: { name: string; projectName: string }) {
  const meta = OUTPUT_META[name] || { icon: FileType, ext: "", desc: name };
  const Icon = meta.icon;

  function handleDownload() {
    // In a real system this would fetch from storage
    // For now we show a toast indicating the file
    const el = document.createElement("a");
    el.href = "#";
    el.download = `${projectName}_${name.replace(/ /g, "_")}${meta.ext}`;
    el.click();
  }

  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-3 hover:border-primary/20 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{meta.desc}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        className="gap-1.5 text-xs hover:border-primary/40 hover:text-primary transition-colors flex-shrink-0"
      >
        <Download className="w-3 h-3" />
        {meta.ext}
      </Button>
    </div>
  );
}

export default function ProjectDetailDialog({
  project,
  open,
  onClose,
  onProjectUpdated,
}: {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onProjectUpdated: (p: Project) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [flightPlans, setFlightPlans] = useState<FlightPlan[]>([]);
  const [droneImages, setDroneImages] = useState<DroneImage[]>([]);
  const [loadingFP, setLoadingFP] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [submittingProcessing, setSubmittingProcessing] = useState(false);

  const [fpUploads, setFpUploads] = useState<UploadItem[]>([]);
  const [imgUploads, setImgUploads] = useState<UploadItem[]>([]);

  const fpInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [fpDragging, setFpDragging] = useState(false);
  const [imgDragging, setImgDragging] = useState(false);

  const loadFlightPlans = useCallback(async () => {
    if (!project) return;
    setLoadingFP(true);
    const { data, error } = await supabase
      .from("flight_plans")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });
    if (!error) setFlightPlans(data || []);
    setLoadingFP(false);
  }, [project]);

  const loadDroneImages = useCallback(async () => {
    if (!project || !user) return;
    setLoadingImages(true);
    const { data, error } = await supabase.storage
      .from("drone-images")
      .list(`${user.id}/${project.id}`, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
    if (!error) setDroneImages((data || []).filter((f) => f.name !== ".emptyFolderPlaceholder") as DroneImage[]);
    setLoadingImages(false);
  }, [project, user]);

  useEffect(() => {
    if (open && project) {
      loadFlightPlans();
      loadDroneImages();
    } else {
      setFlightPlans([]);
      setDroneImages([]);
      setFpUploads([]);
      setImgUploads([]);
    }
  }, [open, project]);

  const uploadFlightPlan = useCallback(async (file: File) => {
    if (!project || !user) return;

    const isKml = file.name.toLowerCase().endsWith(".kml");
    const isKmz = file.name.toLowerCase().endsWith(".kmz");
    if (!isKml && !isKmz) {
      toast({ title: "Invalid file", description: "Only KML and KMZ files are accepted.", variant: "destructive" });
      return;
    }

    const item: UploadItem = { file, status: "uploading", progress: 0 };
    setFpUploads((prev) => [...prev, item]);

    const path = `${user.id}/${project.id}/${Date.now()}_${file.name}`;
    const { error: storageError } = await supabase.storage
      .from("flight-plans")
      .upload(path, file, { upsert: false });

    if (storageError) {
      setFpUploads((prev) => prev.map((u, i) => i === prev.length - 1 ? { ...u, status: "error", error: storageError.message } : u));
      return;
    }

    const { error: dbError } = await supabase.from("flight_plans").insert({
      project_id: project.id,
      user_id: user.id,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      file_type: isKmz ? "kmz" : "kml",
    });

    if (dbError) {
      setFpUploads((prev) => prev.map((u, i) => i === prev.length - 1 ? { ...u, status: "error", error: dbError.message } : u));
    } else {
      setFpUploads((prev) => prev.map((u, i) => i === prev.length - 1 ? { ...u, status: "done", progress: 100 } : u));
      loadFlightPlans();
      toast({ title: "Flight plan uploaded", description: file.name });
    }
  }, [project, user, loadFlightPlans, toast]);

  const uploadImages = useCallback(async (files: File[]) => {
    if (!project || !user) return;

    const validExts = [".jpg", ".jpeg", ".tiff", ".tif", ".dng", ".png"];
    const validFiles = files.filter((f) =>
      validExts.some((ext) => f.name.toLowerCase().endsWith(ext))
    );

    if (validFiles.length === 0) {
      toast({ title: "No valid images", description: "Accepted: JPG, TIFF, DNG, PNG", variant: "destructive" });
      return;
    }
    if (validFiles.length < files.length) {
      toast({ title: `${files.length - validFiles.length} file(s) skipped`, description: "Only JPG, TIFF, DNG, PNG accepted." });
    }

    const newItems: UploadItem[] = validFiles.map((f) => ({ file: f, status: "pending", progress: 0 }));
    setImgUploads((prev) => [...prev, ...newItems]);

    let uploadedCount = 0;
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const globalIdx = imgUploads.length + i;

      setImgUploads((prev) =>
        prev.map((u, j) => j === globalIdx ? { ...u, status: "uploading" } : u)
      );

      const path = `${user.id}/${project.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("drone-images")
        .upload(path, file, { upsert: false });

      setImgUploads((prev) =>
        prev.map((u, j) =>
          j === globalIdx
            ? { ...u, status: error ? "error" : "done", progress: error ? 0 : 100, error: error?.message }
            : u
        )
      );

      if (!error) uploadedCount++;
    }

    if (uploadedCount > 0) {
      const newCount = (project.image_count || 0) + uploadedCount;
      const { data: updated } = await supabase
        .from("projects")
        .update({ image_count: newCount })
        .eq("id", project.id)
        .select()
        .single();
      if (updated) onProjectUpdated(updated as Project);
      loadDroneImages();
      toast({ title: `${uploadedCount} image${uploadedCount > 1 ? "s" : ""} uploaded` });
    }
  }, [project, user, imgUploads.length, loadDroneImages, onProjectUpdated, toast]);

  async function deleteFlightPlan(fp: FlightPlan) {
    await supabase.storage.from("flight-plans").remove([fp.file_path]);
    await supabase.from("flight_plans").delete().eq("id", fp.id);
    setFlightPlans((prev) => prev.filter((f) => f.id !== fp.id));
    toast({ title: "Flight plan deleted" });
  }

  async function deleteDroneImage(img: DroneImage) {
    if (!project || !user) return;
    const path = `${user.id}/${project.id}/${img.name}`;
    await supabase.storage.from("drone-images").remove([path]);
    setDroneImages((prev) => prev.filter((i) => i.name !== img.name));
    const newCount = Math.max(0, (project.image_count || 0) - 1);
    const { data: updated } = await supabase
      .from("projects")
      .update({ image_count: newCount })
      .eq("id", project.id)
      .select()
      .single();
    if (updated) onProjectUpdated(updated as Project);
    toast({ title: "Image deleted" });
  }

  async function submitForProcessing() {
    if (!project || !user) return;
    setSubmittingProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/process-project`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ project_id: project.id, subscription_tier: subscriptionTier }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to start processing");
      }

      const result = await res.json();
      const updated: Project = { ...project, status: "processing", progress: 0 };
      onProjectUpdated(updated);

      const priorityMsg = result.priority_processing
        ? "Priority processing enabled — your project is at the front of the queue."
        : "Your project is now in the processing queue. Progress will update in real-time.";
      toast({ title: "Processing started!", description: priorityMsg });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingProcessing(false);
    }
  }

  if (!project) return null;

  const isComplete = project.status === "complete";
  const isProcessing = project.status === "processing";
  const canProcess = project.status === "queued" || project.status === "failed";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Map className="w-4 h-4 text-primary" />
            {project.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={isComplete ? "outputs" : "flight-plan"} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="flight-plan" className="flex-1 gap-1.5">
              <FileArchive className="w-3.5 h-3.5" />
              Flight Plan
              {flightPlans.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-primary text-primary-foreground font-semibold">
                  {flightPlans.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="images" className="flex-1 gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              Drone Images
              {droneImages.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-primary text-primary-foreground font-semibold">
                  {droneImages.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="outputs" className="flex-1 gap-1.5">
              <Package className="w-3.5 h-3.5" />
              Outputs
              {isComplete && project.outputs && project.outputs.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-primary text-primary-foreground font-semibold">
                  {project.outputs.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* FLIGHT PLAN TAB */}
          <TabsContent value="flight-plan" className="flex-1 overflow-y-auto space-y-4 pt-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setFpDragging(true); }}
              onDragLeave={() => setFpDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setFpDragging(false);
                Array.from(e.dataTransfer.files).forEach(uploadFlightPlan);
              }}
              onClick={() => fpInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                fpDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-secondary/50"
              }`}
            >
              <input
                ref={fpInputRef}
                type="file"
                accept=".kml,.kmz"
                multiple
                className="hidden"
                onChange={(e) => Array.from(e.target.files || []).forEach(uploadFlightPlan)}
              />
              <FileArchive className={`w-8 h-8 mx-auto mb-2 transition-colors ${fpDragging ? "text-primary" : "text-muted-foreground"}`} />
              <p className="font-semibold text-sm text-foreground">
                {fpDragging ? "Drop KML/KMZ files here" : "Upload KML or KMZ flight plan"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                From Google Earth Pro · KML or KMZ format
              </p>
            </div>

            {fpUploads.length > 0 && (
              <div className="space-y-1.5">
                {fpUploads.map((u, i) => (
                  <UploadRow key={i} item={u} onDismiss={() => setFpUploads((prev) => prev.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}

            {loadingFP ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : flightPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No flight plans uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {flightPlans.map((fp) => (
                  <div key={fp.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2.5">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{fp.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {fp.file_type.toUpperCase()} · {formatBytes(fp.file_size)} · {formatDate(fp.created_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost" size="sm"
                      className="w-7 h-7 p-0 hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                      onClick={() => deleteFlightPlan(fp)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* DRONE IMAGES TAB */}
          <TabsContent value="images" className="flex-1 overflow-y-auto space-y-4 pt-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setImgDragging(true); }}
              onDragLeave={() => setImgDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setImgDragging(false);
                uploadImages(Array.from(e.dataTransfer.files));
              }}
              onClick={() => imgInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                imgDragging
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-accent/40 hover:bg-secondary/50"
              }`}
            >
              <input
                ref={imgInputRef}
                type="file"
                accept=".jpg,.jpeg,.tiff,.tif,.dng,.png"
                multiple
                className="hidden"
                onChange={(e) => uploadImages(Array.from(e.target.files || []))}
              />
              <UploadCloud className={`w-8 h-8 mx-auto mb-2 transition-colors ${imgDragging ? "text-accent" : "text-muted-foreground"}`} />
              <p className="font-semibold text-sm text-foreground">
                {imgDragging ? "Drop images here" : "Upload drone images"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPEG · TIFF · DNG · PNG · Up to 100 MB each
              </p>
            </div>

            {imgUploads.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {imgUploads.map((u, i) => (
                  <UploadRow key={i} item={u} onDismiss={() => setImgUploads((prev) => prev.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}

            {loadingImages ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : droneImages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No images uploaded yet.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground font-medium">{droneImages.length} image{droneImages.length !== 1 ? "s" : ""}</p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {droneImages.map((img) => (
                    <div key={img.id || img.name} className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2">
                      <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{img.name}</p>
                        {img.metadata?.size && (
                          <p className="text-xs text-muted-foreground">{formatBytes(img.metadata.size)}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost" size="sm"
                        className="w-6 h-6 p-0 hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                        onClick={() => deleteDroneImage(img)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* OUTPUTS TAB */}
          <TabsContent value="outputs" className="flex-1 overflow-y-auto space-y-4 pt-4">
            {isProcessing && (
              <div className="rounded-xl bg-accent/10 border border-accent/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-accent flex-shrink-0" />
                  <p className="text-sm font-semibold text-foreground">Processing in progress…</p>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-700"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{project.progress}% complete — outputs will appear here when ready</p>
              </div>
            )}

            {canProcess && (
              <div className="rounded-xl bg-secondary border border-border p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Play className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-700 text-foreground text-sm">Ready to Process</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Submit your project to generate orthomosaics, point clouds, DSM, DTM, contour lines, and a full flight report.
                  </p>
                </div>
                <Button
                  onClick={submitForProcessing}
                  disabled={submittingProcessing}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 active:scale-[0.97] transition-all"
                >
                  {submittingProcessing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Starting…</>
                  ) : (
                    <><Play className="w-4 h-4" />Submit for Processing</>
                  )}
                </Button>
              </div>
            )}

            {isComplete && project.outputs && project.outputs.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">{project.outputs.length} output files ready</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/viewer/${project.id}`)}
                    className="gap-1.5 text-xs hover:border-primary/40 hover:text-primary"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open Map Viewer
                  </Button>
                </div>
                <div className="space-y-2">
                  {project.outputs.map((output) => (
                    <OutputItem key={output} name={output} projectName={project.name} />
                  ))}
                </div>
              </>
            )}

            {isComplete && (!project.outputs || project.outputs.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">No outputs found for this project.</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
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
      {item.status === "error" && (
        <span className="text-destructive truncate max-w-[120px]">{item.error}</span>
      )}
      {(item.status === "done" || item.status === "error") && (
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground ml-1">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

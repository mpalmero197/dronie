import { useEffect, useMemo, useRef, useState } from "react";
import { Film, Loader2, Sparkles, Upload, AlertTriangle, CheckCircle2, Circle, XCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import {
  estimateFramePlan,
  extractFrames,
  describePlan,
  INGEST_LIMITS,
  probeVideoFile,
  transcodeVideoForBrowser,
  type FramePlan,
} from "@/lib/splatVideoIngest";

interface Props {
  projectId: string;
  disabled?: boolean;
  onJobCreated?: () => void;
}

type PresetOverride = "auto" | "draft" | "balanced" | "cinematic";

type StepKey = "extract" | "upload" | "dispatch" | "training";
type StepState = "pending" | "active" | "done" | "error";

const STEP_LABELS: Record<StepKey, string> = {
  extract: "Extract frames from video",
  upload: "Upload frames to cloud storage",
  dispatch: "Generate signed URLs & queue training",
  training: "Training started",
};
const STEP_ORDER: StepKey[] = ["extract", "upload", "dispatch", "training"];

const UPLOAD_ATTEMPTS = 3;

async function uploadFrame(path: string, frame: Blob): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt++) {
    const { error } = await supabase.storage
      .from("drone-images")
      .upload(path, frame, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      });
    if (!error || error.message.toLowerCase().includes("already exists")) return;
    lastError = new Error(error.message);
    if (attempt < UPLOAD_ATTEMPTS) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt * 750));
    }
  }
  throw lastError ?? new Error("A video frame could not be uploaded.");
}

async function functionErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: Response }).context;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as
        | { error?: unknown; message?: unknown }
        | null;
      const detail = payload?.message ?? payload?.error;
      if (typeof detail === "string") return detail;
    }
  }
  return error instanceof Error ? error.message : String(error);
}

async function validAccessToken(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error("Your session expired. Sign in again, then retry the conversion.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(
    sessionData.session.access_token,
  );
  if (!userError && userData.user) return sessionData.session.access_token;

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed.session?.access_token) {
    throw new Error("Your session expired. Sign in again, then retry the conversion.");
  }
  return refreshed.session.access_token;
}

export function VideoIngestDialog({ projectId, disabled, onJobCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [probeErr, setProbeErr] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ durationS: number; width: number; height: number } | null>(null);
  const [probing, setProbing] = useState(false);
  const [presetOverride, setPresetOverride] = useState<PresetOverride>("auto");
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState("");
  const [steps, setSteps] = useState<Record<StepKey, StepState>>({
    extract: "pending", upload: "pending", dispatch: "pending", training: "pending",
  });
  const [stepDetail, setStepDetail] = useState<Partial<Record<StepKey, string>>>({});
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const plan: FramePlan | null = useMemo(() => {
    if (!meta) return null;
    const p = estimateFramePlan(meta.durationS, meta.width, meta.height);
    if (presetOverride !== "auto") return { ...p, preset: presetOverride };
    return p;
  }, [meta, presetOverride]);

  const reset = () => {
    setFile(null);
    setMeta(null);
    setProbeErr(null);
    setProbing(false);
    setPct(0);
    setMsg("");
    setPresetOverride("auto");
    setSteps({ extract: "pending", upload: "pending", dispatch: "pending", training: "pending" });
    setStepDetail({});
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
  };

  const onPick = async (f: File | null) => {
    reset();
    if (!f) return;
    if (f.size > INGEST_LIMITS.maxFileBytes) {
      setProbeErr(`Video is ${(f.size / 1024 / 1024).toFixed(0)} MB — max ${INGEST_LIMITS.maxFileBytes / 1024 / 1024} MB.`);
      return;
    }
    setFile(f);
    setProbing(true);
    setPct(0);
    setMsg("Reading video metadata…");
    try {
      let videoFile = f;
      let m: { durationS: number; width: number; height: number };
      try {
        m = await probeVideoFile(videoFile);
      } catch {
        setMsg("Converting video to a compatible format…");
        videoFile = await transcodeVideoForBrowser(f, (p, m2) => {
          setPct(p);
          setMsg(m2);
        });
        m = await probeVideoFile(videoFile);
        setFile(videoFile);
      }
      if (!m.durationS || m.durationS < 3) {
        setProbeErr("Video is too short — need at least 3 seconds.");
        return;
      }
      setMeta(m);
    } catch (e) {
      setProbeErr(e instanceof Error ? e.message : "Could not read video metadata.");
    } finally {
      setProbing(false);
    }
  };

  const handleStart = async () => {
    if (!file || !plan || !user || !projectId) return;
    setBusy(true);
    const mark = (key: StepKey, state: StepState, detail?: string) => {
      setSteps((s) => ({ ...s, [key]: state }));
      if (detail !== undefined) setStepDetail((d) => ({ ...d, [key]: detail }));
    };
    let stage: StepKey = "extract";
    try {
      // 1. Extract frames locally.
      mark("extract", "active");
      const frames = await extractFrames(file, plan, (p, m) => {
        setPct(p);
        setMsg(m);
        setStepDetail((d) => ({ ...d, extract: m }));
      });
      mark("extract", "done", `${frames.length} frames extracted`);

      // 2. Upload to drone-images bucket with owner-scoped path.
      stage = "upload";
      mark("upload", "active");
      const jobStamp = Date.now().toString(36);
      const framePrefix = `${user.id}/${projectId}/video-${jobStamp}`;
      const total = frames.length;
      let done = 0;
      // Keep concurrency conservative: mobile browsers frequently terminate
      // several simultaneous storage requests with a generic "Failed to fetch".
      const concurrency = 2;
      let cursor = 0;

      const worker = async () => {
        while (cursor < total) {
          const i = cursor++;
          const name = `frame_${String(i + 1).padStart(5, "0")}.jpg`;
          const path = `${framePrefix}/${name}`;
          await uploadFrame(path, frames[i]);
          done++;
          const p = 80 + Math.round((done / total) * 18);
          setPct(p);
          setMsg(`Uploading frames… ${done}/${total}`);
          setStepDetail((d) => ({ ...d, upload: `${done}/${total} frames uploaded` }));
        }
      };
      await Promise.all(Array.from({ length: concurrency }, () => worker()));
      mark("upload", "done", `${total}/${total} frames uploaded`);

      // 3. Dispatch the cloud 3D conversion job.
      stage = "dispatch";
      mark("dispatch", "active", "Requesting signed frame URLs…");
      setMsg("Creating 3D splat…");
      const accessToken = await validAccessToken();
      const { error: fnErr } = await supabase.functions.invoke("train-splat", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          projectId,
          preset: plan.preset,
          sphDegree: 2,
          useGeoref: false, // video-derived frames have no RTK/EXIF poses
          source: "video",
          framePrefix,
          captureFlags: null,
        },
      });
      if (fnErr) throw new Error(await functionErrorMessage(fnErr));
      mark("dispatch", "done", "Signed URLs generated");
      mark("training", "done", "Training job queued — track progress below");
      setPct(100);

      track("splats_video_ingest", {
        projectId,
        durationS: Math.round(meta?.durationS ?? 0),
        width: meta?.width ?? 0,
        height: meta?.height ?? 0,
        frames: total,
        preset: plan.preset,
      });

      toast({
        title: "Video splat started",
        description: `${total} frames are being converted into a 3D Gaussian splat.`,
      });
      onJobCreated?.();
      setOpen(false);
      reset();
    } catch (e) {
      mark(stage, "error", e instanceof Error ? e.message : String(e));
      toast({
        title: "Could not process video",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!busy) {
          setOpen(o);
          if (!o) reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled} className="gap-1.5">
          <Film className="w-4 h-4" /> From video…
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-4 h-4 text-primary" /> Video → 3D Gaussian Splat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Upload a phone or drone clip and Dronie will turn extracted frames into a real 3D splat file.
            Longer, higher-resolution footage produces a denser splat.
            Keep the camera moving <em>around</em> the subject for best results.
          </p>

          <div className="rounded-lg border-2 border-dashed border-border p-4 text-center">
            <input
              id="splat-video-file"
              type="file"
              accept="video/*"
              disabled={busy}
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
            <label
              htmlFor="splat-video-file"
              className="flex flex-col items-center gap-1.5 cursor-pointer text-sm"
            >
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">{file ? file.name : "Choose video file"}</span>
              <span className="text-[10px] text-muted-foreground">
                MP4 / MOV / WebM · up to {INGEST_LIMITS.maxFileBytes / 1024 / 1024} MB
              </span>
            </label>
          </div>

          {probeErr && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-2.5 text-[11px] text-destructive">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{probeErr}</span>
            </div>
          )}

          {probing && (
            <div className="space-y-1.5 rounded-md border border-border bg-secondary/50 p-2.5">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{msg || "Reading video metadata…"}</span>
              </div>
              {pct > 0 && <Progress value={Math.max(0, pct)} />}
            </div>
          )}

          {meta && plan && (
            <div className="rounded-lg border border-border p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span className="font-mono">
                  {meta.width}×{meta.height} · {Math.round(meta.durationS)}s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Extraction plan</span>
                <span className="font-mono">{describePlan(plan)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sampling</span>
                <span className="font-mono">
                  {plan.fps.toFixed(2)} fps · ≤{plan.longEdgePx}px
                </span>
              </div>

              <div className="pt-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Quality preset
                </Label>
                <Select
                  value={presetOverride}
                  onValueChange={(v) => setPresetOverride(v as PresetOverride)}
                  disabled={busy}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto — recommended</SelectItem>
                    <SelectItem value="draft">Draft · faster conversion</SelectItem>
                    <SelectItem value="balanced">Balanced · more detail</SelectItem>
                    <SelectItem value="cinematic">Cinematic · highest detail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {busy && (
            <div className="space-y-1.5">
              <Progress value={Math.max(0, pct)} />
              <p className="text-[11px] text-muted-foreground">{msg || "Working…"}</p>
            </div>
          )}

          {(busy || Object.values(steps).some((s) => s !== "pending")) && (
            <ol className="space-y-1.5 rounded-lg border border-border bg-secondary/40 p-3">
              {STEP_ORDER.map((key) => {
                const state = steps[key];
                return (
                  <li key={key} className="flex items-start gap-2 text-[11px]">
                    {state === "done" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px text-primary" />
                    ) : state === "active" ? (
                      <Loader2 className="w-3.5 h-3.5 shrink-0 mt-px animate-spin text-amber-400" />
                    ) : state === "error" ? (
                      <XCircle className="w-3.5 h-3.5 shrink-0 mt-px text-destructive" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 shrink-0 mt-px text-muted-foreground/50" />
                    )}
                    <div className="min-w-0">
                      <p className={
                        state === "done" ? "text-foreground"
                          : state === "active" ? "text-amber-400 font-medium"
                            : state === "error" ? "text-destructive font-medium"
                              : "text-muted-foreground/70"
                      }>
                        {STEP_LABELS[key]}
                      </p>
                      {stepDetail[key] && (
                        <p className="text-[10px] text-muted-foreground break-words">{stepDetail[key]}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleStart}
            disabled={busy || probing || !file || !plan}
            className="gap-1.5"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Create 3D splat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
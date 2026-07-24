import { useEffect, useMemo, useRef, useState } from "react";
import { Film, Loader2, Sparkles, Upload, AlertTriangle } from "lucide-react";
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
import { probeVideo } from "@/lib/videoEditor/render";
import {
  estimateFramePlan, extractFrames, describePlan, INGEST_LIMITS, type FramePlan,
} from "@/lib/splatVideoIngest";

interface Props {
  projectId: string;
  disabled?: boolean;
  onJobCreated?: () => void;
}

type PresetOverride = "auto" | "draft" | "balanced" | "cinematic";

export function VideoIngestDialog({ projectId, disabled, onJobCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [probeErr, setProbeErr] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ durationS: number; width: number; height: number } | null>(null);
  const [presetOverride, setPresetOverride] = useState<PresetOverride>("auto");
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState("");
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
    setPct(0);
    setMsg("");
    setPresetOverride("auto");
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
    const url = URL.createObjectURL(f);
    previewUrlRef.current = url;
    try {
      const m = await probeVideo(url);
      if (!m.durationS || m.durationS < 3) {
        setProbeErr("Video is too short — need at least 3 seconds.");
        return;
      }
      setMeta(m);
    } catch (e) {
      setProbeErr(e instanceof Error ? e.message : "Could not read video metadata.");
    }
  };

  const handleStart = async () => {
    if (!file || !plan || !user || !projectId) return;
    setBusy(true);
    try {
      // 1. Extract frames locally.
      const frames = await extractFrames(file, plan, (p, m) => {
        setPct(p);
        setMsg(m);
      });

      // 2. Upload to drone-images bucket with owner-scoped path.
      const jobStamp = Date.now().toString(36);
      const framePrefix = `${user.id}/${projectId}/video-${jobStamp}`;
      const total = frames.length;
      let done = 0;
      const concurrency = 4;
      let cursor = 0;

      const worker = async () => {
        while (cursor < total) {
          const i = cursor++;
          const name = `frame_${String(i + 1).padStart(5, "0")}.jpg`;
          const path = `${framePrefix}/${name}`;
          const { error } = await supabase.storage
            .from("drone-images")
            .upload(path, frames[i], {
              contentType: "image/jpeg",
              cacheControl: "3600",
              upsert: true,
            });
          if (error) throw error;
          done++;
          const p = 80 + Math.round((done / total) * 18);
          setPct(p);
          setMsg(`Uploading frames… ${done}/${total}`);
        }
      };
      await Promise.all(Array.from({ length: concurrency }, () => worker()));

      // 3. Dispatch training job.
      setMsg("Queuing training…");
      const { error: fnErr } = await supabase.functions.invoke("train-splat", {
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
      if (fnErr) throw fnErr;

      track("splats_video_ingest", {
        projectId,
        durationS: Math.round(meta!.durationS),
        width: meta!.width,
        height: meta!.height,
        frames: total,
        preset: plan.preset,
      });

      toast({
        title: "Video splat queued",
        description: `${total} frames · ${plan.preset} preset.`,
      });
      onJobCreated?.();
      setOpen(false);
      reset();
    } catch (e) {
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
            <Film className="w-4 h-4 text-primary" /> Video → Gaussian Splat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Drop a phone or drone clip. Longer, higher-resolution footage produces a denser splat.
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
                    <SelectItem value="draft">Draft · ~1.5 min</SelectItem>
                    <SelectItem value="balanced">Balanced · ~6 min</SelectItem>
                    <SelectItem value="cinematic">Cinematic · ~12 min</SelectItem>
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
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleStart}
            disabled={busy || !file || !plan}
            className="gap-1.5"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Extract & train
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
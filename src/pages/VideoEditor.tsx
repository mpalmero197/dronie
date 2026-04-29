import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Trash2, Scissors, Type, Captions, Sparkles, Save, Download,
  Play, Pause, ChevronLeft, ChevronRight, Film, Loader2, Upload, Wand2,
} from "lucide-react";
import {
  Clip, EditorProject, FilterPreset, TextOverlay, TransitionKind,
  CaptionStyle, CaptionCue, clipStartGlobal, newId, totalDuration,
} from "@/lib/videoEditor/types";
import { probeVideo, renderProject } from "@/lib/videoEditor/render";
import { extractAudioBase64, transcribeAudio } from "@/lib/videoEditor/transcribe";
import { cuesToSrt } from "@/lib/videoEditor/ass";
import { PORTFOLIO_BUCKET, PortfolioItem } from "@/lib/portfolio";
import { captureVideoFrame } from "@/lib/videoFrame";

const TRANSITIONS: { value: TransitionKind; label: string }[] = [
  { value: "none", label: "Cut" },
  { value: "fade", label: "Fade" },
  { value: "dissolve", label: "Dissolve" },
  { value: "wipeleft", label: "Wipe ←" },
  { value: "wiperight", label: "Wipe →" },
  { value: "slideleft", label: "Slide ←" },
  { value: "slideright", label: "Slide →" },
  { value: "fadeblack", label: "Fade to Black" },
  { value: "fadewhite", label: "Fade to White" },
];

const FILTERS: { value: FilterPreset; label: string }[] = [
  { value: "none", label: "None" },
  { value: "warm", label: "Warm" },
  { value: "cool", label: "Cool" },
  { value: "cinematic", label: "Cinematic" },
  { value: "bw", label: "B&W" },
  { value: "vivid", label: "Vivid" },
  { value: "vintage", label: "Vintage" },
];

const CAPTION_STYLES: { value: CaptionStyle; label: string; sample: string }[] = [
  { value: "classic", label: "Classic CC (white box)", sample: "bg-black/85 text-white px-2 py-0.5" },
  { value: "yellow", label: "Yellow outlined", sample: "text-yellow-300 [text-shadow:1px_1px_0_#000,-1px_-1px_0_#000]" },
  { value: "outline", label: "White outlined", sample: "text-white [text-shadow:1px_1px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000]" },
  { value: "boxed", label: "Heavy box", sample: "bg-black text-white px-3 py-1" },
  { value: "minimal", label: "Minimal", sample: "text-white" },
];

function fmt(sec: number) {
  if (!isFinite(sec)) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec - Math.floor(sec)) * 10);
  return `${m}:${String(s).padStart(2, "0")}.${ms}`;
}

export default function VideoEditor() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId: string }>();
  const [search] = useSearchParams();

  const [project, setProject] = useState<EditorProject>({
    id: newId(),
    name: "Untitled edit",
    width: 1920,
    height: 1080,
    fps: 30,
    clips: [],
    texts: [],
    captions: { enabled: true, burnIn: true, style: "classic", fontSize: 48, position: "bottom", cues: [] },
    audioVolume: 1,
  });

  const [selectedClipIdx, setSelectedClipIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<"clips" | "text" | "captions" | "effects">("clips");

  const [rendering, setRendering] = useState(false);
  const [renderPct, setRenderPct] = useState(0);
  const [renderMsg, setRenderMsg] = useState("");
  const [renderedBlob, setRenderedBlob] = useState<Blob | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const previewRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Auth gate
  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  // Bootstrap: load source item if itemId provided
  useEffect(() => {
    (async () => {
      if (!itemId || !user) return;
      const { data, error } = await supabase
        .from("portfolio_items")
        .select("*")
        .eq("id", itemId)
        .maybeSingle();
      if (error || !data) return;
      const item = data as PortfolioItem;
      if (item.kind !== "video" || !item.media_url) return;
      try {
        const probe = await probeVideo(item.media_url);
        const clip: Clip = {
          id: newId(),
          src: item.media_url,
          name: item.title || "source.mp4",
          durationS: probe.durationS,
          inS: 0,
          outS: probe.durationS,
          speed: 1,
          volume: 1,
          filter: "none",
          transitionToNext: "fade",
          transitionDurS: 0.6,
          width: probe.width,
          height: probe.height,
        };
        setProject((p) => ({
          ...p,
          name: item.title ? `${item.title} (edit)` : p.name,
          width: probe.width || p.width,
          height: probe.height || p.height,
          clips: [clip],
          sourceItemId: item.id,
        }));
      } catch (e) {
        console.warn("probe failed", e);
      }
    })();
  }, [itemId, user]);

  // Preview sync — drive previewRef for the selected clip
  useEffect(() => {
    const v = previewRef.current;
    if (!v) return;
    const onTime = () => {
      const c = project.clips[selectedClipIdx];
      if (!c) return;
      const localOffset = clipStartGlobal(project, selectedClipIdx);
      // Map preview's currentTime back to global timeline (rough; preview shows raw clip).
      const t = localOffset + (v.currentTime - c.inS) / Math.max(0.1, c.speed);
      setCurrentTime(Math.max(0, t));
      // Auto-stop at out point
      if (v.currentTime >= c.outS) {
        v.pause();
        setPlaying(false);
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [selectedClipIdx, project]);

  const total = totalDuration(project);
  const selectedClip = project.clips[selectedClipIdx];

  // ===== File handling =====
  const onAddFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("video/")) {
        toast({ title: "Only videos can be added", variant: "destructive" });
        continue;
      }
      const url = URL.createObjectURL(f);
      try {
        const probe = await probeVideo(url);
        const c: Clip = {
          id: newId(), src: url, name: f.name,
          durationS: probe.durationS,
          inS: 0, outS: probe.durationS,
          speed: 1, volume: 1, filter: "none",
          transitionToNext: "fade", transitionDurS: 0.6,
          width: probe.width, height: probe.height,
        };
        setProject((p) => ({
          ...p,
          clips: [...p.clips, c],
          width: p.clips.length === 0 ? probe.width : p.width,
          height: p.clips.length === 0 ? probe.height : p.height,
        }));
      } catch {
        toast({ title: `Could not load ${f.name}`, variant: "destructive" });
      }
    }
  };

  const updateClip = (idx: number, patch: Partial<Clip>) => {
    setProject((p) => ({
      ...p,
      clips: p.clips.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));
  };

  const removeClip = (idx: number) => {
    setProject((p) => ({ ...p, clips: p.clips.filter((_, i) => i !== idx) }));
    setSelectedClipIdx((i) => Math.max(0, Math.min(i, project.clips.length - 2)));
  };

  const moveClip = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= project.clips.length) return;
    setProject((p) => {
      const arr = [...p.clips];
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...p, clips: arr };
    });
    setSelectedClipIdx(j);
  };

  const sliceAtPlayhead = () => {
    const c = selectedClip;
    if (!c) return;
    const v = previewRef.current;
    if (!v) return;
    const cut = v.currentTime;
    if (cut <= c.inS + 0.05 || cut >= c.outS - 0.05) {
      toast({ title: "Move the playhead inside the clip first" });
      return;
    }
    const left: Clip = { ...c, id: newId(), outS: cut };
    const right: Clip = { ...c, id: newId(), inS: cut, transitionToNext: "none" };
    setProject((p) => {
      const arr = [...p.clips];
      arr.splice(selectedClipIdx, 1, left, right);
      return { ...p, clips: arr };
    });
    toast({ title: "Clip sliced" });
  };

  // ===== Text overlays =====
  const addText = () => {
    const t: TextOverlay = {
      id: newId(),
      text: "Your text",
      startS: Math.max(0, currentTime),
      endS: Math.min(total || 5, currentTime + 3),
      x: 0.5, y: 0.85, fontSize: 64,
      color: "#ffffff", bgColor: "#000000", bgOpacity: 0.0,
      weight: "bold", fontFamily: "Sans", align: "center",
    };
    setProject((p) => ({ ...p, texts: [...p.texts, t] }));
    setActiveTab("text");
  };

  const updateText = (id: string, patch: Partial<TextOverlay>) =>
    setProject((p) => ({ ...p, texts: p.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const removeText = (id: string) =>
    setProject((p) => ({ ...p, texts: p.texts.filter((t) => t.id !== id) }));

  // ===== Captions =====
  const updateCaptions = (patch: Partial<typeof project.captions>) =>
    setProject((p) => ({ ...p, captions: { ...p.captions, ...patch } }));
  const addCue = () => {
    const cue: CaptionCue = { id: newId(), startS: currentTime, endS: currentTime + 2, text: "" };
    updateCaptions({ cues: [...project.captions.cues, cue] });
  };
  const updateCue = (id: string, patch: Partial<CaptionCue>) =>
    updateCaptions({ cues: project.captions.cues.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const removeCue = (id: string) =>
    updateCaptions({ cues: project.captions.cues.filter((c) => c.id !== id) });

  const autoTranscribe = async () => {
    if (project.clips.length === 0) return;
    setTranscribing(true);
    setRenderMsg("Extracting audio…");
    try {
      // For simplicity, transcribe the first clip's source audio.
      const first = project.clips[0];
      const { b64, mime } = await extractAudioBase64(first.src, first.name);
      setRenderMsg("Transcribing with AI…");
      const cues = await transcribeAudio(b64, mime, first.durationS);
      const mapped: CaptionCue[] = cues.map((c) => ({
        id: newId(), startS: c.startS, endS: c.endS, text: c.text,
      }));
      updateCaptions({ cues: mapped, enabled: true });
      toast({ title: `Generated ${mapped.length} caption cues` });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Transcription failed";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setTranscribing(false);
      setRenderMsg("");
    }
  };

  // ===== Render =====
  const doRender = async () => {
    if (project.clips.length === 0) {
      toast({ title: "Add at least one clip" });
      return;
    }
    setRendering(true);
    setRenderPct(0);
    setRenderMsg("Loading editor engine…");
    try {
      const blob = await renderProject(project, (pct, msg) => {
        if (pct >= 0) setRenderPct(pct);
        if (msg) setRenderMsg(msg);
      });
      setRenderedBlob(blob);
      setSaveOpen(true);
    } catch (e) {
      console.error(e);
      toast({ title: e instanceof Error ? e.message : "Render failed", variant: "destructive" });
    } finally {
      setRendering(false);
    }
  };

  const downloadBlob = () => {
    if (!renderedBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(renderedBlob);
    a.download = `${project.name.replace(/\s+/g, "_") || "edit"}.mp4`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  };

  const downloadCaptions = () => {
    const srt = cuesToSrt(project.captions.cues);
    const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name.replace(/\s+/g, "_") || "edit"}.srt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  };

  const saveToPortfolio = async (mode: "replace" | "new") => {
    if (!renderedBlob || !user) return;
    setSaveOpen(false);
    setRendering(true);
    setRenderMsg("Uploading to portfolio…");
    try {
      const path = `${user.id}/edits/${Date.now()}.mp4`;
      const { error: upErr } = await supabase.storage.from(PORTFOLIO_BUCKET).upload(path, renderedBlob, {
        contentType: "video/mp4", upsert: true,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(path);
      const url = pub.publicUrl;

      // Generate poster from first frame
      let thumbUrl: string | null = null;
      try {
        const objUrl = URL.createObjectURL(renderedBlob);
        const poster = await captureVideoFrame(objUrl, { time: 0.5 });
        URL.revokeObjectURL(objUrl);
        if (poster?.blob) {
          const posterPath = `${user.id}/edits/${Date.now()}_poster.jpg`;
          const up2 = await supabase.storage.from(PORTFOLIO_BUCKET).upload(posterPath, poster.blob, {
            contentType: "image/jpeg", upsert: true,
          });
          if (!up2.error) {
            const { data: pub2 } = supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(posterPath);
            thumbUrl = pub2.publicUrl;
          }
        }
      } catch (e) {
        console.warn("poster failed", e);
      }

      if (mode === "replace" && project.sourceItemId) {
        const { error: updErr } = await supabase
          .from("portfolio_items")
          .update({ media_url: url, thumb_url: thumbUrl ?? undefined, storage_path: path, title: project.name })
          .eq("id", project.sourceItemId);
        if (updErr) throw updErr;
        toast({ title: "Saved over the original" });
      } else {
        const { error: insErr } = await supabase
          .from("portfolio_items")
          .insert({
            user_id: user.id,
            kind: "video",
            media_url: url,
            thumb_url: thumbUrl,
            storage_path: path,
            title: project.name,
            visibility: "public",
          });
        if (insErr) throw insErr;
        toast({ title: "Saved as a new portfolio item" });
      }

      navigate("/portfolio");
    } catch (e) {
      console.error(e);
      toast({ title: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setRendering(false);
    }
  };

  // ===== Preview overlay text rendering =====
  const previewTexts = project.texts.filter((t) => currentTime >= t.startS && currentTime <= t.endS);
  const previewCue = project.captions.enabled
    ? project.captions.cues.find((c) => currentTime >= c.startS && currentTime <= c.endS)
    : null;
  const captionStyle = CAPTION_STYLES.find((s) => s.value === project.captions.style)!;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/85 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/portfolio" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Studio
          </Link>
          <div className="h-5 w-px bg-border mx-1" />
          <Film className="w-4 h-4 text-primary" />
          <Input
            value={project.name}
            onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))}
            className="h-8 w-[260px] font-display"
          />
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {project.width}×{project.height} · {project.fps}fps · {fmt(total)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={downloadCaptions} disabled={project.captions.cues.length === 0}>
              .srt
            </Button>
            <Button onClick={doRender} disabled={rendering || project.clips.length === 0} className="gap-1.5">
              {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {rendering ? "Rendering…" : "Render & Save"}
            </Button>
          </div>
        </div>
        {rendering && (
          <div className="max-w-[1600px] mx-auto px-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Loader2 className="w-3 h-3 animate-spin" /> {renderMsg}
              <span className="ml-auto">{renderPct}%</span>
            </div>
            <Progress value={renderPct} />
          </div>
        )}
      </header>

      <div className="max-w-[1600px] mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        {/* Preview + Timeline */}
        <div className="space-y-3">
          <div className="relative bg-black rounded-xl overflow-hidden border border-border" style={{ aspectRatio: `${project.width}/${project.height}` }}>
            {selectedClip ? (
              <video
                ref={previewRef}
                src={selectedClip.src}
                className="absolute inset-0 w-full h-full object-contain"
                playsInline
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm flex-col gap-3">
                <Film className="w-10 h-10 opacity-50" />
                Add a clip to begin
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5 mr-1.5" /> Add clip
                </Button>
              </div>
            )}

            {/* Text overlay preview */}
            {previewTexts.map((t) => (
              <div
                key={t.id}
                style={{
                  position: "absolute",
                  left: `${t.x * 100}%`,
                  top: `${t.y * 100}%`,
                  transform: "translate(-50%,-50%)",
                  fontSize: `${(t.fontSize / project.height) * 100}cqh`,
                  color: t.color,
                  fontWeight: t.weight,
                  fontFamily: t.fontFamily === "Serif" ? "Georgia,serif" : t.fontFamily === "Mono" ? "Menlo,monospace" : "Inter,sans-serif",
                  background: t.bgOpacity > 0 ? `${t.bgColor}${Math.round(t.bgOpacity * 255).toString(16).padStart(2, "0")}` : "transparent",
                  padding: t.bgOpacity > 0 ? "0.2em 0.5em" : 0,
                  textAlign: t.align,
                  whiteSpace: "pre-wrap",
                  pointerEvents: "none",
                }}
              >
                {t.text}
              </div>
            ))}

            {/* Caption preview */}
            {previewCue && (
              <div
                className="absolute left-1/2 -translate-x-1/2 max-w-[80%] text-center pointer-events-none"
                style={{ [project.captions.position === "top" ? "top" : "bottom"]: "5%" }}
              >
                <span className={`inline-block text-base sm:text-lg font-semibold rounded ${captionStyle.sample}`} style={{ fontSize: `${(project.captions.fontSize / project.height) * 100}cqh` }}>
                  {previewCue.text}
                </span>
              </div>
            )}
          </div>

          {/* Transport */}
          <div className="flex items-center gap-2 text-sm">
            <Button size="sm" variant="outline" onClick={() => {
              const v = previewRef.current; if (!v) return;
              if (playing) v.pause(); else v.play();
            }} disabled={!selectedClip}>
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button size="sm" variant="outline" onClick={sliceAtPlayhead} disabled={!selectedClip}>
              <Scissors className="w-4 h-4 mr-1.5" /> Slice
            </Button>
            <Button size="sm" variant="outline" onClick={addText} disabled={!selectedClip}>
              <Type className="w-4 h-4 mr-1.5" /> Add text
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              {fmt(currentTime)} / {fmt(total)}
            </span>
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Timeline</p>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => fileRef.current?.click()}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add clip
              </Button>
              <input ref={fileRef} type="file" multiple accept="video/*" hidden onChange={(e) => onAddFiles(e.target.files)} />
            </div>
            {project.clips.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No clips yet.</p>
            ) : (
              <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
                {project.clips.map((c, i) => {
                  const lenS = (c.outS - c.inS) / Math.max(0.1, c.speed);
                  const widthPx = Math.max(80, Math.min(400, lenS * 35));
                  const selected = i === selectedClipIdx;
                  return (
                    <div key={c.id} className="flex items-stretch">
                      <button
                        onClick={() => {
                          setSelectedClipIdx(i);
                          const v = previewRef.current;
                          if (v) { v.currentTime = c.inS; }
                        }}
                        className={`relative h-20 rounded-lg overflow-hidden border text-left flex flex-col justify-end px-2 py-1.5 transition-colors ${
                          selected ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"
                        }`}
                        style={{ width: `${widthPx}px`, background: "linear-gradient(135deg,hsl(var(--primary)/0.15),hsl(var(--accent)/0.1))" }}
                      >
                        <Film className="w-3.5 h-3.5 text-primary absolute top-1.5 left-1.5" />
                        <span className="text-[10px] font-semibold truncate">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground">{fmt(lenS)} · {c.filter !== "none" ? c.filter : "raw"}</span>
                      </button>
                      {i < project.clips.length - 1 && (
                        <div className="flex flex-col items-center justify-center px-1">
                          <Select value={c.transitionToNext} onValueChange={(v) => updateClip(i, { transitionToNext: v as TransitionKind })}>
                            <SelectTrigger className="h-6 w-[88px] text-[10px] px-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TRANSITIONS.map((t) => (
                                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        <aside className="space-y-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="clips" className="text-xs"><Scissors className="w-3.5 h-3.5 mr-1" />Clip</TabsTrigger>
              <TabsTrigger value="text" className="text-xs"><Type className="w-3.5 h-3.5 mr-1" />Text</TabsTrigger>
              <TabsTrigger value="captions" className="text-xs"><Captions className="w-3.5 h-3.5 mr-1" />CC</TabsTrigger>
              <TabsTrigger value="effects" className="text-xs"><Sparkles className="w-3.5 h-3.5 mr-1" />FX</TabsTrigger>
            </TabsList>

            {/* Clip panel */}
            <TabsContent value="clips" className="space-y-3">
              {selectedClip ? (
                <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold truncate">{selectedClip.name}</p>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveClip(selectedClipIdx, -1)} disabled={selectedClipIdx === 0}><ChevronLeft className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveClip(selectedClipIdx, 1)} disabled={selectedClipIdx >= project.clips.length - 1}><ChevronRight className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeClip(selectedClipIdx)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Trim ({fmt(selectedClip.inS)} → {fmt(selectedClip.outS)})</Label>
                    <div className="space-y-2 mt-1.5">
                      <Slider min={0} max={selectedClip.durationS} step={0.05} value={[selectedClip.inS]}
                        onValueChange={([v]) => updateClip(selectedClipIdx, { inS: Math.min(v, selectedClip.outS - 0.1) })} />
                      <Slider min={0} max={selectedClip.durationS} step={0.05} value={[selectedClip.outS]}
                        onValueChange={([v]) => updateClip(selectedClipIdx, { outS: Math.max(v, selectedClip.inS + 0.1) })} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Speed ({selectedClip.speed.toFixed(2)}×)</Label>
                    <Slider className="mt-1.5" min={0.25} max={2.5} step={0.05} value={[selectedClip.speed]}
                      onValueChange={([v]) => updateClip(selectedClipIdx, { speed: v })} />
                  </div>
                  <div>
                    <Label className="text-xs">Volume ({Math.round(selectedClip.volume * 100)}%)</Label>
                    <Slider className="mt-1.5" min={0} max={2} step={0.05} value={[selectedClip.volume]}
                      onValueChange={([v]) => updateClip(selectedClipIdx, { volume: v })} />
                  </div>
                  <div>
                    <Label className="text-xs">Filter</Label>
                    <Select value={selectedClip.filter} onValueChange={(v) => updateClip(selectedClipIdx, { filter: v as FilterPreset })}>
                      <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedClipIdx < project.clips.length - 1 && (
                    <div>
                      <Label className="text-xs">Transition out ({selectedClip.transitionDurS.toFixed(1)}s)</Label>
                      <Slider className="mt-1.5" min={0.2} max={2} step={0.1} value={[selectedClip.transitionDurS]}
                        onValueChange={([v]) => updateClip(selectedClipIdx, { transitionDurS: v })} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-6">No clip selected.</p>
              )}
            </TabsContent>

            {/* Text panel */}
            <TabsContent value="text" className="space-y-2">
              <Button size="sm" variant="outline" className="w-full" onClick={addText}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add text overlay
              </Button>
              {project.texts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No text overlays yet.</p>
              )}
              {project.texts.map((t) => (
                <div key={t.id} className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Text</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeText(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                  <Textarea value={t.text} onChange={(e) => updateText(t.id, { text: e.target.value })} className="min-h-[50px] text-xs" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Start ({fmt(t.startS)})</Label>
                      <Slider min={0} max={Math.max(total, 1)} step={0.1} value={[t.startS]}
                        onValueChange={([v]) => updateText(t.id, { startS: v })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">End ({fmt(t.endS)})</Label>
                      <Slider min={0} max={Math.max(total, 1)} step={0.1} value={[t.endS]}
                        onValueChange={([v]) => updateText(t.id, { endS: v })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">X ({Math.round(t.x * 100)}%)</Label>
                      <Slider min={0} max={1} step={0.01} value={[t.x]} onValueChange={([v]) => updateText(t.id, { x: v })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">Y ({Math.round(t.y * 100)}%)</Label>
                      <Slider min={0} max={1} step={0.01} value={[t.y]} onValueChange={([v]) => updateText(t.id, { y: v })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">Size ({t.fontSize}px)</Label>
                      <Slider min={20} max={200} step={2} value={[t.fontSize]} onValueChange={([v]) => updateText(t.id, { fontSize: v })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">BG Opacity</Label>
                      <Slider min={0} max={1} step={0.05} value={[t.bgOpacity]} onValueChange={([v]) => updateText(t.id, { bgOpacity: v })} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="color" value={t.color} onChange={(e) => updateText(t.id, { color: e.target.value })} className="h-7 w-10 rounded cursor-pointer bg-transparent" title="Text color" />
                    <input type="color" value={t.bgColor} onChange={(e) => updateText(t.id, { bgColor: e.target.value })} className="h-7 w-10 rounded cursor-pointer bg-transparent" title="Background color" />
                    <Select value={t.fontFamily} onValueChange={(v) => updateText(t.id, { fontFamily: v as TextOverlay["fontFamily"] })}>
                      <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sans">Sans</SelectItem>
                        <SelectItem value="Serif">Serif</SelectItem>
                        <SelectItem value="Mono">Mono</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={t.weight} onValueChange={(v) => updateText(t.id, { weight: v as "normal" | "bold" })}>
                      <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="bold">Bold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* Captions panel */}
            <TabsContent value="captions" className="space-y-3">
              <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Show captions</Label>
                  <Switch checked={project.captions.enabled} onCheckedChange={(v) => updateCaptions({ enabled: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Burn into video</Label>
                  <Switch checked={project.captions.burnIn} onCheckedChange={(v) => updateCaptions({ burnIn: v })} />
                </div>
                <div>
                  <Label className="text-xs">Style</Label>
                  <Select value={project.captions.style} onValueChange={(v) => updateCaptions({ style: v as CaptionStyle })}>
                    <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAPTION_STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Size ({project.captions.fontSize}px)</Label>
                    <Slider min={24} max={96} step={2} value={[project.captions.fontSize]} onValueChange={([v]) => updateCaptions({ fontSize: v })} />
                  </div>
                  <div>
                    <Label className="text-xs">Position</Label>
                    <Select value={project.captions.position} onValueChange={(v) => updateCaptions({ position: v as "top" | "bottom" })}>
                      <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom">Bottom</SelectItem>
                        <SelectItem value="top">Top</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={autoTranscribe} disabled={transcribing || project.clips.length === 0}>
                  {transcribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  Auto-transcribe with AI
                </Button>
                <Button size="sm" variant="ghost" className="w-full" onClick={addCue}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add cue at playhead
                </Button>
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {project.captions.cues.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border bg-secondary/20 p-2 space-y-1.5">
                    <Input className="h-7 text-xs" value={c.text} onChange={(e) => updateCue(c.id, { text: e.target.value })} placeholder="Caption text" />
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Input type="number" step="0.1" className="h-6 w-16 text-[10px]" value={c.startS.toFixed(1)} onChange={(e) => updateCue(c.id, { startS: parseFloat(e.target.value) || 0 })} />
                      <span>→</span>
                      <Input type="number" step="0.1" className="h-6 w-16 text-[10px]" value={c.endS.toFixed(1)} onChange={(e) => updateCue(c.id, { endS: parseFloat(e.target.value) || 0 })} />
                      <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto text-destructive" onClick={() => removeCue(c.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {project.captions.cues.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No cues yet. Auto-transcribe to start.</p>
                )}
              </div>
            </TabsContent>

            {/* Effects panel */}
            <TabsContent value="effects" className="space-y-3">
              <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-3">
                <div>
                  <Label className="text-xs">Master volume ({Math.round(project.audioVolume * 100)}%)</Label>
                  <Slider className="mt-1.5" min={0} max={2} step={0.05} value={[project.audioVolume]} onValueChange={([v]) => setProject((p) => ({ ...p, audioVolume: v }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Width</Label>
                    <Input type="number" className="h-8 mt-1" value={project.width} onChange={(e) => setProject((p) => ({ ...p, width: parseInt(e.target.value) || 1920 }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Height</Label>
                    <Input type="number" className="h-8 mt-1" value={project.height} onChange={(e) => setProject((p) => ({ ...p, height: parseInt(e.target.value) || 1080 }))} />
                  </div>
                  <div>
                    <Label className="text-xs">FPS</Label>
                    <Select value={String(project.fps)} onValueChange={(v) => setProject((p) => ({ ...p, fps: parseInt(v) }))}>
                      <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24">24</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                        <SelectItem value="60">60</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Filters and per-clip effects live in the Clip tab. Rendering happens in your browser — for long videos use 720p/30fps for best speed.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Render complete</DialogTitle>
            <DialogDescription>Where would you like the edited video to go?</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button variant="outline" className="w-full gap-2" onClick={downloadBlob}>
              <Download className="w-4 h-4" /> Download MP4
            </Button>
            {project.sourceItemId && (
              <Button className="w-full gap-2" onClick={() => saveToPortfolio("replace")}>
                <Save className="w-4 h-4" /> Replace original portfolio item
              </Button>
            )}
            <Button className="w-full gap-2" onClick={() => saveToPortfolio("new")}>
              <Plus className="w-4 h-4" /> Save as new portfolio item
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
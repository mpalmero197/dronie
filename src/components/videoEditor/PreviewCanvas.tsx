import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { EditorProject } from "@/lib/videoEditor/types";
import { resolvePlayhead } from "@/lib/videoEditor/timeline";
import { PreviewSources, drawFrame } from "@/lib/videoEditor/preview";

interface Props {
  project: EditorProject;
  timeS: number;
  playing: boolean;
  /** Draft mode renders at half resolution for smoother scrubbing. */
  draft: boolean;
  onTimeChange: (t: number) => void;
  onEnded: () => void;
}

export interface PreviewHandle {
  /** Current composited frame as a data URL (used for posters). */
  snapshot: () => string | null;
}

/**
 * Composited preview: the active clip plus crop, zoom, colour, overlays,
 * captions and watermark, drawn to a canvas so the preview matches the export.
 */
const PreviewCanvas = forwardRef<PreviewHandle, Props>(function PreviewCanvas(
  { project, timeS, playing, draft, onTimeChange, onEnded },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourcesRef = useRef<PreviewSources>({ video: new Map(), watermark: null });
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const timeRef = useRef(timeS);
  const audioRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  timeRef.current = timeS;

  const clipKey = useMemo(() => project.clips.map((c) => `${c.id}:${c.src}`).join("|"), [project.clips]);
  const bedKey = useMemo(() => project.audioTracks.map((t) => `${t.id}:${t.src}`).join("|"), [project.audioTracks]);

  useImperativeHandle(ref, () => ({
    snapshot: () => {
      try { return canvasRef.current?.toDataURL("image/jpeg", 0.85) ?? null; } catch { return null; }
    },
  }));

  // Keep one hydrated <video> per clip source.
  useEffect(() => {
    const pool = sourcesRef.current.video;
    const wanted = new Set(project.clips.map((c) => c.id));
    for (const [id, el] of pool) {
      if (!wanted.has(id)) {
        el.pause();
        el.removeAttribute("src");
        el.load();
        pool.delete(id);
      }
    }
    for (const c of project.clips) {
      if (pool.has(c.id)) continue;
      const v = document.createElement("video");
      v.src = c.src;
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      if (!c.src.startsWith("blob:")) v.crossOrigin = "anonymous";
      v.load();
      pool.set(c.id, v);
    }
  }, [clipKey, project.clips]);

  // Audio beds are played back with plain <audio> elements during preview.
  useEffect(() => {
    const pool = audioRef.current;
    const wanted = new Set(project.audioTracks.map((t) => t.id));
    for (const [id, el] of pool) {
      if (!wanted.has(id)) { el.pause(); pool.delete(id); }
    }
    for (const t of project.audioTracks) {
      if (pool.has(t.id)) continue;
      const a = new Audio(t.src);
      a.preload = "auto";
      pool.set(t.id, a);
    }
    return () => { for (const el of pool.values()) el.pause(); };
  }, [bedKey, project.audioTracks]);

  // Watermark image
  useEffect(() => {
    if (!project.watermark.src) {
      sourcesRef.current.watermark = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = project.watermark.src;
    sourcesRef.current.watermark = img;
  }, [project.watermark.src]);

  // Canvas sizing follows the project aspect, capped for performance.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cap = draft ? 640 : 1280;
    const scale = Math.min(1, cap / Math.max(project.width, project.height));
    canvas.width = Math.max(2, Math.round(project.width * scale));
    canvas.height = Math.max(2, Math.round(project.height * scale));
  }, [project.width, project.height, draft]);

  // Seek the active clip whenever the playhead moves while paused.
  useEffect(() => {
    if (playing) return;
    const at = resolvePlayhead(project, timeS);
    if (!at) return;
    const v = sourcesRef.current.video.get(at.clip.id);
    if (!v) return;
    if (Math.abs(v.currentTime - at.sourceTimeS) > 0.03) v.currentTime = at.sourceTimeS;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      const paint = () => drawFrame(ctx, project, timeS, sourcesRef.current);
      paint();
      const t = window.setTimeout(paint, 120); // repaint once the seek settles
      return () => window.clearTimeout(t);
    }
  }, [timeS, playing, project]);

  // Playback loop — advances the playhead in wall-clock time and keeps the
  // active clip's video element (and any audio beds) in sync with it.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pool = sourcesRef.current.video;

    if (!playing) {
      for (const v of pool.values()) v.pause();
      for (const a of audioRef.current.values()) a.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    lastTickRef.current = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.25, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;

      const next = timeRef.current + dt;
      const at = resolvePlayhead(project, next);

      if (!at) { onEnded(); return; }

      // Sync the active clip; pause everything else.
      for (const [id, v] of pool) {
        if (id === at.clip.id) continue;
        if (!v.paused) v.pause();
      }
      const active = pool.get(at.clip.id);
      if (active) {
        active.playbackRate = Math.max(0.25, Math.min(4, at.clip.speed));
        active.muted = at.clip.volume === 0 || project.audioVolume === 0;
        active.volume = Math.max(0, Math.min(1, at.clip.volume * project.audioVolume));
        if (at.frozen) {
          if (!active.paused) active.pause();
        } else {
          if (Math.abs(active.currentTime - at.sourceTimeS) > 0.25) active.currentTime = at.sourceTimeS;
          if (active.paused) void active.play().catch(() => { /* autoplay guard */ });
        }
      }

      // Audio beds
      for (const t of project.audioTracks) {
        const el = audioRef.current.get(t.id);
        if (!el) continue;
        const end = t.startS + (t.outS - t.inS);
        const inWindow = next >= t.startS && next < end && !t.muted;
        if (!inWindow) { if (!el.paused) el.pause(); continue; }
        el.volume = Math.max(0, Math.min(1, t.gain * project.audioVolume));
        const want = t.inS + (next - t.startS);
        if (Math.abs(el.currentTime - want) > 0.3) el.currentTime = want;
        if (el.paused) void el.play().catch(() => { /* autoplay guard */ });
      }

      drawFrame(ctx, project, next, sourcesRef.current);
      onTimeChange(next);
      timeRef.current = next;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, project, onTimeChange, onEnded]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-contain"
      aria-label="Video preview"
    />
  );
});

export default PreviewCanvas;
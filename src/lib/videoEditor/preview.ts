/**
 * Canvas preview compositor.
 *
 * Draws whatever the playhead is sitting on — the active clip with its crop,
 * rotation, Ken Burns framing and colour grade, plus text overlays, captions
 * and the watermark — so the preview matches what the render produces.
 */
import { CaptionStyle, Clip, EditorProject, TextOverlay } from "./types";
import { clipPlacements, resolvePlayhead } from "./timeline";

export interface PreviewSources {
  /** Video element per clip id, kept hot so seeking stays fast. */
  video: Map<string, HTMLVideoElement>;
  watermark: HTMLImageElement | null;
}

function fontFor(t: TextOverlay, scale: number): string {
  const family =
    t.fontFamily === "Serif" ? "Georgia, serif" :
    t.fontFamily === "Mono" ? "Menlo, monospace" :
    "Inter, system-ui, sans-serif";
  return `${t.weight === "bold" ? "700" : "400"} ${Math.round(t.fontSize * scale)}px ${family}`;
}

function cssFilterFor(c: Clip): string {
  const parts: string[] = [];
  const { exposure, contrast, saturation, temperature } = c.color;
  if (exposure !== 0) parts.push(`brightness(${(1 + exposure).toFixed(3)})`);
  if (contrast !== 1) parts.push(`contrast(${contrast.toFixed(3)})`);
  if (saturation !== 1) parts.push(`saturate(${saturation.toFixed(3)})`);
  if (temperature !== 0) parts.push(`sepia(${Math.abs(temperature * 0.35).toFixed(3)})`);
  switch (c.filter) {
    case "warm": parts.push("saturate(1.15)", "sepia(0.12)"); break;
    case "cool": parts.push("saturate(1.05)", "hue-rotate(-8deg)"); break;
    case "cinematic": parts.push("contrast(1.15)", "saturate(0.9)"); break;
    case "bw": parts.push("grayscale(1)", "contrast(1.1)"); break;
    case "vivid": parts.push("saturate(1.4)", "contrast(1.1)"); break;
    case "vintage": parts.push("sepia(0.35)", "saturate(0.85)"); break;
    default: break;
  }
  return parts.length ? parts.join(" ") : "none";
}

function captionColors(style: CaptionStyle) {
  switch (style) {
    case "yellow":  return { fill: "#ffee00", stroke: "#000000", box: null as string | null, strokeW: 6 };
    case "outline": return { fill: "#ffffff", stroke: "#000000", box: null, strokeW: 7 };
    case "boxed":   return { fill: "#ffffff", stroke: null, box: "rgba(0,0,0,1)", strokeW: 0 };
    case "minimal": return { fill: "#ffffff", stroke: "#000000", box: null, strokeW: 2 };
    default:        return { fill: "#ffffff", stroke: null, box: "rgba(0,0,0,0.85)", strokeW: 0 };
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    let line = "";
    for (const word of rawLine.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out;
}

/** Source rectangle after crop + Ken Burns zoom/pan at a given progress. */
function sourceRect(c: Clip, vw: number, vh: number, progress: number) {
  const t = c.transform;
  let sx = t.cropX * vw;
  let sy = t.cropY * vh;
  let sw = Math.max(2, t.cropW * vw);
  let sh = Math.max(2, t.cropH * vh);

  const zoom = Math.max(1, t.zoomStart + (t.zoomEnd - t.zoomStart) * progress);
  if (zoom > 1) {
    const cx = sx + sw / 2 + ((t.panStartX + (t.panEndX - t.panStartX) * progress) * sw) / 4;
    const cy = sy + sh / 2 + ((t.panStartY + (t.panEndY - t.panStartY) * progress) * sh) / 4;
    sw /= zoom;
    sh /= zoom;
    sx = Math.max(0, Math.min(vw - sw, cx - sw / 2));
    sy = Math.max(0, Math.min(vh - sh, cy - sh / 2));
  }
  return { sx, sy, sw, sh };
}

/** Draws one composited frame of the project at `timeS` onto `ctx`. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  project: EditorProject,
  timeS: number,
  sources: PreviewSources,
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const scale = H / 1080;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  const at = resolvePlayhead(project, timeS);
  if (at) {
    const video = sources.video.get(at.clip.id);
    if (video && video.readyState >= 2 && video.videoWidth > 0) {
      const places = clipPlacements(project);
      const place = places[at.index];
      const len = Math.max(0.001, place.endS - place.startS);
      const progress = Math.max(0, Math.min(1, (timeS - place.startS) / len));
      const { sx, sy, sw, sh } = sourceRect(at.clip, video.videoWidth, video.videoHeight, progress);

      const rot = at.clip.transform.rotate;
      const swapped = rot === 90 || rot === 270;
      const srcW = swapped ? sh : sw;
      const srcH = swapped ? sw : sh;
      const fit = Math.min(W / srcW, H / srcH);
      const dw = srcW * fit;
      const dh = srcH * fit;

      ctx.save();
      ctx.filter = cssFilterFor(at.clip);
      ctx.translate(W / 2, H / 2);
      if (rot) ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(at.clip.transform.flipH ? -1 : 1, at.clip.transform.flipV ? -1 : 1);
      const drawW = swapped ? dh : dw;
      const drawH = swapped ? dw : dh;
      try {
        ctx.drawImage(video, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
      } catch {
        /* frame not decodable yet */
      }
      ctx.restore();
      ctx.filter = "none";
    }
  }

  // Watermark
  const wm = project.watermark;
  if (wm.enabled && sources.watermark?.complete && sources.watermark.naturalWidth > 0) {
    const img = sources.watermark;
    const lw = W * Math.max(0.05, Math.min(0.5, wm.scale));
    const lh = (img.naturalHeight / img.naturalWidth) * lw;
    const m = W * wm.marginPct;
    const x = wm.position === "tl" || wm.position === "bl" ? m : W - lw - m;
    const y = wm.position === "tl" || wm.position === "tr" ? m : H - lh - m;
    ctx.globalAlpha = wm.opacity;
    ctx.drawImage(img, x, y, lw, lh);
    ctx.globalAlpha = 1;
  }

  // Text overlays
  for (const t of project.texts) {
    if (timeS < t.startS || timeS > t.endS) continue;
    ctx.font = fontFor(t, scale);
    ctx.textBaseline = "middle";
    ctx.textAlign = t.align;
    const lines = wrapText(ctx, t.text, W * 0.9);
    const lineH = Math.round(t.fontSize * scale * 1.25);
    const blockH = lineH * lines.length;
    const cx = t.x * W;
    const cy = t.y * H;

    if (t.bgOpacity > 0) {
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      const padX = t.fontSize * scale * 0.4;
      const padY = t.fontSize * scale * 0.25;
      const bx = t.align === "left" ? cx : t.align === "right" ? cx - widest : cx - widest / 2;
      ctx.globalAlpha = t.bgOpacity;
      ctx.fillStyle = t.bgColor;
      ctx.fillRect(bx - padX, cy - blockH / 2 - padY, widest + padX * 2, blockH + padY * 2);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = t.color;
    lines.forEach((line, i) => {
      ctx.fillText(line, cx, cy - blockH / 2 + lineH * (i + 0.5));
    });
  }

  // Captions
  if (project.captions.enabled) {
    const cue = project.captions.cues.find((c) => timeS >= c.startS && timeS <= c.endS);
    if (cue && cue.text.trim()) {
      const style = captionColors(project.captions.style);
      const size = project.captions.fontSize * scale;
      ctx.font = `700 ${Math.round(size)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lines = wrapText(ctx, cue.text, W * 0.8);
      const lineH = size * 1.3;
      const blockH = lineH * lines.length;
      const baseY = project.captions.position === "top" ? H * 0.08 + blockH / 2 : H * 0.92 - blockH / 2;

      if (style.box) {
        const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
        ctx.fillStyle = style.box;
        ctx.fillRect(W / 2 - widest / 2 - size * 0.4, baseY - blockH / 2 - size * 0.2, widest + size * 0.8, blockH + size * 0.4);
      }
      lines.forEach((line, i) => {
        const y = baseY - blockH / 2 + lineH * (i + 0.5);
        if (style.stroke) {
          ctx.lineWidth = style.strokeW * scale;
          ctx.strokeStyle = style.stroke;
          ctx.lineJoin = "round";
          ctx.strokeText(line, W / 2, y);
        }
        ctx.fillStyle = style.fill;
        ctx.fillText(line, W / 2, y);
      });
    }
  }
}

/** Grabs evenly spaced filmstrip thumbnails from a clip source. */
export async function filmstripThumbs(src: string, count: number, height = 48): Promise<string[]> {
  const video = document.createElement("video");
  video.src = src;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = src.startsWith("blob:") ? null : "anonymous";

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("thumbnail timeout")), 15_000);
    video.onloadeddata = () => { window.clearTimeout(timer); resolve(); };
    video.onerror = () => { window.clearTimeout(timer); reject(new Error("thumbnail decode failed")); };
    video.load();
  });

  const ratio = (video.videoWidth || 16) / (video.videoHeight || 9);
  const canvas = document.createElement("canvas");
  canvas.height = height;
  canvas.width = Math.max(2, Math.round(height * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  const out: string[] = [];
  const dur = video.duration || 0;
  for (let i = 0; i < count; i++) {
    const t = dur * ((i + 0.5) / count);
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("seek timeout")), 8_000);
        video.onseeked = () => { window.clearTimeout(timer); resolve(); };
        video.currentTime = Math.min(t, Math.max(0, dur - 0.05));
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      out.push(canvas.toDataURL("image/jpeg", 0.5));
    } catch {
      break;
    }
  }
  video.removeAttribute("src");
  video.load();
  return out;
}

/** Peak envelope for an audio source, used to draw the waveform on the timeline. */
export async function audioPeaks(src: string, buckets = 400): Promise<number[]> {
  const res = await fetch(src);
  const buf = await res.arrayBuffer();
  const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const actx = new AudioCtor();
  try {
    const decoded = await actx.decodeAudioData(buf);
    const data = decoded.getChannelData(0);
    const size = Math.max(1, Math.floor(data.length / buckets));
    const peaks: number[] = [];
    for (let i = 0; i < buckets; i++) {
      let peak = 0;
      const start = i * size;
      for (let j = 0; j < size && start + j < data.length; j++) {
        const v = Math.abs(data[start + j]);
        if (v > peak) peak = v;
      }
      peaks.push(peak);
    }
    return peaks;
  } finally {
    void actx.close();
  }
}
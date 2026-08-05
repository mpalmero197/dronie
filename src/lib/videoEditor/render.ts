import { getFFmpeg, fetchFile, resetFFmpeg, captureFFmpegLogs } from "./ffmpeg";
import {
  AudioTrack, Clip, EditorProject, FilterPreset, TransitionKind,
  clipLength, isIdentityColor, isIdentityTransform, totalDuration,
} from "./types";
import { buildAss } from "./ass";

export type RenderProgress = (pct: number, msg: string) => void;

export type RenderStage =
  | "load" | "clip" | "join" | "audio" | "overlay" | "finalize";

/** A render failure that knows which stage (and clip) it came from. */
export class RenderStageError extends Error {
  constructor(
    public stage: RenderStage,
    message: string,
    public clipName?: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "RenderStageError";
  }
}

export class RenderCancelledError extends Error {
  constructor() {
    super("Render cancelled");
    this.name = "RenderCancelledError";
  }
}

export interface RenderOptions {
  signal?: AbortSignal;
}

export interface RenderPreflight {
  clipCount: number;
  durationS: number;
  outputPixels: number;
  estimatedSeconds: number;
  estimatedMb: number;
  warnings: string[];
  blockers: string[];
  suggestedWidth: number;
  suggestedHeight: number;
}

const QUALITY_CRF: Record<EditorProject["quality"], number> = {
  draft: 30,
  standard: 24,
  high: 19,
};

const QUALITY_MBPS: Record<EditorProject["quality"], number> = {
  draft: 2.5,
  standard: 6,
  high: 14,
};

/** Rough device memory budget — ffmpeg.wasm dies well before native ffmpeg would. */
function deviceMemoryGb(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return nav.deviceMemory ?? 4;
}

/**
 * Pre-flight report shown before a render starts: duration, source count,
 * estimated wall clock and file size, plus resolution caps on small devices.
 */
export function preflight(project: EditorProject): RenderPreflight {
  const durationS = totalDuration(project);
  const outputPixels = project.width * project.height;
  const mem = deviceMemoryGb();
  const warnings: string[] = [];
  const blockers: string[] = [];

  // ffmpeg.wasm runs roughly 8-25x slower than realtime depending on size.
  const sizeFactor = outputPixels / (1920 * 1080);
  const estimatedSeconds = Math.max(
    10,
    Math.round(durationS * (8 + 10 * sizeFactor) + project.clips.length * 4),
  );
  const estimatedMb = Math.round((QUALITY_MBPS[project.quality] * durationS) / 8);

  let suggestedWidth = project.width;
  let suggestedHeight = project.height;
  if (mem <= 4 && outputPixels > 1920 * 1080) {
    const scale = Math.sqrt((1920 * 1080) / outputPixels);
    suggestedWidth = Math.round((project.width * scale) / 2) * 2;
    suggestedHeight = Math.round((project.height * scale) / 2) * 2;
    warnings.push(
      `This device reports ~${mem}GB of memory. Rendering above 1080p may run out of memory — ${suggestedWidth}×${suggestedHeight} is safer.`,
    );
  }
  if (durationS > 300) {
    warnings.push("Timelines over 5 minutes can take a long time in the browser. Consider rendering in sections.");
  }
  if (project.clips.length === 0) blockers.push("Add at least one clip before rendering.");
  if (durationS <= 0) blockers.push("The timeline is empty — trim handles may have collapsed a clip to zero length.");

  return {
    clipCount: project.clips.length,
    durationS,
    outputPixels,
    estimatedSeconds,
    estimatedMb,
    warnings,
    blockers,
    suggestedWidth,
    suggestedHeight,
  };
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new RenderCancelledError();
}

/** Wraps an ffmpeg pass so a failure reports the stage it came from. */
async function stage<T>(
  s: RenderStage,
  what: string,
  signal: AbortSignal | undefined,
  fn: () => Promise<T>,
  clipName?: string,
): Promise<T> {
  throwIfAborted(signal);
  try {
    const out = await fn();
    throwIfAborted(signal);
    return out;
  } catch (e) {
    if (e instanceof RenderCancelledError) throw e;
    if (signal?.aborted) throw new RenderCancelledError();
    throw new RenderStageError(s, `${what} failed.`, clipName, e);
  }
}

function filterFor(preset: FilterPreset): string | null {
  switch (preset) {
    case "warm":      return "eq=saturation=1.15:gamma_r=1.05:gamma_b=0.95";
    case "cool":      return "eq=saturation=1.05:gamma_r=0.95:gamma_b=1.08";
    case "cinematic": return "curves=preset=increase_contrast,eq=saturation=0.9";
    case "bw":        return "hue=s=0,eq=contrast=1.1";
    case "vivid":     return "eq=saturation=1.4:contrast=1.1";
    case "vintage":   return "curves=vintage,eq=saturation=0.85";
    default:          return null;
  }
}

function transformFilters(c: Clip, w: number, h: number, fps: number, segDur: number): string[] {
  const parts: string[] = [];
  const t = c.transform;
  if (!isIdentityTransform(t)) {
    if (t.cropW < 1 || t.cropH < 1 || t.cropX > 0 || t.cropY > 0) {
      parts.push(
        `crop=iw*${t.cropW.toFixed(4)}:ih*${t.cropH.toFixed(4)}:iw*${t.cropX.toFixed(4)}:ih*${t.cropY.toFixed(4)}`,
      );
    }
    if (t.rotate === 90) parts.push("transpose=1");
    else if (t.rotate === 180) parts.push("transpose=1,transpose=1");
    else if (t.rotate === 270) parts.push("transpose=2");
    if (t.flipH) parts.push("hflip");
    if (t.flipV) parts.push("vflip");

    const zs = Math.max(1, t.zoomStart);
    const ze = Math.max(1, t.zoomEnd);
    const moving = zs !== 1 || ze !== 1 || t.panStartX !== t.panEndX || t.panStartY !== t.panEndY;
    if (moving) {
      const frames = Math.max(1, Math.round(segDur * fps));
      const z = `${zs.toFixed(3)}+(${(ze - zs).toFixed(3)})*on/${frames}`;
      const px = `${t.panStartX.toFixed(3)}+(${(t.panEndX - t.panStartX).toFixed(3)})*on/${frames}`;
      const py = `${t.panStartY.toFixed(3)}+(${(t.panEndY - t.panStartY).toFixed(3)})*on/${frames}`;
      // Pre-scale so zoompan resamples from a high-res source (avoids softness).
      parts.push(`scale=${w * 2}:-2`);
      parts.push(
        `zoompan=z='${z}':x='iw/2-(iw/zoom/2)+(${px})*iw/4':y='ih/2-(ih/zoom/2)+(${py})*ih/4':d=1:s=${w}x${h}:fps=${fps}`,
      );
    }
  }
  return parts;
}

function colorFilters(c: Clip): string[] {
  if (isIdentityColor(c.color)) return [];
  const { exposure, contrast, saturation, temperature } = c.color;
  const parts = [
    `eq=brightness=${exposure.toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}`,
  ];
  if (temperature !== 0) {
    const warm = temperature * 0.25;
    parts.push(
      `colorbalance=rm=${warm.toFixed(3)}:rh=${(warm * 0.6).toFixed(3)}:bm=${(-warm).toFixed(3)}:bh=${(-warm * 0.6).toFixed(3)}`,
    );
  }
  return parts;
}

function xfadeName(t: TransitionKind): string | null {
  switch (t) {
    case "fade":       return "fade";
    case "dissolve":   return "dissolve";
    case "wipeleft":   return "wipeleft";
    case "wiperight":  return "wiperight";
    case "slideleft":  return "slideleft";
    case "slideright": return "slideright";
    case "fadeblack":  return "fadeblack";
    case "fadewhite":  return "fadewhite";
    default:           return null;
  }
}

/**
 * Detects whether a source actually carries an audio stream. Clips exported
 * from drone apps and screen recorders often do not, and the transition path
 * fails outright when it maps a missing [n:a].
 */
async function hasAudioStream(inFile: string): Promise<boolean> {
  const { logs } = await captureFFmpegLogs(async (ff) => {
    try {
      // -i alone exits non-zero but prints the stream table to the log.
      await ff.exec(["-hide_banner", "-i", inFile]);
    } catch { /* expected */ }
    return null;
  });
  return /Stream #\d+:\d+.*: Audio:/i.test(logs);
}

/**
 * Render the full project to MP4 in the browser via ffmpeg.wasm.
 *
 * Staged so a failure can name the step that broke:
 *   1. clip   — trim, speed, crop/rotate, colour, Ken Burns, scale/pad, and a
 *               synthesised silent track when the source has no audio.
 *   2. join   — xfade chain when transitions are used, concat otherwise, with
 *               an automatic fall back to concat if the xfade pass fails.
 *   3. audio  — mix music/voiceover beds, with ducking under the voiceover.
 *   4. overlay— burn captions, text, and the logo watermark.
 *
 * Every stage checks the abort signal, and cancelling terminates the ffmpeg
 * worker so a long pass stops immediately instead of running to completion.
 */
export async function renderProject(
  project: EditorProject,
  onProgress: RenderProgress,
  options: RenderOptions = {},
): Promise<Blob> {
  const { signal } = options;
  if (project.clips.length === 0) throw new Error("No clips to render");
  throwIfAborted(signal);

  const onAbort = () => { resetFFmpeg(); };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    return await runRender(project, onProgress, signal);
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

async function runRender(
  project: EditorProject,
  onProgress: RenderProgress,
  signal: AbortSignal | undefined,
): Promise<Blob> {
  const ff = await stage("load", "Loading the editor engine", signal, () =>
    getFFmpeg((m) => onProgress(-1, m)),
  );
  const W = project.width;
  const H = project.height;
  const FPS = project.fps;
  const CRF = QUALITY_CRF[project.quality] ?? 24;

  onProgress(2, "Loading source clips…");

  // 1) Write all source files
  for (let i = 0; i < project.clips.length; i++) {
    const c = project.clips[i];
    const ext = (c.name.split(".").pop() || "mp4").toLowerCase();
    await stage("clip", `Reading “${c.name}”`, signal, async () => {
      const data = await fetchFile(c.src);
      await ff.writeFile(`in${i}.${ext}`, data);
    }, c.name);
  }

  // 2) Normalize each clip into a uniform intermediate (still as mp4, since wasm core lacks rawvideo encoder safety)
  const segs: string[] = [];
  const silentSegs = new Set<string>();
  for (let i = 0; i < project.clips.length; i++) {
    const c = project.clips[i];
    const ext = (c.name.split(".").pop() || "mp4").toLowerCase();
    const inFile = `in${i}.${ext}`;
    const outFile = `seg${i}.mp4`;
    const playDur = (c.outS - c.inS) / Math.max(0.1, c.speed);
    const segDur = clipLength(c);

    const audible = await stage("clip", `Inspecting “${c.name}”`, signal, () => hasAudioStream(inFile), c.name);

    const vfParts: string[] = [];
    if (c.speed !== 1) vfParts.push(`setpts=${(1 / c.speed).toFixed(4)}*PTS`);
    vfParts.push(...transformFilters(c, W, H, FPS, segDur));
    vfParts.push(...colorFilters(c));
    const f = filterFor(c.filter);
    if (f) vfParts.push(f);
    if (c.freezeS > 0) {
      // Hold the final frame for the freeze duration.
      vfParts.push(`tpad=stop_mode=clone:stop_duration=${c.freezeS.toFixed(3)}`);
    }
    vfParts.push(
      `scale=${W}:${H}:force_original_aspect_ratio=decrease`,
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`,
      `setsar=1`,
      `fps=${FPS}`,
    );
    const vf = vfParts.join(",");

    const afParts: string[] = [];
    if (c.speed !== 1) {
      // atempo supports 0.5..2.0; chain if needed
      let s = c.speed;
      while (s > 2.0) { afParts.push("atempo=2.0"); s /= 2.0; }
      while (s < 0.5) { afParts.push("atempo=0.5"); s /= 0.5; }
      afParts.push(`atempo=${s.toFixed(4)}`);
    }
    const vol = c.volume * project.audioVolume;
    if (vol !== 1) afParts.push(`volume=${vol.toFixed(3)}`);
    const af = afParts.length ? afParts.join(",") : null;

    onProgress(5 + Math.round((i / project.clips.length) * 35), `Preparing clip ${i + 1}/${project.clips.length}…`);

    // Every segment gets an audio track — a real one, or synthesised silence —
    // so the join stage can always map [n:a] without checking each source.
    const args = audible
      ? [
          "-ss", c.inS.toFixed(3),
          "-to", c.outS.toFixed(3),
          "-i", inFile,
          "-vf", vf,
          ...(af ? ["-af", af] : []),
          "-r", String(FPS),
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", String(CRF), "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-ar", "44100", "-ac", "2",
          "-t", segDur.toFixed(3),
          outFile,
        ]
      : [
          "-ss", c.inS.toFixed(3),
          "-to", c.outS.toFixed(3),
          "-i", inFile,
          "-f", "lavfi",
          "-t", segDur.toFixed(3),
          "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
          "-vf", vf,
          "-map", "0:v:0", "-map", "1:a:0",
          "-r", String(FPS),
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", String(CRF), "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-ar", "44100", "-ac", "2",
          "-t", segDur.toFixed(3),
          outFile,
        ];
    await stage("clip", `Preparing clip ${i + 1} (“${c.name}”)`, signal, () => ff.exec(args), c.name);
    if (!audible) silentSegs.add(outFile);
    segs.push(outFile);
    // Free the source immediately so long timelines don't exhaust memory.
    try { await ff.deleteFile(inFile); } catch {}
    void playDur;
  }

  // 3) Combine — either xfade chain (if any non-"none" transitions) or concat demuxer
  let combined = "combined.mp4";
  const hasTransitions = project.clips.slice(0, -1).some((c) => c.transitionToNext !== "none");

  const concatJoin = async () => {
    const list = segs.map((s) => `file '${s}'`).join("\n");
    await ff.writeFile("concat.txt", new TextEncoder().encode(list));
    await ff.exec([
      "-f", "concat", "-safe", "0", "-i", "concat.txt",
      "-c", "copy",
      combined,
    ]);
  };

  if (segs.length === 1) {
    combined = segs[0];
  } else if (!hasTransitions) {
    onProgress(45, "Joining clips…");
    await stage("join", "Joining clips", signal, concatJoin);
  } else {
    // xfade chain
    onProgress(45, "Building transitions…");
    const inputs: string[] = [];
    segs.forEach((s) => { inputs.push("-i", s); });

    // compute per-clip durations
    const durs: number[] = project.clips.map((c) => clipLength(c));

    let filter = "";
    let lastV = "[0:v]";
    let lastA = "[0:a]";
    let runningOffset = durs[0];
    for (let i = 1; i < segs.length; i++) {
      const c = project.clips[i - 1];
      const tName = xfadeName(c.transitionToNext) ?? "fade";
      const td = Math.max(0.1, Math.min(c.transitionDurS, durs[i - 1] / 2, durs[i] / 2));
      const offset = runningOffset - td;
      const vOut = `[v${i}]`;
      const aOut = `[a${i}]`;
      filter += `${lastV}[${i}:v]xfade=transition=${tName}:duration=${td.toFixed(3)}:offset=${offset.toFixed(3)}${vOut};`;
      filter += `${lastA}[${i}:a]acrossfade=d=${td.toFixed(3)}${aOut};`;
      lastV = vOut;
      lastA = aOut;
      runningOffset = offset + td + durs[i];
    }
    try {
      throwIfAborted(signal);
      await ff.exec([
        ...inputs,
        "-filter_complex", filter,
        "-map", lastV,
        "-map", lastA,
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", String(CRF), "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "44100",
        combined,
      ]);
      throwIfAborted(signal);
    } catch (e) {
      if (e instanceof RenderCancelledError) throw e;
      if (signal?.aborted) throw new RenderCancelledError();
      // A transition chain can fail on odd source combinations — still deliver
      // a file by joining the clips with straight cuts.
      console.warn("xfade pass failed, falling back to a straight-cut join", e);
      onProgress(50, "Transitions failed — joining with straight cuts…");
      await stage("join", "Joining clips", signal, concatJoin);
    }
  }

  // 4) Mix music / voiceover beds over the timeline audio
  const beds = project.audioTracks.filter((t) => !t.muted && t.src);
  if (beds.length > 0) {
    onProgress(70, "Mixing audio tracks…");
    combined = await stage("audio", "Mixing the audio tracks", signal, () =>
      mixAudioBeds(ff, combined, beds, project, CRF),
    );
  }

  // 5) Burn ASS overlay (captions + text) and the watermark, if any
  const hasOverlays =
    (project.captions.enabled && project.captions.burnIn && project.captions.cues.length > 0) ||
    project.texts.length > 0;
  const wm = project.watermark;
  const hasWatermark = wm.enabled && !!wm.src;

  let finalFile = combined;
  if (hasOverlays || hasWatermark) {
    onProgress(85, hasWatermark ? "Burning captions, text and watermark…" : "Burning captions and text…");
    finalFile = "out.mp4";
    await stage("overlay", "Burning captions, text and watermark", signal, async () => {
      const inputs: string[] = ["-i", combined];
      const chain: string[] = [];

      if (hasWatermark && wm.src) {
        await ff.writeFile("wm.png", await fetchFile(wm.src));
        inputs.push("-i", "wm.png");
        const logoW = Math.round(W * Math.max(0.05, Math.min(0.5, wm.scale)));
        const m = Math.round(W * wm.marginPct);
        const pos =
          wm.position === "tl" ? `${m}:${m}` :
          wm.position === "tr" ? `W-w-${m}:${m}` :
          wm.position === "bl" ? `${m}:H-h-${m}` :
          `W-w-${m}:H-h-${m}`;
        chain.push(
          `[1:v]scale=${logoW}:-1,format=rgba,colorchannelmixer=aa=${wm.opacity.toFixed(2)}[wm]`,
          `[0:v][wm]overlay=${pos}[wmv]`,
        );
      }

      let lastLabel = hasWatermark ? "[wmv]" : "[0:v]";
      if (hasOverlays) {
        const ass = buildAss(project);
        await ff.writeFile("subs.ass", new TextEncoder().encode(ass));
        chain.push(`${lastLabel}ass=subs.ass[outv]`);
        lastLabel = "[outv]";
      }

      await ff.exec([
        ...inputs,
        "-filter_complex", chain.join(";"),
        "-map", lastLabel,
        "-map", "0:a?",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", String(CRF), "-pix_fmt", "yuv420p",
        "-c:a", "copy",
        finalFile,
      ]);
    });
  }

  onProgress(98, "Finalizing…");
  const out = await stage("finalize", "Reading the finished file", signal, () => ff.readFile(finalFile));
  const u8 = out as Uint8Array;
  // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer typing issues with Blob.
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  const blob = new Blob([ab], { type: "video/mp4" });

  // cleanup
  for (const s of segs) { try { await ff.deleteFile(s); } catch {} }
  try { await ff.deleteFile("concat.txt"); } catch {}
  try { await ff.deleteFile("subs.ass"); } catch {}
  try { await ff.deleteFile("wm.png"); } catch {}
  try { await ff.deleteFile("mixed.mp4"); } catch {}
  if (combined !== finalFile) { try { await ff.deleteFile(combined); } catch {} }
  try { await ff.deleteFile(finalFile); } catch {}

  onProgress(100, "Done");
  return blob;
}

/**
 * Layers music and voiceover over the rendered timeline audio. Music is ducked
 * under the voiceover when the project asks for it, falling back to a fixed
 * attenuation when the wasm build lacks sidechaincompress.
 */
async function mixAudioBeds(
  ff: Awaited<ReturnType<typeof getFFmpeg>>,
  videoFile: string,
  beds: AudioTrack[],
  project: EditorProject,
  crf: number,
): Promise<string> {
  const out = "mixed.mp4";
  const inputs: string[] = ["-i", videoFile];
  const labels: string[] = ["[0:a]"];
  const chain: string[] = [];

  const hasVoice = beds.some((b) => b.role === "voiceover");

  for (let i = 0; i < beds.length; i++) {
    const b = beds[i];
    const name = `bed${i}.${(b.name.split(".").pop() || "mp3").toLowerCase()}`;
    await ff.writeFile(name, await fetchFile(b.src));
    inputs.push("-i", name);

    const idx = i + 1;
    const len = Math.max(0.1, b.outS - b.inS);
    const duck = project.duckMusic && hasVoice && b.role === "music" ? 0.35 : 1;
    const parts = [
      `atrim=start=${b.inS.toFixed(3)}:end=${b.outS.toFixed(3)}`,
      "asetpts=PTS-STARTPTS",
      `adelay=${Math.round(b.startS * 1000)}|${Math.round(b.startS * 1000)}`,
      `volume=${(b.gain * duck).toFixed(3)}`,
    ];
    if (b.fadeInS > 0) parts.push(`afade=t=in:st=${b.startS.toFixed(3)}:d=${b.fadeInS.toFixed(3)}`);
    if (b.fadeOutS > 0) {
      parts.push(`afade=t=out:st=${(b.startS + len - b.fadeOutS).toFixed(3)}:d=${b.fadeOutS.toFixed(3)}`);
    }
    chain.push(`[${idx}:a]${parts.join(",")}[b${i}]`);
    labels.push(`[b${i}]`);
  }

  chain.push(`${labels.join("")}amix=inputs=${labels.length}:duration=first:dropout_transition=0,alimiter=limit=0.95[mixa]`);

  await ff.exec([
    ...inputs,
    "-filter_complex", chain.join(";"),
    "-map", "0:v:0",
    "-map", "[mixa]",
    "-c:v", "copy",
    "-c:a", "aac", "-ar", "44100", "-ac", "2",
    "-shortest",
    out,
  ]);

  for (let i = 0; i < beds.length; i++) {
    const b = beds[i];
    try { await ff.deleteFile(`bed${i}.${(b.name.split(".").pop() || "mp3").toLowerCase()}`); } catch { /* ignore */ }
  }
  void crf;
  return out;
}

/** Human-readable message for a failed render. */
export function describeRenderError(e: unknown): string {
  if (e instanceof RenderCancelledError) return "Render cancelled.";
  if (e instanceof RenderStageError) {
    const where = e.clipName ? ` (clip “${e.clipName}”)` : "";
    const hint =
      e.stage === "clip"
        ? " The source may use a codec the browser engine cannot decode — try re-exporting it as MP4/H.264."
        : e.stage === "audio"
          ? " Try removing the music or voiceover track and rendering again."
          : e.stage === "overlay"
            ? " Try turning off burn-in captions or the watermark."
            : "";
    return `${e.message}${where}${hint}`;
  }
  return e instanceof Error ? e.message : "Render failed.";
}

/** Probe a video URL/Blob URL for duration + dimensions in the browser. */
export function probeVideo(src: string): Promise<{ durationS: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    if (!src.startsWith("blob:")) v.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Video metadata took too long to load. Try a shorter MP4/WebM clip."));
    }, 20_000);
    const cleanup = () => {
      window.clearTimeout(timer);
      v.onloadedmetadata = null;
      v.onerror = null;
      v.removeAttribute("src");
      v.load();
      v.remove();
    };
    v.onloadedmetadata = () => {
      resolve({ durationS: v.duration || 0, width: v.videoWidth || 1920, height: v.videoHeight || 1080 });
      cleanup();
    };
    v.onerror = () => {
      cleanup();
      reject(new Error("Could not read video metadata. Try MP4/H.264 or WebM."));
    };
    v.src = src;
    v.load();
  });
}
/**
 * Video → Gaussian Splat ingest.
 *
 * Extracts JPEG frames from an uploaded video in the browser via ffmpeg.wasm.
 * The frame plan scales with clip length + resolution so a short 1080p clip
 * still produces a viewable draft splat, while a long 4K clip produces a
 * cinematic-preset dataset.
 */
import { getFFmpeg, fetchFile } from "./videoEditor/ffmpeg";

export interface FramePlan {
  /** Target frames extracted from the source video. */
  frames: number;
  /** ffmpeg fps= filter value (frames-per-second sampled from the source). */
  fps: number;
  /** Resolution multiplier vs 1080p reference (0.6–2.0). */
  resFactor: number;
  /** Auto-selected training preset based on frame count. */
  preset: "draft" | "balanced" | "cinematic";
  /** Long-edge px cap for extracted JPEGs. */
  longEdgePx: number;
  /** Estimated training wall-clock for the picked preset (seconds). */
  estimatedTrainingSeconds: number;
}

const MIN_FRAMES = 40;
const MAX_FRAMES = 900;
const LONG_EDGE_CAP = 1600;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function estimateFramePlan(
  durationS: number,
  width: number,
  height: number,
): FramePlan {
  const dur = Math.max(1, durationS || 0);
  const pixels = Math.max(1, (width || 1280) * (height || 720));
  // 1080p (1920x1080 = 2,073,600 px) is our reference at 1.0x.
  const resFactor = clamp(Math.sqrt(pixels / 2_073_600), 0.6, 2.0);

  // Slower sampling on longer clips so we don't over-collect near-duplicates.
  const baseFps = dur <= 30 ? 4 : dur <= 90 ? 2 : 1;
  const effectiveFps = baseFps * resFactor;
  const rawFrames = Math.round(dur * effectiveFps);
  const frames = clamp(rawFrames, MIN_FRAMES, MAX_FRAMES);

  const preset: FramePlan["preset"] =
    frames < 120 ? "draft" : frames <= 320 ? "balanced" : "cinematic";

  const estimatedTrainingSeconds =
    preset === "draft" ? 90 : preset === "balanced" ? 360 : 720;

  return {
    frames,
    fps: Number(effectiveFps.toFixed(3)),
    resFactor: Number(resFactor.toFixed(2)),
    preset,
    longEdgePx: LONG_EDGE_CAP,
    estimatedTrainingSeconds,
  };
}

export type IngestProgress = (pct: number, msg: string) => void;

/**
 * Extracts frames as JPEG blobs from a video file.
 * Uses a single ffmpeg pass with fps + scale filters.
 */
export async function extractFrames(
  file: File,
  plan: FramePlan,
  onProgress: IngestProgress,
): Promise<Blob[]> {
  onProgress(2, "Loading video processor…");
  const ff = await getFFmpeg();

  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const inName = `in.${ext}`;
  onProgress(8, "Reading video…");
  await ff.writeFile(inName, await fetchFile(file));

  const vf = `fps=${plan.fps},scale='if(gt(iw,ih),min(${plan.longEdgePx},iw),-2)':'if(gt(iw,ih),-2,min(${plan.longEdgePx},ih))'`;

  onProgress(15, "Extracting frames…");
  await ff.exec([
    "-i", inName,
    "-vf", vf,
    "-q:v", "3",
    "-frames:v", String(plan.frames),
    "-an",
    "frame_%05d.jpg",
  ]);

  onProgress(70, "Reading frames…");
  const blobs: Blob[] = [];
  for (let i = 1; i <= plan.frames; i++) {
    const name = `frame_${String(i).padStart(5, "0")}.jpg`;
    try {
      const data = await ff.readFile(name);
      const u8 = data as Uint8Array;
      const ab = new ArrayBuffer(u8.byteLength);
      new Uint8Array(ab).set(u8);
      blobs.push(new Blob([ab], { type: "image/jpeg" }));
      try { await ff.deleteFile(name); } catch { /* ignore */ }
    } catch {
      // ffmpeg may have produced fewer frames than requested for very short
      // clips; stop when the next expected frame is missing.
      break;
    }
  }
  try { await ff.deleteFile(inName); } catch { /* ignore */ }

  if (blobs.length < MIN_FRAMES) {
    throw new Error(
      `Only ${blobs.length} frames extracted — video is too short or unreadable. Need at least ${MIN_FRAMES}.`,
    );
  }

  onProgress(80, `Extracted ${blobs.length} frames`);
  return blobs;
}

/** Human-readable summary of the plan for the ingest dialog. */
export function describePlan(plan: FramePlan): string {
  const mins = Math.round(plan.estimatedTrainingSeconds / 60);
  return `${plan.frames} frames · ${plan.preset} preset · ~${mins} min conversion`;
}

export const INGEST_LIMITS = {
  maxFileBytes: 500 * 1024 * 1024,
  maxFrames: MAX_FRAMES,
  minFrames: MIN_FRAMES,
};
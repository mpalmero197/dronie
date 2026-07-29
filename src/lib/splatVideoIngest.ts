/**
 * Video → Gaussian Splat ingest.
 *
 * Extracts JPEG frames from an uploaded video with the browser's native video
 * decoder and canvas. This avoids the long ffmpeg.wasm boot step that can look
 * like a no-op on mobile footage, while still producing real image inputs for
 * the backend 3D conversion job.
 */
import { fetchFile, withFFmpegLogs } from "./videoEditor/ffmpeg";

export interface FramePlan {
  /** Target frames extracted from the source video. */
  frames: number;
  /** Sampling rate used for the displayed extraction plan. */
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
const VIDEO_READY_TIMEOUT_MS = 20_000;
const SEEK_TIMEOUT_MS = 12_000;
const TRANSCODE_MAX_SECONDS = 180;
const TRANSCODE_MAX_BYTES = 350 * 1024 * 1024;

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

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not encode extracted frame."));
      },
      "image/jpeg",
      0.9,
    );
  });
}

function fileExtension(fileName: string, fallback: string) {
  const ext = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || fallback;
}

function createVideo(file: File): Promise<{ video: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onloadeddata = null;
      video.onerror = null;
    };
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      URL.revokeObjectURL(url);
      reject(new Error("Video metadata took too long to load. Try a shorter MP4/WebM clip."));
    }, VIDEO_READY_TIMEOUT_MS);

    const ready = () => {
      if (settled) return;
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      settled = true;
      cleanup();
      resolve({ video, url });
    };

    video.onloadedmetadata = ready;
    video.onloadeddata = ready;
    video.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      URL.revokeObjectURL(url);
      reject(new Error("This browser could not decode the selected video. Try MP4/H.264 or WebM."));
    };
    video.src = url;
    video.load();
  });
}

export function probeVideoFile(file: File): Promise<{ durationS: number; width: number; height: number }> {
  return createVideo(file).then(({ video, url }) => {
    const metadata = {
      durationS: video.duration || 0,
      width: video.videoWidth || 1920,
      height: video.videoHeight || 1080,
    };
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
    return metadata;
  });
}

export async function transcodeVideoForBrowser(
  file: File,
  onProgress: IngestProgress,
): Promise<File> {
  if (file.size > TRANSCODE_MAX_BYTES) {
    throw new Error("This video uses a format your browser cannot decode. Try exporting as MP4/H.264 or WebM before uploading.");
  }

  onProgress(4, "Preparing video for browser decoding…");
  return withFFmpegLogs(
    (message) => {
      const timeMatch = /time=(\d{2}):(\d{2}):(\d{2}\.\d+)/.exec(message);
      if (!timeMatch) return;
      const [, hh, mm, ss] = timeMatch;
      const seconds = Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
      const pct = 4 + Math.min(20, Math.round((seconds / TRANSCODE_MAX_SECONDS) * 20));
      onProgress(pct, "Converting video to a browser-readable WebM…");
    },
    async (ff) => {
      const inName = `source.${fileExtension(file.name, "mov")}`;
      const outName = "dronie-compatible.webm";
      await ff.writeFile(inName, await fetchFile(file));
      try {
        await ff.exec([
          "-i", inName,
          "-t", String(TRANSCODE_MAX_SECONDS),
          "-vf", "scale='min(1600,iw)':-2",
          "-c:v", "libvpx",
          "-deadline", "realtime",
          "-cpu-used", "8",
          "-b:v", "2500k",
          "-pix_fmt", "yuv420p",
          "-an",
          outName,
        ]);

        const out = await ff.readFile(outName);
        const u8 = out as Uint8Array;
        const ab = new ArrayBuffer(u8.byteLength);
        new Uint8Array(ab).set(u8);
        return new File([ab], `${file.name.replace(/\.[^.]+$/, "") || "video"}-dronie.webm`, {
          type: "video/webm",
          lastModified: Date.now(),
        });
      } finally {
        try { await ff.deleteFile(inName); } catch { /* ignore */ }
        try { await ff.deleteFile(outName); } catch { /* ignore */ }
      }
    },
  );
}

function seekTo(video: HTMLVideoElement, timeS: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Video seek timed out while extracting frames."));
    }, SEEK_TIMEOUT_MS);

    const onSeeked = () => {
      if (settled) return;
      settled = true;
      cleanup();
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    };

    const onError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Could not seek through the selected video."));
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });

    try {
      const maxTime = Math.max(0, (video.duration || timeS) - 0.08);
      video.currentTime = Math.max(0, Math.min(timeS, maxTime));
    } catch (error) {
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error("Could not seek through the selected video."));
    }
  });
}

/** Extracts frames as JPEG blobs from a video file. */
export async function extractFrames(
  file: File,
  plan: FramePlan,
  onProgress: IngestProgress,
): Promise<Blob[]> {
  onProgress(2, "Opening video…");
  const { video, url } = await createVideo(file);

  try {
    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const scale = Math.min(1, plan.longEdgePx / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(2, Math.round(sourceWidth * scale));
    const height = Math.max(2, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas rendering is unavailable in this browser.");

    const duration = Math.max(0, video.duration || 0);
    const targetFrames = Math.max(MIN_FRAMES, Math.min(plan.frames, MAX_FRAMES));
    const blobs: Blob[] = [];

    onProgress(8, "Extracting video frames…");
    for (let i = 0; i < targetFrames; i++) {
      const t = targetFrames <= 1
        ? Math.min(0.5, duration * 0.5)
        : (i / (targetFrames - 1)) * Math.max(0.1, duration - 0.15);
      await seekTo(video, t);
      ctx.drawImage(video, 0, 0, width, height);
      blobs.push(await canvasToJpeg(canvas));

      if (i % 4 === 0 || i === targetFrames - 1) {
        const pct = 8 + Math.round(((i + 1) / targetFrames) * 72);
        onProgress(pct, `Extracting frames… ${i + 1}/${targetFrames}`);
        await waitForAnimationFrame();
      }
    }

    if (blobs.length < MIN_FRAMES) {
      throw new Error(
        `Only ${blobs.length} frames extracted — video is too short or unreadable. Need at least ${MIN_FRAMES}.`,
      );
    }

    onProgress(80, `Extracted ${blobs.length} frames`);
    return blobs;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
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
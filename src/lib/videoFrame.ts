// Utilities for capturing a still frame from a video file or URL,
// used to generate portfolio thumbnails / posters.

export interface CaptureOptions {
  /** Time (seconds) to seek to before capturing. Default: 1s or 10% of duration. */
  time?: number;
  /** Max output width in pixels. Default 1280. */
  maxWidth?: number;
  /** JPEG quality 0..1. Default 0.85. */
  quality?: number;
}

export interface CapturedFrame {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Load a <video> element from a File or URL and resolve once metadata is ready.
 * For File inputs the returned object also has a revoke() to release the blob URL.
 */
function createVideoElement(source: File | string): Promise<{
  video: HTMLVideoElement;
  revoke: () => void;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    // Only set CORS for remote URLs. Setting it on blob: URLs can break
    // playback in some browsers, and it's unnecessary for local files.
    if (typeof source === "string") {
      video.crossOrigin = "anonymous";
    }

    const url = typeof source === "string" ? source : URL.createObjectURL(source);
    const revoke = () => {
      if (typeof source !== "string") URL.revokeObjectURL(url);
    };

    let settled = false;
    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onloadeddata = null;
      video.onerror = null;
    };
    // Wait for loadeddata (a frame is actually decodable) rather than just
    // metadata — seeking before a frame is ready can fail on some browsers.
    const onReady = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ video, revoke });
    };
    video.onloadedmetadata = onReady;
    video.onloadeddata = onReady;
    video.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      revoke();
      reject(new Error("Could not load video"));
    };
    video.src = url;
  });
}

function seekVideo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      // Give the browser a moment to actually paint the frame
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    };
    const onError = () => {
      video.removeEventListener("error", onError);
      reject(new Error("Seek failed"));
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    try {
      video.currentTime = Math.max(0, Math.min(t, (video.duration || t) - 0.05));
    } catch (e) {
      reject(e as Error);
    }
  });
}

function drawToCanvas(
  video: HTMLVideoElement,
  maxWidth: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const w0 = video.videoWidth || 1280;
  const h0 = video.videoHeight || 720;
  const scale = w0 > maxWidth ? maxWidth / w0 : 1;
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.drawImage(video, 0, 0, w, h);
  return { canvas, width: w, height: h };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas encode failed"))),
      "image/jpeg",
      quality,
    );
  });
}

/** Capture a single frame from a File or URL. */
export async function captureVideoFrame(
  source: File | string,
  opts: CaptureOptions = {},
): Promise<CapturedFrame> {
  const { video, revoke } = await createVideoElement(source);
  try {
    const t = opts.time ?? Math.min(1, (video.duration || 2) * 0.1);
    await seekVideo(video, t);
    const { canvas, width, height } = drawToCanvas(video, opts.maxWidth ?? 1280);
    const blob = await canvasToBlob(canvas, opts.quality ?? 0.85);
    const dataUrl = canvas.toDataURL("image/jpeg", opts.quality ?? 0.85);
    return { blob, dataUrl, width, height };
  } finally {
    revoke();
    video.removeAttribute("src");
    video.load();
  }
}

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";

let ffmpegSingleton: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;
const logSubscribers = new Set<LoadProgress>();
let logListenerAttached = false;

export type LoadProgress = (msg: string) => void;

function attachLogListener(ff: FFmpeg) {
  if (logListenerAttached) return;
  ff.on("log", ({ message }) => {
    for (const subscriber of logSubscribers) subscriber(message);
  });
  logListenerAttached = true;
}

export async function getFFmpeg(onLog?: LoadProgress): Promise<FFmpeg> {
  if (onLog) logSubscribers.add(onLog);
  if (ffmpegSingleton) {
    attachLogListener(ffmpegSingleton);
    return ffmpegSingleton;
  }
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ff = new FFmpeg();
    attachLogListener(ff);
    // Load the single-thread core from bundled app assets instead of a third-
    // party CDN so video uploads do not fail with generic network errors.
    await ff.load({
      coreURL: await toBlobURL(coreURL, "text/javascript"),
      wasmURL: await toBlobURL(wasmURL, "application/wasm"),
    });
    ffmpegSingleton = ff;
    return ff;
  })();

  return loadingPromise;
}

export async function withFFmpegLogs<T>(onLog: LoadProgress, task: (ff: FFmpeg) => Promise<T>): Promise<T> {
  logSubscribers.add(onLog);
  try {
    const ff = await getFFmpeg();
    return await task(ff);
  } finally {
    logSubscribers.delete(onLog);
  }
}

/**
 * Tears down the ffmpeg worker. Used to hard-cancel a render — ffmpeg.wasm
 * cannot interrupt a running exec any other way — and to recover memory after
 * a failed pass. The next getFFmpeg() boots a fresh instance.
 */
export function resetFFmpeg() {
  const ff = ffmpegSingleton;
  ffmpegSingleton = null;
  loadingPromise = null;
  logListenerAttached = false;
  logSubscribers.clear();
  try { ff?.terminate(); } catch { /* already gone */ }
}

/** Captures ffmpeg log output while running a task (used for stream probing). */
export async function captureFFmpegLogs<T>(task: (ff: FFmpeg) => Promise<T>): Promise<{ result: T | null; logs: string; error: unknown }> {
  const lines: string[] = [];
  const collect = (m: string) => { lines.push(m); };
  logSubscribers.add(collect);
  try {
    const ff = await getFFmpeg();
    const result = await task(ff);
    return { result, logs: lines.join("\n"), error: null };
  } catch (error) {
    return { result: null, logs: lines.join("\n"), error };
  } finally {
    logSubscribers.delete(collect);
  }
}

export { fetchFile };
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

export { fetchFile };
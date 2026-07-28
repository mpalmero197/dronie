import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";

let ffmpegSingleton: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

export type LoadProgress = (msg: string) => void;

export async function getFFmpeg(onLog?: LoadProgress): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ff = new FFmpeg();
    if (onLog) {
      ff.on("log", ({ message }) => onLog(message));
    }
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

export { fetchFile };
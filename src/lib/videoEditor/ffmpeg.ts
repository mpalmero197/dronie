import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

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
    // unpkg multi-thread build is heavier; use single-thread core for portability.
    const baseURL = "https://unpkg.com/@ffmpeg/[email protected]/dist/umd";
    await ff.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegSingleton = ff;
    return ff;
  })();

  return loadingPromise;
}

export { fetchFile };
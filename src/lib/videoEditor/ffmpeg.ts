import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegSingleton: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

export type LoadProgress = (msg: string) => void;

const FFMPEG_CORE_VERSION = "0.12.10";
const FFMPEG_CORE_CDN_BASES = [
  `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`,
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`,
];

async function coreAssetBlobUrl(fileName: string, mimeType: string): Promise<string> {
  let lastError: unknown = null;

  for (const baseUrl of FFMPEG_CORE_CDN_BASES) {
    try {
      return await toBlobURL(`${baseUrl}/${fileName}`, mimeType);
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Failed to fetch";
  throw new Error(`Could not load the video processor. Please check your connection and try again. (${message})`);
}

export async function getFFmpeg(onLog?: LoadProgress): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ff = new FFmpeg();
    if (onLog) {
      ff.on("log", ({ message }) => onLog(message));
    }
    // Use the single-thread core for portability. Try two CDNs so a transient
    // CDN outage does not surface to users as the generic "Failed to fetch".
    await ff.load({
      coreURL: await coreAssetBlobUrl("ffmpeg-core.js", "text/javascript"),
      wasmURL: await coreAssetBlobUrl("ffmpeg-core.wasm", "application/wasm"),
    });
    ffmpegSingleton = ff;
    return ff;
  })();

  return loadingPromise;
}

export { fetchFile };
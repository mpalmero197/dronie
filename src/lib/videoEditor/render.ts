import { getFFmpeg, fetchFile } from "./ffmpeg";
import { EditorProject, FilterPreset, TransitionKind, totalDuration } from "./types";
import { buildAss } from "./ass";

export type RenderProgress = (pct: number, msg: string) => void;

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
 * Render full project to MP4 in browser via ffmpeg.wasm.
 * Strategy:
 *   1. For each clip, run a single ffmpeg pass that trims + speed + filter +
 *      scales/pads to target canvas, normalizing pix_fmt and timebase.
 *   2. Use xfade/concat to join them.
 *   3. Burn-in subtitles + text overlays via libass (single ASS file).
 */
export async function renderProject(project: EditorProject, onProgress: RenderProgress): Promise<Blob> {
  if (project.clips.length === 0) throw new Error("No clips to render");
  const ff = await getFFmpeg((m) => onProgress(-1, m));
  const W = project.width;
  const H = project.height;
  const FPS = project.fps;

  onProgress(2, "Loading source clips…");

  // 1) Write all source files
  for (let i = 0; i < project.clips.length; i++) {
    const c = project.clips[i];
    const data = await fetchFile(c.src);
    const ext = (c.name.split(".").pop() || "mp4").toLowerCase();
    await ff.writeFile(`in${i}.${ext}`, data);
  }

  // 2) Normalize each clip into a uniform intermediate (still as mp4, since wasm core lacks rawvideo encoder safety)
  const segs: string[] = [];
  for (let i = 0; i < project.clips.length; i++) {
    const c = project.clips[i];
    const ext = (c.name.split(".").pop() || "mp4").toLowerCase();
    const inFile = `in${i}.${ext}`;
    const outFile = `seg${i}.mp4`;
    const segDur = (c.outS - c.inS) / Math.max(0.1, c.speed);

    const vfParts: string[] = [];
    if (c.speed !== 1) vfParts.push(`setpts=${(1 / c.speed).toFixed(4)}*PTS`);
    const f = filterFor(c.filter);
    if (f) vfParts.push(f);
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

    const args = [
      "-ss", c.inS.toFixed(3),
      "-to", c.outS.toFixed(3),
      "-i", inFile,
      "-vf", vf,
      ...(af ? ["-af", af] : []),
      "-r", String(FPS),
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-ar", "44100",
      "-ac", "2",
      "-shortest",
      "-t", segDur.toFixed(3),
      outFile,
    ];
    await ff.exec(args);
    segs.push(outFile);
    // free source
    try { await ff.deleteFile(inFile); } catch {}
  }

  // 3) Combine — either xfade chain (if any non-"none" transitions) or concat demuxer
  let combined = "combined.mp4";
  const hasTransitions = project.clips.slice(0, -1).some((c) => c.transitionToNext !== "none");

  if (segs.length === 1) {
    combined = segs[0];
  } else if (!hasTransitions) {
    // concat demuxer
    const list = segs.map((s) => `file '${s}'`).join("\n");
    await ff.writeFile("concat.txt", new TextEncoder().encode(list));
    onProgress(45, "Joining clips…");
    await ff.exec([
      "-f", "concat", "-safe", "0", "-i", "concat.txt",
      "-c", "copy",
      combined,
    ]);
  } else {
    // xfade chain
    onProgress(45, "Building transitions…");
    const inputs: string[] = [];
    segs.forEach((s) => { inputs.push("-i", s); });

    // compute per-clip durations
    const durs: number[] = project.clips.map((c) => (c.outS - c.inS) / Math.max(0.1, c.speed));

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
    await ff.exec([
      ...inputs,
      "-filter_complex", filter,
      "-map", lastV,
      "-map", lastA,
      "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-ar", "44100",
      combined,
    ]);
  }

  // 4) Burn ASS overlay (captions + text) if any
  const hasOverlays =
    (project.captions.enabled && project.captions.burnIn && project.captions.cues.length > 0) ||
    project.texts.length > 0;

  let finalFile = combined;
  if (hasOverlays) {
    onProgress(85, "Burning captions and text…");
    const ass = buildAss(project);
    await ff.writeFile("subs.ass", new TextEncoder().encode(ass));
    finalFile = "out.mp4";
    await ff.exec([
      "-i", combined,
      "-vf", `ass=subs.ass`,
      "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
      "-c:a", "copy",
      finalFile,
    ]);
  }

  onProgress(98, "Finalizing…");
  const out = await ff.readFile(finalFile);
  const u8 = out as Uint8Array;
  // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer typing issues with Blob.
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  const blob = new Blob([ab], { type: "video/mp4" });

  // cleanup
  for (const s of segs) { try { await ff.deleteFile(s); } catch {} }
  try { await ff.deleteFile("concat.txt"); } catch {}
  try { await ff.deleteFile("subs.ass"); } catch {}
  if (combined !== finalFile) { try { await ff.deleteFile(combined); } catch {} }
  try { await ff.deleteFile(finalFile); } catch {}

  onProgress(100, "Done");
  return blob;
}

/** Probe a video URL/Blob URL for duration + dimensions in the browser. */
export function probeVideo(src: string): Promise<{ durationS: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.crossOrigin = "anonymous";
    v.src = src;
    v.onloadedmetadata = () => {
      resolve({ durationS: v.duration || 0, width: v.videoWidth || 1920, height: v.videoHeight || 1080 });
      v.remove();
    };
    v.onerror = () => reject(new Error("Could not read video metadata"));
  });
}
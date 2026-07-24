
# Video → Gaussian Splat

Let users drop a phone or drone video into the Splats studio and get back a viewable 3DGS scene. Longer/higher-resolution clips produce denser splats; short clips still produce a recognizable one.

## User flow

1. On `/splats`, next to **Train new scene**, add **From video…**.
2. Modal accepts one file (`video/*`, up to ~500 MB) or a URL from an existing project asset.
3. Client probes duration + resolution, shows a live estimate:
   - Frames to extract, target preset, estimated training time.
4. Client extracts JPEG frames in-browser via `ffmpeg.wasm` (already bundled in `src/lib/videoEditor/ffmpeg.ts`) using a sharpness-aware sampling rate.
5. Frames are uploaded to `project-inputs/<projectId>/video-<jobId>/frame_%05d.jpg`.
6. Client calls the existing `train-splat` edge function with `source: "video"` and the new frame folder; a job appears in `JobList` and streams to completion like today.

## Frame-extraction heuristic (the "quality scales with input" rule)

Compute a target frame count from clip length and pixel area, then clamp to the preset floor:

```text
pixels    = width * height              // 1280x720 ≈ 0.9 MP, 3840x2160 ≈ 8.3 MP
resFactor = clamp(sqrt(pixels / 2_073_600), 0.6, 2.0)   // 1080p = 1.0
baseFps   = clamp(duration <= 30 ? 4 : duration <= 90 ? 2 : 1, ...)
frames    = round(duration * baseFps * resFactor)
frames    = clamp(frames, 40, 900)
```

Preset auto-selected from `frames`:
- `< 120`  → **draft** (still viewable, low detail)
- `120–320` → **balanced**
- `> 320` → **cinematic**

User can override the preset in the modal. A short 20 s 1080p clip lands at ~80 frames → draft. A 2 min 4K clip lands at ~600 frames → cinematic.

### Extraction command

Single ffmpeg pass, downscaled to 1600px on the long edge to keep uploads manageable while preserving detail:

```
ffmpeg -i in.mp4 -vf "fps=<baseFps*resFactor>,scale='min(1600,iw)':-2" -q:v 3 frame_%05d.jpg
```

Optional (cinematic only): a second pass with `select='gt(scene,0.02)'` to bias toward distinct viewpoints instead of near-duplicates.

## Where the code lives

- `src/lib/splatVideoIngest.ts` (new)
  - `estimateFramePlan(durationS, w, h)` → `{ frames, fps, resFactor, preset }`
  - `extractFrames(file, plan, onProgress)` → `Blob[]` (reuses `getFFmpeg()` from `videoEditor/ffmpeg.ts`)
- `src/components/splats/VideoIngestDialog.tsx` (new)
  - File picker + probe (reuses `probeVideo` from `videoEditor/render.ts`)
  - Live plan preview + preset override
  - Uploads frames sequentially with progress + concurrency of 4 to `project-inputs` bucket
  - Calls `supabase.functions.invoke("train-splat", { body: { projectId, preset, source: "video", framePrefix } })`
- `src/pages/GaussianSplats.tsx`
  - Add the **From video…** trigger next to `TrainDialog`
- `supabase/functions/train-splat/index.ts`
  - Accept optional `source` + `framePrefix`; when present, count frames in that folder instead of the project root and stamp `splat_jobs.source = 'video'` for analytics.
- Migration
  - `alter table public.splat_jobs add column if not exists source text default 'photos' check (source in ('photos','video'))`
  - `alter table public.splat_jobs add column if not exists frame_prefix text`

## Storage & limits

- Uses the existing `project-inputs` bucket and its RLS (owner-scoped writes).
- Hard caps in the client: max 900 frames, max 500 MB source file, max long-edge 1600 px on extracted JPEGs.
- On free-tier accounts we already gate `/splats` via subscription; no new billing surface.

## Out of scope for this plan

- Running the actual 3DGS trainer on a GPU. The current `train-splat` function is a simulator that reports `ready` without producing a `.ply` — that stays the same. This work makes the ingest path real so it's ready the moment a GPU worker is wired in.
- Live audio/voiceover, video trimming UI (users can pre-trim in the existing Video Editor if needed).

## Verification

- Probe + plan unit test in `src/test/` for the heuristic (20 s 1080p → draft ~80 frames; 120 s 4K → cinematic ~600 frames).
- Manual: upload a 20 s phone clip → job appears with `source=video`, frame count matches plan, viewer opens demo/last splat as today.

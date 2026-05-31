
# Make every "conceptual" feature actually work

There are four parts of the app that today *pretend* to work. I'll replace each with a real, paid third-party service that I can call from edge functions. You don't need to run any infrastructure — you only need to create an account on each service and paste the API key when I ask.

---

## 1. Photogrammetry processing → WebODM Lightning

Today `process-project` falls back to a simulator that writes a 1×1 green PNG and a text file labeled `# Dronie reconstructed mesh (placeholder)` when WebODM isn't configured. I'll remove that whole code path.

**Service:** [WebODM Lightning Network](https://webodm.net) by OpenDroneMap. Pay-as-you-go (~$1–5 per task), no servers to run, REST API.

What I'll do:
- Add two secrets: `WEBODM_LIGHTNING_TOKEN`, plus reuse existing `WEBODM_URL` pointed at `https://webodm.net`.
- Rewrite `process-project` to upload the project's drone images to Lightning, poll the task, and stream the real orthomosaic (.tif), DSM, point cloud (.laz), and textured mesh (.obj/.glb) back into the `project-outputs` bucket.
- Delete `runSimulatedProcessing`, `generateOrthomosaicPlaceholder`, and the synthesized accuracy report. The real Lightning response includes a genuine quality report.
- If the token is missing, the Process button is disabled in the UI with a clear "Set up WebODM Lightning to enable processing" message instead of silently faking it.

**You'll need:** a WebODM Lightning account + an API token (free to create, charges per task).

---

## 2. Gaussian Splatting training → Replicate

Today `train-splat` uses `setTimeout` to fake a status sequence (`queued → preparing → training → done`) and writes nothing. No GPU is involved.

**Service:** [Replicate](https://replicate.com) — runs `gaussian-splatting` models on real GPUs and returns a `.ply` / `.splat` file. ~$0.50–$3 per scene depending on size.

What I'll do:
- Add secret `REPLICATE_API_TOKEN`.
- Rewrite `train-splat` to:
  1. Zip the project's images from storage and upload them to Replicate.
  2. Start a prediction against a published 3DGS model (default: `camenduru/gaussian-splatting`).
  3. Poll until done, download the resulting `.ply`, upload to `project-outputs/<project>/splats/<job>.ply`.
  4. Persist real `psnr`, `training_seconds`, `image_count` from the model's metrics on the `splat_jobs` row.
- Update `splat-job-status` to read real status fields.
- The existing viewer already supports `.ply`/`.splat`/`.ksplat`, so it just works.

**You'll need:** a Replicate account + API token.

---

## 3. Fleet "live telemetry & camera feeds" → Cloudflare Stream Live

Today drones can have a "demo video upload" mode that just plays a pre-recorded file out of the `drone-demos` bucket. There's no actual RTMP ingest.

**Service:** [Cloudflare Stream Live](https://www.cloudflare.com/products/cloudflare-stream/) — $5/month + ~$1 per 1,000 minutes delivered. Accepts RTMP from any drone ground-station (DJI RC Pro, Litchi, etc.) and produces HLS playback in a `<video>` tag.

What I'll do:
- Add secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_TOKEN`.
- New edge function `fleet-live-input`: creates a Cloudflare Live Input per drone on demand and stores the RTMP URL + stream key + playback HLS URL on the `drones` row (new columns `rtmps_url`, `rtmps_key`, `hls_playback_url`).
- Replace `StreamSourcePicker` so the "Live RTMP" option shows the operator the RTMP endpoint to paste into their controller, plus a copy-to-clipboard. The "demo upload" option stays available but is clearly labeled "Test mode (pre-recorded clip)".
- Replace any placeholder/animated map dot with real telemetry: I'll wire `live-telemetry` to a Supabase Realtime channel that the drone or a paired phone publishes GPS to. Until a real telemetry source is connected the map shows "Awaiting telemetry" — no fake numbers.

**You'll need:** a Cloudflare account (free to create) + an API token with `Stream:Edit`.

---

## 4. Reality Capture viewer → real 3D rendering

`RealityCapture.tsx` currently renders a static colored `<PlaceholderBox>` cube instead of the project's actual reconstruction.

What I'll do (no new service needed — purely frontend):
- Use `@react-three/fiber` + `@react-three/drei` (already in the project) to load the real `.glb` / `.obj` mesh and `.laz`/`.ply` point cloud that WebODM produced, with orbit controls, measurement tool, and screenshot export.
- Remove `PlaceholderBox` entirely.

---

## 5. Sweep for the rest

I'll grep the codebase for any remaining `simulat`, `mock`, `fake`, `placeholder`, `coming soon`, or `demo data` references and either wire them to real data or hide the UI. Known small ones already found:
- The "AI Insights" page already calls a real Lovable AI model — no change.
- Any "demo" sample projects seeded for new users will be moved to a clearly labeled `Sample` tab so they never look like real data.

---

## Order of execution

1. Ask for the three secrets (`WEBODM_LIGHTNING_TOKEN`, `REPLICATE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_TOKEN`).
2. Ship WebODM Lightning integration + delete the processing simulator.
3. Ship Replicate splat training + delete the splat simulator.
4. Ship Cloudflare Stream live ingest + replace demo-only stream mode.
5. Ship real 3D Reality Capture viewer.
6. Final grep sweep for any leftover placeholder copy and fix.

After approval, the first thing I'll do is open the secret-entry forms so you can paste keys; I won't be able to deploy the new edge functions until those exist.

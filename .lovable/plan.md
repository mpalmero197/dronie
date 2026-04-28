## Goal

Make Dronie's photogrammetry services feel like a real production pipeline: smarter inputs (presets + QA), live per-stage progress, richer deliverables, and a more honest WebODM/NodeODM integration.

## What we'll build

### 1. Processing settings & industry presets (ProjectDetail.tsx)

- Add a **preset selector** above the existing settings panel:
  - **Mapping (orthomosaic)** — high quality, 2.5D mesh, DSM on, point density 50%.
  - **Inspection (towers/roofs)** — ultra quality, 3D mesh, dense cloud focus.
  - **3D Model** — ultra, 3D mesh, no DSM/contours.
  - **Agriculture / NDVI** — medium, 2.5D, contours off, multispectral hint.
  - **Volumetrics** — high, DSM+DTM on, contours 0.5 m.
  - Custom (current behavior).
- Add **target GSD (cm/px)** and **image scale** inputs, **min features**, **matcher** (BoW vs Brute Force) — collapsible "Advanced".
- Add **cost & time estimator** card: estimates duration and credits from `image_count`, area_ha, quality preset (pure client-side formula). Shows queue position from existing API response.
- Persist `settings` JSON on the project row (`outputs_urls.settings` already used for error; introduce `processing_settings` jsonb column).

### 2. Pre-flight Quality Check (new `ImageQAReport` component)

Before "Start Processing", run a client-side QA on uploaded images using already-extracted GPS points:
- **GPS coverage**: % of images with GPS, plotted on `GpsMapPreview` heatmap.
- **Estimated forward/side overlap** from sequential GPS distances vs altitude.
- **Spatial extent / convex hull area** sanity check.
- **Image count vs area** density warning (e.g., < 100 img / ha → low).
- Surfaced as a Pass/Warn/Fail badge with actionable tips.
- Hard-block "Start Processing" only on Fail (e.g., < 3 GPS points), warn otherwise.

### 3. Live per-stage progress (process-project edge function + ProjectDetail UI)

Backend changes:
- Add new columns: `current_stage text`, `stage_progress int`, `stage_started_at timestamptz`, `eta_seconds int`, and `stage_log jsonb` (append-only array of `{stage, message, ts, level}`).
- In `runWebODMProcessing`, map WebODM `running_progress` more granularly into named stages (alignment 0–20, dense cloud 20–45, mesh 45–60, texture 60–70, ortho 70–85, DSM/DTM 85–95, export 95–100) and push log entries from WebODM `console_output` deltas.
- In `runSimulatedProcessing`, do the same with realistic per-stage durations + synthesized log lines.

Frontend:
- Replace the current threshold-based `StepIndicator` with a realtime view subscribed via `supabase.channel` to `projects` UPDATEs.
- Each stage card shows its own progress bar, elapsed time, and ETA. Active stage shows the latest log lines (collapsible).
- Add **Cancel processing** button (calls a new `cancel-project` action on the edge function which sets status `failed` with reason `canceled` and aborts WebODM task via `/api/projects/<id>/tasks/<task>/cancel/`).

### 4. Richer deliverables & viewers (ProjectDetail Outputs tab)

- **Thumbnails / previews** for each deliverable:
  - Orthomosaic → preview PNG (already produced for simulated; for WebODM grab `orthophoto.png`).
  - Point cloud → preview screenshot from `RealityCapture` snapshot or static placeholder, plus "Open in 3D Viewer" link.
  - DSM → small color-ramp preview generated from the ASCII grid.
  - Contours → mini SVG of the GeoJSON.
- **Accuracy report panel**: surface RMSE, GSD, reprojection error, # tie points, # GCP residuals from WebODM `task_output.json` when available; in simulated mode, derive plausible numbers from settings & image count.
- **Bulk download as ZIP**: client-side zip of selected deliverables using `fflate` (already in many lovable projects; add via `bun add fflate` if missing).
- **Share link**: shareable read-only deliverables URL `/share/p/:token` (token stored in `projects.outputs_urls.share_token`); RLS-safe public read via signed URLs from the public `project-outputs` bucket.
- Direct deep-links into Map Viewer (`/viewer/:projectId`), Reality Capture (`/reality?project=:id`), AI Insights (`/insights?project=:id`).

### 5. Post-processing QA summary

- New `ProcessingReport` panel on completed projects:
  - Per-stage durations bar chart (from `stage_log`).
  - Image registration stats (registered vs total, mean reprojection error).
  - GCP residuals table when GCPs were provided.
  - Generated PDF: extend `generateReportPDF` to include accuracy + per-stage timing.

### 6. Workflow page polish (Workflow.tsx StageProcessing)

- Show all currently-processing projects with a compact queue view, not just the latest.
- Use the new stage data so the workflow page mirrors ProjectDetail's live stages.

## Backend changes

```text
DB migration:
  ALTER TABLE projects
    ADD COLUMN processing_settings jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN current_stage text,
    ADD COLUMN stage_progress int DEFAULT 0,
    ADD COLUMN stage_started_at timestamptz,
    ADD COLUMN eta_seconds int,
    ADD COLUMN stage_log jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN webodm_task_id text,
    ADD COLUMN canceled_at timestamptz;

  ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;  -- if not already
```

Edge functions:
- `process-project`: write the new columns; better stage mapping; honor `canceled_at` to abort.
- `cancel-project` (new): owner-only; calls WebODM cancel + updates row.

## Files to touch

- `supabase/migrations/<new>.sql` — schema + realtime.
- `supabase/functions/process-project/index.ts` — stage mapping, log entries, cancel check, accuracy fields, WebODM cancel.
- `supabase/functions/cancel-project/index.ts` — new.
- `src/pages/ProjectDetail.tsx` — presets, QA, live stages, richer outputs.
- `src/components/project/PresetPicker.tsx` — new.
- `src/components/project/ImageQAReport.tsx` — new.
- `src/components/project/LivePipeline.tsx` — new (subscribes + renders stages with logs/ETA).
- `src/components/project/DeliverableCard.tsx` — new (thumbnail + actions).
- `src/components/project/AccuracyReport.tsx` — new.
- `src/pages/Workflow.tsx` — use `LivePipeline`.
- `src/pages/Share.tsx` — new shared deliverables view + route in `App.tsx`.

## Notes

- WebODM/NodeODM is already opt-in via `WEBODM_URL` + `WEBODM_TOKEN` secrets. We'll keep the simulator as a fallback so demos still work; if you want to wire a real instance now, I'll prompt you to add those secrets after the plan is approved.
- All client-side QA & estimation are heuristic — clearly labeled as estimates so users know what's authoritative once processing finishes.


## Best Gaussian Splatting Software for Drones (2026)

Based on the leading 2026 industry comparison, the tools that matter for **drone** workflows are:

1. **DJI Terra V5.0+** — the gold standard for *aerial* GS. Georeferenced, batch, RTK-aware.
2. **PostShot** (Jawset) — best offline desktop trainer, full parameter control.
3. **Nerfstudio / gsplat** — open-source research trainer, latest methods (Mip-Splatting, 3DGS-MCMC).
4. **Luma AI** — fastest cloud trainer from any video.
5. **Polycam** — strong mobile/LiDAR companion to drone capture.
6. **SuperSplat** — browser-based GS *editor* (crop/clean/optimize).
7. **SplatForge** — Blender addon for animation/VFX compositing.

### Feature gaps in Dronie today

`src/pages/GaussianSplats.tsx` already supports: project picker, .ply/.splat/.ksplat upload, three.js viewer (mkkellogg), splat scale, alpha cutoff, spherical harmonics toggle, auto-orbit, download, delete.

Missing vs. the leaders:

| Capability | Source of inspiration | Have it? |
|---|---|---|
| Train GS directly from project images (cloud) | Luma, DJI Terra | No |
| Training preset & quality control (iterations, density) | PostShot, Nerfstudio | No |
| Georeferenced / RTK metadata on scene | DJI Terra | No |
| Crop / clean / cull splats (box select, region delete) | SuperSplat | No |
| Export to multiple formats (.splat, .ksplat, .glb, .ply) | Polycam, Luma | Partial (re-download only) |
| Cinematic camera path & MP4 flythrough render | Luma, SplatForge | Partial (orbit only) |
| Measurement tool (distance between two points) | DJI Terra, Polycam | No |
| Compare GS vs. point cloud / mesh side by side | DJI Terra | No |
| Public share link / embed iframe | Luma, SuperSplat | No |
| Scene metadata: training time, image count, PSNR | Nerfstudio | No |

---

## Plan: features to add

### A. Training pipeline (Cloud)

- New edge function `train-splat` that:
  - Lists images in `project-inputs/{projectId}/`
  - Submits a job to a GPU trainer (initially a stubbed/queued status row in a new `splat_jobs` table; integrates with existing WebODM/processing pipeline already in the project for structure-from-motion priors).
  - Writes resulting `.ply` to `project-outputs/{projectId}/splats/`.
- New table `splat_jobs (id, project_id, user_id, status, preset, iterations, image_count, psnr, training_seconds, created_at)` with RLS (owner-only).
- UI: "Train new scene" button on `/splats` opens a dialog with:
  - Quality preset: **Draft / Balanced / Cinematic** (maps to iterations 7k / 30k / 50k).
  - Toggle: spherical harmonics degree (0/1/2/3).
  - Toggle: densification interval.
  - Toggle: use RTK/EXIF georef priors when present.
- Live job list with status chips (queued → training → ready → failed) and PSNR/training-time badges once done.

### B. SuperSplat-style editing

Add a second tab on `/splats` called **Edit** with:
- Box-select crop (drag a 3D box, delete splats outside).
- Region delete (lasso projected to camera).
- Color/alpha threshold filter with live preview.
- "Save as new scene" (writes a cleaned `.ply` back to storage, never destroys the original).

### C. Cinematic flythrough renderer

Replace the simple auto-orbit with a keyframed camera-path tool:
- Click **Add keyframe** to capture the current camera pose.
- Reorder keyframes, set per-segment duration & easing.
- **Preview** in-viewer; **Export MP4** via a server function that renders frames headlessly (ffmpeg in edge function or queued job — falls back to WebCodecs MP4 muxer client-side for short clips).

### D. Measurement & geo overlay

- Two-click **Measure** tool — projects clicks onto nearest splat depth, shows distance in meters.
- If the project has RTK/EXIF georef, show a small lat/lon/alt readout in the corner and a north arrow gizmo.

### E. Multi-format export

After viewing a scene, **Export as** menu:
- `.ply` (raw), `.splat` (compact), `.ksplat` (web-optimized; convert via mkkellogg's KSplatLoader writer), `.glb` (mesh proxy via gsplat-to-mesh), share link.

### F. Public share / embed

- "Share" button generates a tokenized public URL `/embed/splats/:token` that mounts a read-only viewer.
- New table `splat_shares (token, asset_path, project_id, expires_at)` with public select policy keyed on token.
- Iframe snippet shown in a copy box.

### G. Comparison view

- Toggle **Compare** to split the viewport: GS on left, WebODM mesh/point cloud on right (loaded from existing `project-outputs/.../odm_*` paths). Cameras are linked.

### H. Landing-page section

Add a **"Photoreal Gaussian Splatting"** feature block on `/` (Index) summarizing: train from drone images, edit in browser, cinematic export, georeferenced, share with one link. CTA to `/splats`.

---

## Technical details

- Frontend: extend `src/pages/GaussianSplats.tsx` (split into tabs: **View / Train / Edit / Share**). New components under `src/components/splats/`:
  - `TrainDialog.tsx`, `JobList.tsx`, `KeyframeBar.tsx`, `MeasureOverlay.tsx`, `EditTools.tsx`, `ShareDialog.tsx`, `CompareViewport.tsx`.
- DB migrations:
  - `splat_jobs` table + RLS (`user_id = auth.uid()`).
  - `splat_shares` table + tokenized public-read RLS.
  - Index on `splat_jobs(project_id, created_at desc)`.
- Edge functions:
  - `train-splat` (POST: { projectId, preset, sphDegree }) → enqueues row, returns id.
  - `splat-job-status` (GET: { id }) — polled by client.
  - `render-flythrough` (POST: { assetPath, keyframes, fps, seconds }) — returns signed URL to MP4. Uses ffmpeg via headless render queue; if unavailable, returns 501 and the client falls back to WebCodecs.
  - `convert-splat-format` (POST: { src, target }) — converts .ply ↔ .splat ↔ .ksplat in Deno.
- Reuse existing `project-outputs` storage bucket; add `splats/edits/` and `splats/renders/` subfolders.
- Keep current `@mkkellogg/gaussian-splats-3d` viewer; add `three`'s `BoxHelper` and a custom raycaster against splat positions for measurement and crop.
- Analytics: emit `splats_train_started`, `splats_export`, `splats_share_created`, `splats_flythrough_rendered` via the existing `track()` helper.

## Out of scope (for this round)

- Actually standing up a GPU training cluster — the `train-splat` function will queue the job and mark it `simulated` until a real GPU backend is wired (mirrors the existing WebODM fallback pattern already used in the processing pipeline).
- Native mobile capture (Polycam-style) and Blender plugin (SplatForge-style).

## Deliverables

- New tabbed `/splats` experience with Train, Edit, Cinematic, Share, Compare.
- Two new DB tables + RLS, four edge functions.
- Landing-page feature block linking to `/splats`.
- Memory updated: `mem://features/gaussian-splatting` documenting presets, formats, and share-token flow.

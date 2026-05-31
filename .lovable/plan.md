# Improve Gaussian Splatting (3DGS) across Dronie

Goal: turn the existing `/splats` studio from a generic uploader into an opinionated 3DGS workflow that teaches users *how* to capture, warns them about the failure modes that wreck splats, and prepares the pipeline for heavy explicit particle datasets.

## 1. Capture guidance module (new)
New component `src/components/splats/CaptureRequirements.tsx` shown above the project picker on `/splats` and inside `TrainDialog` as an info accordion. Covers:
- Required flight pattern: overlapping **nadir + oblique** (≥70% front / 60% side overlap, two altitudes, orbit pass for verticals).
- SfM dependency: GPS/RTK preferred; warns that pose quality dictates final fidelity.
- Recommended image count band per preset (Draft 80–150, Balanced 200–400, Cinematic 500+).
- Link to a new `/docs/3dgs-capture` markdown page (lightweight in-app doc using existing landing-page styling).

## 2. Pre-flight 3DGS checklist
Extend `src/components/pilot/MissionChecklist.tsx` with a 3DGS-specific variant (or new `SplatPreflightChecklist.tsx`) surfaced when the user picks a "Photoreal 3D / Splat" preset in `PlanWizard` and inside `TrainDialog`:
- Static scene confirmed (no traffic, water, crowd)
- Wind below threshold (foliage motion warning)
- Stable lighting window (no fast-moving shadows; avoid golden hour for long flights)
- Mechanical shutter preferred; rolling-shutter drones flagged with a soft warning sourced from `src/lib/drone-catalog.ts`
- Overlap + oblique pass confirmed
- RTK / GCPs available (recommended)

State persists per project in `localStorage` so the user can revisit.

## 3. Train dialog upgrades
Update `src/components/splats/TrainDialog.tsx`:
- Add an **environment self-assessment** section (3 toggles: static scene, stable light, RTK/GCP). If any are off, show inline impact warnings using copy from the spec's `operational_limitations_for_user_warnings`.
- Add an **image-count sanity check** comparing detected `image_count` from `train-splat` against preset minimums; block submit with a clear message if too low.
- Add a "rolling shutter detected" advisory when the project's drone model maps to a known rolling-shutter sensor.

No backend schema change — extra flags are sent in the request body and stored on `splat_jobs` via a new nullable `capture_flags jsonb` column (migration in step 6).

## 4. Streaming-friendly viewer pipeline
`src/pages/GaussianSplats.tsx`:
- Prefer `.ksplat` when multiple formats exist for the same scene (already best for web), show a "Compressed" badge.
- Add a client-side size guard: if asset > 250 MB, show a banner recommending `.ksplat` conversion and link to a new edge function stub `convert-splat` (returns "queued" — real conversion is out of scope but the surface is in place).
- Add progressive loading UI: show MB streamed / total via fetch `ReadableStream`, so multi-GB files give feedback instead of appearing frozen.

## 5. Landing + features copy
- `src/components/SplatHighlightSection.tsx`: rewrite body copy to explain the shift from mesh/NeRF photogrammetry to explicit Gaussians — real-time rasterization, view-dependent color via spherical harmonics — and add a small "What can go wrong" strip listing the 5 limitations as chips with tooltips.
- `src/components/FeaturesSection.tsx`: tighten the Gaussian Splatting card subtitle to mention "explicit particles, real-time render, capture-sensitive."
- Add a new short FAQ entry in `src/components/FaqSection.tsx`: "Why did my splat come out blurry?" → summarises lighting / motion / pose causes.

## 6. Minor schema + analytics
- Migration: `ALTER TABLE public.splat_jobs ADD COLUMN capture_flags jsonb` (nullable, no policy changes needed; existing RLS still applies).
- Extend `train-splat` edge function to persist `capture_flags` from request body.
- Add `track()` events: `splats_preflight_warning_shown`, `splats_preflight_overridden`, `splats_capture_doc_opened`.

## Technical notes
- All new copy lives in components, no i18n layer required.
- Reuse existing semantic tokens (`primary`, `accent`, `highlight`) — no new colors.
- Rolling-shutter list seeded from public drone specs in `src/lib/drone-catalog.ts` (add a `rollingShutter: boolean` field; default `true` for consumer DJI, `false` for Mavic 3E mech-shutter, M3M, P1 etc.).
- Doc page is a plain route in `src/App.tsx`; no MDX dependency added.

## Out of scope
- Real GPU trainer / real `.ply → .ksplat` conversion (still simulated as today, surfaces only).
- Vector quantization implementation.
- Editing / cropping splats in-browser.

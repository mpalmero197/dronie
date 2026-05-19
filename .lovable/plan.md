
# Watch-a-Mission: end-to-end product demo

## Goal
A single "Watch a Mission" experience that drives the **real** Dronie pages (not a video, not a mock route) through every stage of a photogrammetry job, end to end. Triggered from the marketing site and from `/dashboard`. Auto-advances by default, with Next/Prev/Pause and "Take control" to exit into the live app at the current step.

## Stages it walks through

```
1. Plan         /missions/new           Draw AOI, MissionCalculator, footprint/overlap preview
2. Export       /missions/new           Generate KMZ, "Open in DJI Fly" handoff card
3. Fly (live)   /fleet/live/:droneId    Telemetry HUD + camera feed playing real DJI Fly clip
4. Complete     /fleet/live/:droneId    Mission-complete toast → "View in project"
5. Process      /project/:id            Stage log animates queued → SfM → dense → ortho → mesh
6. Deliver      /project/:id            Ortho/DSM/pointcloud viewers, download bundle
```

Each stage is the **actual page** with a demo overlay (step chip, caption, Next/Prev/Pause/Exit). The demo seeds and drives a real `projects` row and a real `drones` row so RLS, queries, and UI all behave normally.

## What's real vs. scripted

| Piece | Source |
| --- | --- |
| AOI polygon, calculator inputs | Scripted (typed into real inputs via a controller hook) |
| KMZ export | Real `exportKMZ()` call, downloadable |
| DJI Fly handoff card | Real component, with QR + deep link |
| Drone telemetry on map | Scripted writes to `drones` (lat/lng/battery/heading) on a timer, real Realtime subscription renders it |
| Camera feed | Real `<video>` playing a DJI Fly capture from `drone-demos` bucket (need 1 clip from you, or I'll use the existing `stream_demo_path` sample) |
| Processing stages | Scripted updates to `projects.current_stage` / `stage_progress` / `stage_log`, real ProjectDetails UI renders them |
| Deliverables | Pre-seeded sample ortho/DSM/pointcloud already in `project-outputs` (reuse existing demo assets if present; otherwise I'll generate placeholder GeoTIFF + LAZ thumbnails) |

No new data model. Demo only **writes** to existing tables it owns (a dedicated `demo@dronieapp.com`-style ephemeral session, or the current user's own seeded "Demo project").

## Implementation

### 1. Demo runtime (frontend only)
- `src/demo/DemoController.tsx` — context with `currentStep`, `play/pause/next/prev/exit`, route-aware.
- `src/demo/steps.ts` — declarative step list: `{ id, route, caption, durationMs, run: async (ctx) => void }`.
- `src/demo/DemoOverlay.tsx` — fixed bottom bar (step N/6, caption, progress, controls). Hidden when `exit`ed.
- `src/demo/useScriptedInput.ts` — utility to programmatically set Zustand store values or dispatch input events on real fields, so MissionCalculator etc. update without forking components.

### 2. Entry points
- New route `/demo` that mounts `DemoController` then redirects to step 1's route.
- "Watch 90-second demo" CTA on `HeroSection` and a "Take the tour" button on `/dashboard`.

### 3. Seed + cleanup
- On demo start: insert a `projects` row (`name: "Demo — Riverside Quarry"`, `user_id: auth.uid()`) and a `drones` row (`assigned_pilot_id: auth.uid()`, `stream_mode: 'demo'`, `stream_demo_path` pointing at the DJI clip).
- On exit / finish: soft-keep them (user can replay) but mark with `description: '__demo__'` so they're filterable; add a "Reset demo" button.
- Requires the user to be signed in. If anonymous on `/demo`, show a one-click "Continue as demo user" that signs them in with a pre-provisioned `demo@dronieapp.com` account (I'll add this account via migration + seed; password stored only in the edge function that issues a magic-link).

### 4. Live-flight simulation
- A `useDemoFlightTicker(droneId)` hook updates the drone's lat/lng along the planned path every 500 ms using `supabase.from('drones').update(...)`. The existing `/fleet/live` realtime subscription picks it up — no changes to that page.
- Camera: existing `stream_mode='demo'` + `stream_demo_path` already renders the video. I just need to confirm one good DJI Fly clip is uploaded to `drone-demos`.

### 5. Processing simulation
- `useDemoProcessingTicker(projectId)` updates `current_stage`, `stage_progress`, `stage_log`, `progress` to mirror real WebODM stages. ProjectDetails already renders these.
- Final state writes `outputs_urls` pointing to pre-seeded sample deliverables in `project-outputs`.

### 6. Verification
- After build, I drive the demo with the browser tool end-to-end (all 6 steps), screenshot each, and confirm: KMZ downloads, drone marker animates, video plays, processing bar fills, deliverables render and download.

## What I need from you (asset-level)

1. **DJI Fly aerial clip** (mp4, ~30–60 s, downward/oblique). If you don't have one handy, I'll fall back to whatever's already in the `drone-demos` bucket and we can swap later.
2. Confirmation that I can create a `demo@dronieapp.com` user for the anonymous entry point (or you'd rather demo require sign-in).
3. Whether the demo should write into a **dedicated demo project per user** (replayable, leaves a row behind) or into an **ephemeral in-memory project** (no DB writes, but `/fleet/live` and `/project/:id` won't show it through their normal queries — would require fork). I recommend option A.

## Out of scope (call out, do later)
- Real RTK/PPK processing
- Actual DJI Fly SDK integration (we're only doing the KMZ handoff + a played-back clip)
- Multi-language captions
- Mobile-portrait optimization of the overlay (will work, won't be polished)

## Files I'll add / edit
- add: `src/demo/{DemoController.tsx, DemoOverlay.tsx, steps.ts, useScriptedInput.ts, useDemoFlightTicker.ts, useDemoProcessingTicker.ts, seed.ts}`
- add: `src/pages/Demo.tsx` (mounts controller, routes to step 1)
- edit: `src/App.tsx` (route + provider)
- edit: `src/components/HeroSection.tsx` (CTA)
- edit: `src/pages/Dashboard.tsx` (CTA)
- edit: `src/components/project/MissionCalculator.tsx` (expose imperative ref for scripted input — minimal)
- migration: ensure `drones.stream_mode='demo'` path is enabled; seed sample deliverable URLs if missing
- (optional) edge function: `demo-signin` to issue a magic link for the shared demo account

Once you confirm scope + the three asset questions above, I'll build it in one pass and verify each step in the browser.

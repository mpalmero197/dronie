
# Production-readiness pass — remove remaining demo paths

A scan of the codebase found a handful of surfaces that still ship hard-coded demo data, fake animated progress, or `Math.random()` fixtures. These are the last stand-in pieces from the prototype phase. The plan below converts each to live, customer-grade behavior backed by Supabase, then runs a security/linter sweep on the published site.

## What's still demo today

```text
Page / file                                  Issue
───────────────────────────────────────────  ────────────────────────────────────────────────
src/pages/Gallery.tsx                        Hard-coded DEMO_MAPS list, all link to /viewer/demo
src/pages/MapViewer.tsx                      DEMO_PROJECT object served when projectId === "demo"
src/components/HeroSection.tsx               "See Example Maps" CTA → /viewer/demo
src/pages/Dashboard.tsx                      Map Viewer link falls back to /viewer/demo
src/pages/Workflow.tsx                       StageGroundControl seeds 3 fake GCPs, EXIF reader
                                             fabricates lat/lng with Math.random; processing
                                             pipeline animates fake progress on a setInterval;
                                             Geospatial stage shows synthetic SVG ortho/DEM
src/pages/AiInsights.tsx                     Hard-coded CLASSES + metrics (stockpile, thermal,
                                             vegetation %, etc.) used both on screen and in PDF
src/pages/Compliance.tsx                     SEED_LOGS, SEED_MAINT, SEED_AIRSPACE arrays;
                                             LAANC submit is a fake setTimeout
supabase/functions/process-project/index.ts  Falls back to runSimulatedProcessing when WEBODM
                                             env vars aren't set — generates 1×1 PNG ortho
```

## Changes

### 1. Public marketing surfaces — sample maps must actually open

- **Gallery (`/gallery`)** — Pull real, completed public-facing projects instead of `DEMO_MAPS`. Two options that don't require new schema:
  - Query `projects` where `status = 'complete'` and the owner is a designated showcase account (admin role), ordered by `created_at desc`.
  - If no public projects exist yet, render an empty state ("Sample maps coming soon — be the first to publish one") with CTAs to `/auth` and `/dashboard`. No fake cards.
- **HeroSection / Dashboard** — change "See Example Maps" + Dashboard sidebar fallback to navigate to `/gallery` instead of `/viewer/demo`. Gallery handles the "nothing yet" state.
- **MapViewer** — remove `DEMO_PROJECT`, `DEMO_CENTER`, `isDemo` branch. If a visitor hits `/viewer/demo` (old links), redirect to `/gallery`.

### 2. Workflow page — wire to real project data

The `/workflow` page is a 4-stage walkthrough: Plan → Capture → Process → Analyze. Today only "Plan" is real (it computes GSD from camera specs). The other three stages will be re-grounded:

- **Capture stage** — replace seeded GCPs with the same live `ground_control_points` table that `/rtk` already uses (project-scoped, RLS-owned). Image drop becomes a real upload to the `drone-images` bucket; EXIF is parsed in-browser with [`exifr`](https://github.com/MikeKovarik/exifr) (already-style dependency) — if a JPEG has no GPS tags, the row shows "—" rather than fabricated coordinates.
- **Processing stage** — instead of the fake `setInterval` progress bar, this stage now reflects the user's most recent processing project: subscribe to that project row and show real `progress` (0-100) plus the WebODM/queue stage from `process-project`. If the user has no in-flight project, render an empty state with a button that links to `/dashboard` to start one.
- **Geospatial stage** — drop the synthetic SVG ortho/DEM/DTM canvas. Replace with a thumbnail + "Open in Map Viewer" button that deep-links to the most recent complete project (`/viewer/:id`). Cut/fill numbers stay only if we can compute them from real outputs; otherwise the panel goes away.

### 3. AI Insights (`/insights`) — real metrics or honest empty state

- Pull the user's most recent `complete` project. If it has `outputs_urls` that include classification/volume data, show those numbers; otherwise display a clear "No insights yet — finish processing a project to populate this dashboard."
- The PDF report only generates when real metrics exist. No placeholder values like "Stockpile 12,840 m³" baked in.
- Remove the hand-painted segmented overlay; render the project's real orthomosaic thumbnail (from `project-outputs` bucket) as the base if present.

### 4. Compliance (`/compliance`) — back with real records

- **Flight log** — read from `mission_logs` + `jobs` for the signed-in pilot (already RLS-scoped). Aggregate hours, 90-day count, etc., from real rows. "Manual entry" button opens a small dialog that inserts a `mission_logs` row.
- **Maintenance** — new lightweight table `drone_maintenance` (`id, drone_id, task, due_date, cycles_left, health_pct, created_at`) with RLS scoping rows to the drone's pilot or admins. Seed empty; admins add tasks from the existing Fleet Management page (small "Maintenance" tab added there).
- **Airspace + LAANC** — keep the panel, but populate it from the existing LAANC checker logic on the map (already real) rather than a hard-coded `SEED_AIRSPACE` array. The "Submit LAANC" button calls the same flow used in `MapViewer`'s `LaancChecker`.
- **Pilot 107 currency** — add `pilot_certifications` table (`user_id, cert_type, issued_at, expires_at, notes`) with owner-scoped RLS. Show the user's real cert dates; KPI strip computes from those rows.

### 5. Processing pipeline — drop the simulated fallback for paying users

`process-project` currently runs `runSimulatedProcessing` when `WEBODM_URL` / `WEBODM_TOKEN` aren't set, which produces a 1×1 PNG and fake progress. For a published product, we change behavior:

- If WebODM env vars are configured → real WebODM processing (unchanged).
- If they are not configured → return a clear `503` to the client: "Processing is temporarily unavailable — our team has been notified." The project goes to status `failed` with a friendly message instead of a fake green tick.
- Add a one-line note in the readme/docs (and an inline comment) explaining the operator must set `WEBODM_URL` + `WEBODM_TOKEN` to enable processing. We do not silently fabricate outputs.

### 6. Cleanup + security pass

- Remove `stream_demo_path` UI affordances from `AddDroneDialog` / `EditDroneDialog` and `StreamSourcePicker` (the column stays in the DB so existing rows aren't broken; the picker just hides the "demo file" tab).
- Run the Supabase database linter and the security scanner; fix any RLS gaps surfaced (especially on the new `drone_maintenance` and `pilot_certifications` tables).
- Verify every new edge function path returns CORS headers on errors, and that all client → function calls authenticate the user.

## Out of scope (won't touch this round)

- Visual / branding redesign.
- New Stripe tiers or pricing changes.
- Replacing the current Three.js viewer in `/reality` (already real).
- The OpenSky live traffic toggle on `/swarm` (already real via the `live-telemetry` edge function).

## Files touched (high level)

```text
src/pages/Gallery.tsx                       rewrite — fetch real projects or empty state
src/pages/MapViewer.tsx                     remove DEMO_*; redirect /viewer/demo → /gallery
src/pages/Dashboard.tsx                     remove '/viewer/demo' fallback
src/components/HeroSection.tsx              CTA → /gallery
src/pages/Workflow.tsx                      capture/process/analyze stages → real data + empty states
src/pages/AiInsights.tsx                    pull real project metrics; empty state when none
src/pages/Compliance.tsx                    pull mission_logs / new tables; remove seed arrays
src/components/fleet/FleetManagement.tsx    add tiny "Maintenance" tab (admin)
src/components/fleet/{Add,Edit}DroneDialog  hide stream_demo_path option
supabase/functions/process-project/index.ts remove runSimulatedProcessing fallback
supabase/migrations/<new>.sql               add drone_maintenance + pilot_certifications + RLS
```

## DB migration (new tables, with RLS)

```sql
create table public.drone_maintenance (
  id uuid primary key default gen_random_uuid(),
  drone_id uuid not null,
  task text not null,
  due_date date not null,
  cycles_left integer not null default 0,
  health_pct integer not null default 100 check (health_pct between 0 and 100),
  status text not null default 'open',
  created_at timestamptz not null default now()
);
alter table public.drone_maintenance enable row level security;
create policy "Pilots view maintenance for own drones"
  on public.drone_maintenance for select to authenticated
  using (exists (select 1 from public.drones d
                 where d.id = drone_id and d.assigned_pilot_id = auth.uid()));
create policy "Admins manage all maintenance"
  on public.drone_maintenance for all to authenticated
  using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));

create table public.pilot_certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  cert_type text not null,
  issued_at date not null,
  expires_at date not null,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.pilot_certifications enable row level security;
create policy "Users manage own certifications"
  on public.pilot_certifications for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## Acceptance checks

- No `Math.random()`, `setTimeout`-based fake progress, or hard-coded `DEMO_*` arrays remain in `src/pages` (CI-style grep at the end).
- `/gallery`, `/insights`, `/compliance`, `/workflow` either show real per-user data or a clear empty state — never fabricated numbers.
- A new visitor hitting `/viewer/demo` lands on `/gallery`.
- `process-project` no longer silently fakes a 1×1 PNG; it either runs WebODM or returns a real error and marks the project failed.
- Supabase linter + security scanner come back clean for the new tables.

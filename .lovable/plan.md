
## What the website claims vs. what exists

### Currently functional:
- Auth (sign up/login) ✓
- Create/delete projects ✓
- Upload KML/KMZ flight plans ✓
- Upload drone images ✓
- Admin role ✓

### What the website promises but is not yet real:

**Processing pipeline** (Hero card, "How It Works" step 02)
- Projects sit at "queued" forever with no actual processing simulation
- Need: a "Submit for Processing" button that moves a project through `queued → processing → complete` with realistic sub-step progress (image alignment → dense point cloud → orthomosaic → DSM → contours)
- Will use a background edge function + realtime progress updates so the progress bar actually moves

**Map Viewer** (Features: "Share interactive maps via a link")
- Currently no `/viewer` route exists
- Need: a `/viewer/:projectId` page using Leaflet showing an orthomosaic placeholder tile layer with zoom, pan, ruler measurement tool, and annotation pins
- Dashboard "Eye" button should open this viewer
- A shareable public link (no auth required)

**Downloads / Export** (Features: GeoTIFF, LAS, SHP, KMZ, DXF; "How It Works" step 04)
- No outputs tab exists in ProjectDetailDialog
- Need: an "Outputs" tab in ProjectDetailDialog that lists available outputs (GeoTIFF, LAZ, DSM_DTM, Contours_SHP, Report_PDF) with download buttons once project is complete

**Team Collaboration / Invite** (Features section)
- No team/invite UI exists
- Need: a "Share" button on each project that generates a shareable viewer link (public URL) — this ties into the map viewer above

**Hero CTA buttons** ("Upload Images Free", "See Example Maps")
- Both buttons are dead/unlinked
- "Upload Images Free" → link to /auth or /dashboard
- "See Example Maps" → link to a demo viewer page

**Sidebar nav links** (Map Viewer, Analytics, Storage)
- All dead buttons
- Map Viewer → `/viewer` (or latest complete project)
- Analytics and Storage can show simple read-only stats panels in the dashboard (not full pages, just toggle the main content area)

**Pricing CTAs** ("Get Started", "Start Free Trial", "Contact Sales")
- All dead buttons
- Wire to /auth for the first two

---

## Implementation plan

### 1. Processing simulation (edge function + realtime)
- Create `supabase/functions/process-project/index.ts` — an edge function that:
  - Accepts `{ project_id }` in the request body
  - Validates the user's JWT
  - Runs a series of `UPDATE projects SET progress = X, status = 'processing'` updates with 2-second delays simulating steps: alignment (0→35%), point cloud (35→65%), orthomosaic (65→85%), DSM (85→95%), finalise (95→100%)
  - On complete: sets `status = 'complete'`, populates `outputs` array with `['GeoTIFF', 'LAZ', 'DSM', 'DTM', 'Contours SHP', 'Flight Report PDF']`
- Enable realtime on `projects` table
- Dashboard subscribes to realtime channel for the user's projects → progress bar updates live

### 2. Map Viewer page (`/viewer/:projectId`)
- New page `src/pages/MapViewer.tsx`
- Uses `react-leaflet` (already a well-known package) with OpenStreetMap tiles as stand-in orthomosaic base
- Features: zoom/pan, ruler (Leaflet.measure or simple distance calculation), drop annotation pins
- Public access — no auth required for viewing, but project must be `complete`
- Floating info card: project name, area, image count, date
- Share button copies URL to clipboard

### 3. Outputs tab in ProjectDetailDialog
- Add a third tab "Outputs" to the existing dialog
- Shows list of output files from `project.outputs[]` with file-type icons and mock download buttons (for complete projects)
- For non-complete projects, shows a "Processing required" prompt with a "Submit for Processing" button that calls the edge function

### 4. Wire hero CTAs + sidebar nav + pricing buttons
- Hero "Upload Images Free" → `/auth`
- Hero "See Example Maps" → `/viewer/demo` (a demo viewer with placeholder data)
- Sidebar "Map Viewer" → last complete project's viewer or `/viewer/demo`
- Sidebar "Analytics" → toggles a simple stats view showing chart of projects by status
- Pricing "Get Started" / "Start Free Trial" → `/auth`
- Pricing "Contact Sales" → mailto or a simple contact modal

### Files to create/modify:
- `supabase/functions/process-project/index.ts` (new)
- `src/pages/MapViewer.tsx` (new)
- `src/pages/Dashboard.tsx` (add realtime subscription, wire sidebar nav, add analytics panel)
- `src/components/ProjectDetailDialog.tsx` (add Outputs tab + Submit for Processing button)
- `src/components/HeroSection.tsx` (wire CTA buttons)
- `src/components/PricingSection.tsx` (wire CTA buttons)
- `src/App.tsx` (add `/viewer/:projectId` route)
- `supabase/migrations/` (enable realtime on projects table)
- `package.json` / install `react-leaflet` + `leaflet`

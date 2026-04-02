

## 2D Map Preview for Project Detail Page

### Overview
Add a Leaflet map to the project detail page that plots GPS coordinates extracted from uploaded drone images. The map will appear between the description and the main grid, showing markers for each image location and a polygon/bounds overlay.

### Changes Required

**1. Database: Add `gps_points` JSONB column to `projects` table**
- Migration to add a `gps_points` column (JSONB, nullable) storing the extracted GPS array from processing
- Format: `[{lat, lng, alt, camera, date}, ...]`

**2. Edge function: Save GPS points after extraction**
- In `supabase/functions/process-project/index.ts`, include `gps_points` in the final project update (alongside `outputs`, `outputs_urls`, etc.)

**3. Update `Project` type in `src/lib/supabase.ts`**
- Add `gps_points` field to the `Project` interface

**4. New component: `src/components/project/GpsMapPreview.tsx`**
- Leaflet map (~200px tall) using OpenStreetMap tiles
- Plots markers for each GPS point with popup showing lat/lng/alt
- Auto-fits bounds to show all points
- Shows a convex hull polygon connecting the outermost points
- Displays point count and estimated area in a small overlay
- Handles empty state gracefully (hidden when no GPS data)

**5. Integrate into `ProjectDetail.tsx`**
- Import and render `GpsMapPreview` after the description section, before the main grid
- Pass `project.gps_points` as props
- Only render when GPS data exists (after processing or if coordinates are available)

### Technical Notes
- Leaflet is already used in the project (MapViewer page), so no new dependencies needed
- The map will use the same tile layer as the main map viewer
- GPS points are extracted during processing; the map only appears once processing has completed and GPS data is stored


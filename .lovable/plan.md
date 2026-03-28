

# Terrain-Following Mode + Save/Load Flight Plans

## 1. Terrain-Following Mode in Flight Planner

**File**: `src/components/map/FlightPlanner.tsx`

Add a terrain-following toggle that queries the **Open-Elevation API** (free, no key) to get ground elevation at each waypoint, then adjusts each waypoint's altitude to maintain constant AGL (Above Ground Level).

- Add `terrainFollow: boolean` to `FlightParams`
- When enabled, after generating waypoints, batch-query `https://api.open-elevation.com/api/v1/lookup` with all waypoint coordinates
- Adjust each waypoint's export altitude: `targetAGL + groundElevation`
- Display min/max terrain elevation and altitude variation in stats panel
- Show a toggle switch in the control panel labeled "Terrain Following"
- Store per-waypoint adjusted altitudes for KML/CSV export (update `generateKML` and `generateCSV` to accept per-waypoint altitudes)
- Add a visual indicator: color-code waypoint markers by relative altitude (green=low, yellow=mid, red=high)

## 2. Save & Load Flight Plans to Database

**Database migration**: New `saved_flight_plans` table to store plan parameters (not just uploaded files like the existing `flight_plans` table):

```sql
CREATE TABLE public.saved_flight_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  polygon jsonb NOT NULL,
  home_position jsonb,
  params jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_flight_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved flight plans" ON public.saved_flight_plans
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**File**: `src/components/map/FlightPlanner.tsx`
- Add "Save Plan" button that stores current polygon, home position, and all params as JSON
- Add "Load Plan" dropdown/modal listing saved plans with name + date
- Add a name input field (shown on save)
- Use `supabase` client to insert/select from `saved_flight_plans`
- For demo mode (no auth), show a toast explaining save requires login
- Add delete capability for saved plans

## 3. MapViewer Integration

**File**: `src/pages/MapViewer.tsx`
- Pass `projectId` to `FlightPlanner` so it can associate saved plans with projects

## Files Summary

| File | Action |
|------|--------|
| `src/components/map/FlightPlanner.tsx` | Add terrain-following mode, save/load UI, elevation query logic |
| `src/pages/MapViewer.tsx` | Pass projectId prop to FlightPlanner |
| Migration | New `saved_flight_plans` table |


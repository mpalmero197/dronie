

# Interactive Flight Path Builder — Maps Made Easy Style

## Problem
Currently, flight planning requires a two-step workflow: (1) select the polygon draw tool, (2) draw and double-click to finish, (3) then the flight planner consumes it. Professional apps like Maps Made Easy and DroneLink let you click directly on the map to build your survey area while seeing the flight path generate in real-time. Vertices are fully editable inline — drag, add, and delete — without switching tools.

## What Changes

### 1. Integrated polygon drawing inside FlightPlanner
When the flight planner opens in grid/perimeter mode without a polygon, clicking the map adds vertices one at a time. After 3+ points, the flight path previews in real-time. No need to double-click to "finish" — the polygon is always live and editable. A "Close Polygon" button finalizes, but the path is visible as-is.

### 2. Midpoint handles on polygon edges
Small semi-transparent circles appear at the midpoint of each polygon edge. Dragging one inserts a new vertex at that position, splitting the edge — exactly like Maps Made Easy and Google My Maps.

### 3. Vertex deletion
Right-clicking (or long-pressing on mobile) a vertex handle shows a "Delete vertex" option. Minimum 3 vertices enforced.

### 4. Inline corridor drawing
Same integrated click-to-add-points experience for corridor mode — click to extend the polyline, drag handles to adjust, midpoint handles to add points.

### 5. Undo/Redo for polygon edits
Each vertex add/move/delete is tracked so Ctrl+Z and Ctrl+Y work within the flight planner context.

### 6. Real-time path preview during drawing
After 3+ vertices are placed, the lawnmower/perimeter path renders immediately and updates as you add or move points — no "finish drawing" step required.

## Technical Details

### Files modified

**`src/components/map/FlightPlanner.tsx`**
- Add an internal drawing state machine: `idle` → `drawing` → `editing`
- Register map click handler when in `drawing` state to append vertices to `surveyPolygon` (via `onPolygonEdit`)
- Add midpoint marker layer: for each edge `[i, i+1]`, render a semi-transparent draggable `Marker` at the midpoint. On `dragend`, splice a new vertex into the polygon array
- Add right-click handler on vertex markers to delete that vertex (if length > 3)
- Track edit history (vertex adds/moves/deletes) in a local undo stack
- Show "Start Drawing" / "Add Points" / "Done" button states in the panel
- Remove the "Draw a polygon on the map" empty state prompt — replace with a "Tap the map to place survey points" instruction with a pulsing dot animation

**`src/pages/MapViewer.tsx`**
- When flight planner opens, no longer force `activeTool` to `"polygon"` — the FlightPlanner handles its own click events
- Pass a new `onStartDrawing` callback so the flight planner can signal it's capturing map clicks (disabling other map interactions)
- Remove the dependency on `MapDrawingLayer.onPolygonComplete` for flight planning — the FlightPlanner manages its own polygon lifecycle

**`src/components/map/FlightPlanner.tsx` — new UI elements**
- "Add Point" mode toggle button in the panel header
- Vertex count indicator ("5 vertices")
- "Clear Area" button to reset and start over
- Midpoint handle icon: smaller, semi-transparent version of the vertex icon with a `+` indicator

### New midpoint handle icon
```typescript
const midpointIcon = new L.DivIcon({
  html: `<div style="width:10px;height:10px;border-radius:50%;background:rgba(37,99,235,0.4);border:2px solid rgba(255,255,255,0.7);cursor:pointer"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});
```

### State machine
```text
┌──────────┐   click "Draw Area"   ┌──────────┐   3+ points    ┌──────────┐
│   IDLE   │ ────────────────────▶ │ DRAWING  │ ─────────────▶ │ EDITING  │
│ no poly  │                       │ clicking  │  path visible  │ drag/add │
└──────────┘                       │ on map    │                │ /delete  │
                                   └──────────┘                └──────────┘
                                        ▲                           │
                                        └───── "Add Points" ───────┘
```

### Corridor mode
Same pattern: click to add corridor line points, drag to adjust, midpoint handles to insert.

## Summary of UX improvements
- Single-click to start placing survey points — no tool switching
- Flight path appears as soon as 3 points are placed
- Drag any vertex to reshape; path updates live
- Click edge midpoints to add detail where needed
- Right-click vertex to delete it
- Undo/redo for all polygon edits
- Clear and restart without closing the planner


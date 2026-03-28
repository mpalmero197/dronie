

## Plan: Enrich Map Viewer with New Features

### What exists today
Drawing tools, measurement, overlays (elevation/NDVI/airspace), address search, property line import, parcel fetcher, flight planner, LAANC checker, layer switcher, PNG export, embed, share.

### New features to add

**1. Live Coordinate Display (MousePositionDisplay)**
- Shows lat/lng under the cursor in real-time at the bottom-right corner
- Click to copy coordinates to clipboard
- Toggle between decimal degrees, DMS, and UTM formats

**2. "Locate Me" Geolocation Button**
- GPS button in the toolbar that flies the map to the user's current location
- Adds a pulsing blue dot at their position with accuracy circle
- Uses browser `navigator.geolocation` API

**3. Right-Click Context Menu**
- Copy coordinates at click point
- Drop pin here
- Measure from here
- Center map here
- What's here? (reverse geocode via Nominatim)

**4. Map Scale Bar**
- Add Leaflet's built-in `ScaleControl` (metric + imperial)

**5. Fullscreen Toggle**
- Button to enter/exit browser fullscreen mode on the map container
- Uses `document.fullscreenElement` API

**6. Weather Widget**
- Small collapsible panel showing current conditions at map center (wind speed/direction, temp, visibility)
- Uses Open-Meteo free API (no key needed)
- Critical for drone flight planning (wind speed affects flight safety)

**7. Sun Position / Golden Hour Indicator**
- Calculates sun altitude and azimuth for the map center
- Shows sunrise/sunset times and golden hour windows
- Uses pure math (solar position algorithm) — no API needed
- Useful for drone photography planning

**8. Undo/Redo for Drawings**
- Track drawing history stack in MapDrawingLayer
- Undo/Redo buttons at top of toolbar
- Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z

### Files to create
- `src/components/map/MousePositionDisplay.tsx` — cursor coordinate tracker
- `src/components/map/MapContextMenu.tsx` — right-click menu
- `src/components/map/WeatherWidget.tsx` — weather panel using Open-Meteo
- `src/components/map/SunPosition.tsx` — sun/golden hour calculator
- `src/components/map/GeolocationButton.tsx` — GPS locate button

### Files to modify
- `src/pages/MapViewer.tsx` — integrate all new components, add fullscreen toggle, add ScaleControl
- `src/components/map/MapToolbar.tsx` — add geolocation, fullscreen, undo/redo buttons; add new DrawTool types
- `src/components/map/MapDrawingLayer.tsx` — add undo/redo history stack, expose undo/redo callbacks

### Technical notes
- Open-Meteo API is free, no key required: `https://api.open-meteo.com/v1/forecast?latitude=X&longitude=Y&current_weather=true`
- Sun position calculated with standard solar equations (no external dependency)
- Context menu positioned at click point using absolute positioning over the map
- All new UI panels follow existing design patterns (glassmorphic cards, compact sizing)


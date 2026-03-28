

# No-Fly Zone / Airspace Restriction Overlays

## Overview

Add a toggleable airspace overlay to the map viewer that displays FAA-regulated airspace zones (controlled airspace, restricted areas, TFRs) using the **OpenAIP** free API, which provides worldwide airspace data as GeoJSON.

## Data Source

**OpenAIP** provides free airspace data at `https://api.core.openaip.net/api/airspaces`. However, it requires a free API key. As a more accessible alternative, we can use the **FAA UAS Facility Map** KML data which is publicly available, or render static well-known US airspace classes from a bundled GeoJSON.

**Chosen approach**: Use the **OpenAIP** tiles endpoint which serves airspace as raster tiles without an API key: `https://api.tiles.openaip.net/api/data/airspaces/{z}/{x}/{y}.png`. This is the simplest integration — just a TileLayer overlay. Additionally, we'll query the OpenAIP API for detailed airspace polygons near the map center for interactive info popups (this requires a free API key, so we'll make it optional and degrade gracefully).

**Fallback**: If the tile endpoint requires auth or is unreliable, we'll use a simpler approach: query the **FAA TFR (Temporary Flight Restrictions)** GeoJSON feed from `https://tfr.faa.gov` and overlay known US airspace classes from a static dataset.

## Implementation

### 1. New Component: `AirspaceOverlay.tsx`

- Renders OpenAIP airspace tiles as a Leaflet `TileLayer` with semi-transparent overlay
- Adds a legend showing airspace class colors (Class A-E, Restricted, Prohibited, TFR)
- Color coding: Red = Prohibited/Restricted, Orange = Class B, Yellow = Class C, Green = Class D, Blue = Class E
- When active, clicking an airspace zone shows a popup with class, name, and altitude limits (if data available)

### 2. Update `MapToolbar.tsx`

- Add an "Airspace" overlay button (using `ShieldAlert` icon) to the OVERLAYS array
- Toggle shows/hides the airspace tile layer

### 3. Update `OverlayLegend.tsx`

- Add an `"airspace"` type that renders a legend with color-coded airspace classes

### 4. Update `MapViewer.tsx`

- Import and render `AirspaceOverlay` when `activeOverlay === "airspace"`
- Pass through to the overlay legend

## Files

| File | Action |
|------|--------|
| `src/components/map/AirspaceOverlay.tsx` | **Create** — TileLayer overlay + optional GeoJSON query |
| `src/components/map/MapToolbar.tsx` | **Edit** — Add airspace to OVERLAYS |
| `src/components/map/OverlayLegend.tsx` | **Edit** — Add airspace legend |
| `src/pages/MapViewer.tsx` | **Edit** — Render AirspaceOverlay conditionally |


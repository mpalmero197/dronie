# Add four new drone-job verticals

Adds **Power Washing**, **Pest Control & Spraying**, **Film, Events & Weddings**, and **Telecom & Tower Inspection** everywhere existing verticals appear (landing pages, marketplace filter, pilot signup, Verticals section).

## 1. Database (migration)

Extend the `public.industry_vertical` enum with four new values so pilots can opt into them and clients can post requests:

- `power_washing`
- `pest_control`
- `film_events`
- `telecom`

Postgres `ALTER TYPE ... ADD VALUE IF NOT EXISTS` — no data backfill needed; existing rows unaffected.

## 2. `src/lib/marketplace.ts`

Extend `IndustryVertical` union and `VERTICAL_LABELS`:

- `power_washing` → "Power Washing & Exterior Cleaning"
- `pest_control` → "Pest Control & Spraying"
- `film_events` → "Film, Events & Weddings"
- `telecom` → "Telecom & Tower Inspection"

Also add a few new deliverable options where relevant (e.g. `soft_wash_report`, `spray_map`, `event_highlight_reel`, `tower_inspection_report`) so posted requests can select them.

## 3. `src/pages/solutions/verticals.config.ts`

Add four `VerticalConfig` entries with realistic drafted copy — headline, intro, four value props each, deliverable chips, example clients, and an appropriate `lucide-react` icon + accent gradient:

| Slug | Icon | Accent |
|---|---|---|
| power_washing | Droplets | sky→cyan |
| pest_control | Bug | lime→emerald |
| film_events | Clapperboard (or Film) | rose→fuchsia |
| telecom | RadioTower | violet→indigo |

Each entry mirrors the shape of existing verticals (Construction, Real Estate, etc.) with 4 value props, ~4 deliverables, and an `exampleClients` line.

Sample draft (Power Washing):
- Tagline: "Soft-wash from the sky, no ladders required"
- Value props: Roof soft-wash missions · Solar panel rinse & yield boost · Multi-story façade cleaning · Before/after aerial proof reports
- Deliverables: Soft-wash plan · Before/after photos · 3D façade scan · Cleaning coverage map
- Clients: Roofing contractors, solar O&M, HOAs, commercial property managers

Similar drafted copy for the other three (spraying with NDVI targeting, cinematic multi-cam event reels, tower defect capture with no climb).

They automatically flow into `VERTICAL_LIST`, driving `VerticalsSection`, `MarketplaceNew`, `PilotSignup`, `PilotsMap`, and `VerticalPilotsSection`.

## 4. Sitemaps

Regenerate `public/sitemap-solutions.xml` (and refresh the solutions section in `public/sitemap.xml` / `sitemap-static.xml`) so the four new `/solutions/<slug>` URLs are indexed.

## 5. Verification

- `tsgo` typecheck (union changes ripple).
- Load `/solutions/power_washing`, `/solutions/pest_control`, `/solutions/film_events`, `/solutions/telecom` in the preview and confirm they render with the drafted copy and correct icon.
- Confirm the new verticals appear in the `VerticalsSection` grid on the home page and in the marketplace vertical filter.

## Out of scope

No changes to pricing, routing structure, or bot content. No new pages beyond what `VerticalLanding` already renders per slug.

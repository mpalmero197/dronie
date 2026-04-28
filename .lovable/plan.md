## Goal

On each `/solutions/:vertical` page (Construction, Real Estate, Agriculture, Energy, Mining, Insurance, Government), show a section listing pilots who have that vertical selected in their pilot profile. This makes the solutions pages immediately useful: visitors can see real pilots who serve that industry and click through to their portfolio or message them.

## How it works

- Pilots already pick their verticals when they sign up (`pilot_profiles.verticals` array).
- The existing `get_public_pilots()` RPC already returns each pilot's verticals, display name, service area, hourly rate, years of experience, Part 107 / insured flags, portfolio URL, and avatar — and only returns pilots who are `available = true` and `show_on_map = true`. No DB changes needed.
- We filter that list client-side by the current vertical slug.

## Changes

1. **New component** `src/components/solutions/VerticalPilotsSection.tsx`
   - Takes `vertical: IndustryVertical` and `verticalName: string` as props.
   - On mount, calls `supabase.rpc("get_public_pilots")` and filters where `verticals.includes(vertical)`.
   - Renders a responsive card grid (3 cols desktop, 1 col mobile) showing up to 8 pilots, with:
     - Avatar, display name, service area label
     - Years experience, hourly rate (if set)
     - Part 107 / Insured badges
     - "View portfolio" link (to `/u/:username` if available, else `portfolio_url`)
     - "Hire" button → `/marketplace/new?vertical={slug}`
   - Empty state: "No pilots have listed {vertical} yet — be the first." with a CTA link to `/pilot/signup`.
   - Loading skeletons while fetching.
   - "See all pilots" link → `/pilots` (existing PilotsMap page).

2. **Edit** `src/pages/solutions/VerticalLanding.tsx`
   - Insert `<VerticalPilotsSection vertical={config.slug} verticalName={config.name} />` between the "Deliverables" section and the final CTA.

3. **Tiny helper** in the new component: a `formatRate(cents)` util (mirrors existing `formatBudget` style) and a Lucide-icon header ("Pilots who fly {name}").

## Privacy & security

- Uses the existing `get_public_pilots()` SECURITY DEFINER function, which already enforces:
  - Only `available = true` pilots
  - Only `show_on_map = true` pilots
  - Returns the privacy-safe `display_lat/lng` (jittered), never the precise `service_lat/lng`
- No new RLS or DB migration required.

## Out of scope

- No changes to pilot signup, fleet, or marketplace.
- No server-side filtering RPC; the public pilot list is small and already cached client-side. If it grows large later we can add a `_vertical` arg to the RPC.

## Files

- **Create**: `src/components/solutions/VerticalPilotsSection.tsx`
- **Edit**: `src/pages/solutions/VerticalLanding.tsx`

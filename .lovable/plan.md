## Goals

1. Show pilots on a public map with their service area, but jitter their displayed coordinates by ~5 miles for privacy (toggleable per pilot).
2. Let businesses sign up as organizations, add pilots to their roster, and get prompted to confirm recertification when any pilot's cert expires.
3. Add a clear liability disclaimer (responsibility for keeping certs current is on the pilot/business; Dronie + affiliates not liable for damages, losses, disputes, etc.).

---

## 1. Pilot map with privacy jitter

### Database
Add to `pilot_profiles`:
- `show_on_map boolean not null default true` — pilot opts into public map visibility.
- `location_privacy boolean not null default true` — when true, displayed location is jittered ~5 miles (default ON).
- `display_lat double precision`, `display_lng double precision` — pre-computed jittered coords, regenerated on save when `service_lat/lng` or `location_privacy` change. Raw `service_lat/lng` stay private.

Create a public RPC `get_public_pilots()` returning only safe fields (display_name, bio, years_experience, verticals, skills, equipment, part_107, insured, portfolio_url, hourly_rate_cents, service_area_label, service_radius_km, **display_lat/lng only**). Anonymous role can call this. Tighten the existing `Authenticated can view available pilots` policy so raw `service_lat/lng` aren't exposed to other authenticated users either — switch the public discovery path to use the RPC.

Jitter logic (in app code on save): random bearing 0–360°, random distance 6–10 km (~4–6 mi) added to lat/lng using a small haversine offset. Stored, not recomputed per request, so the marker doesn't shimmy on each load.

### UI
- New page `/pilots` (`src/pages/PilotsMap.tsx`): Leaflet map listing all pilots with `show_on_map=true`. Each marker opens a popup with name, area label, verticals, rate, "Hire" button (links to `/marketplace/new?pilot=<id>` or pilot's portfolio).
- Add "Find pilots" link to `Navbar` Solutions/Marketplace area.
- In `PilotSignup.tsx`: add two switches in a new "Privacy" card:
  - "Show me on the public pilot map" (`show_on_map`)
  - "Hide my exact location (recommended)" (`location_privacy`) — with help text: *"Your pin on the public map is shifted by roughly 5 miles in a random direction so clients can see your service area without targeting your exact location. Turn this off only if you're comfortable showing your precise base."*

---

## 2. Organization (business) accounts

### Database
- New enum value: extend `app_role` with `'org_admin'` (or use existing `admin` only inside org scope — cleaner to add `org_admin`).
- New table `organizations`: `id`, `owner_id` (auth user), `name`, `website`, `contact_email`, `phone`, `verified boolean default false`, timestamps. RLS: owner manages, public can view name/website only via a public view.
- New table `organization_members`: `id`, `org_id`, `user_id` (the pilot's auth.users id, nullable for invited-not-yet-joined), `invited_email`, `role text` (`owner` | `manager` | `pilot`), `status` (`invited` | `active` | `removed`), timestamps. Unique `(org_id, user_id)`.
- New table `organization_invites`: `id`, `org_id`, `email`, `token`, `expires_at`, `accepted_at`. Pilot accepts via `/orgs/accept?token=…`.
- `pilot_certifications` already exists — add column `recert_confirmed_at timestamptz` and `recert_required boolean default false` (set true by a daily edge function or computed view when `expires_at < now()`).
- RLS: org owners/managers can `select` their org members' `pilot_certifications` (read-only) so they can see expiry status. Pilots still own write access.

### Edge function
`check-cert-expirations` (scheduled daily via cron in `supabase/config.toml`): scans `pilot_certifications` where `expires_at < now() AND recert_confirmed_at IS NULL`, marks `recert_required=true`, and sends an in-app/email reminder to the pilot and any org managers.

### UI
- `/orgs` (`src/pages/Organizations.tsx`): create org, list orgs you own/belong to.
- `/orgs/:id` (`src/pages/OrgDetail.tsx`): org profile, member roster table with each pilot's cert status (green/amber/red badge by days until expiry). Buttons: invite member by email, remove member, view pilot profile.
- Pilot dashboard: when any of the signed-in pilot's certs are past `expires_at` and `recert_confirmed_at` is null, show a blocking banner ("Confirm you have recertified [Cert] — issued/expires dates"). Form lets them update `issued_at` + `expires_at` + upload optional document; on submit, sets `recert_confirmed_at = now()` and clears `recert_required`. Until confirmed, the pilot is automatically toggled out of the marketplace match results (modify `find_matching_pilots` to exclude pilots with any `recert_required=true` cert).
- Add "For businesses" CTA in `Navbar` and a section on `Index.tsx`.
- Account-type chooser at signup (already have `account_type` enum on profiles): allow `pilot`, `client`, `both`, plus add `'organization'`.

---

## 3. Liability disclaimer

- Update `src/pages/TermsOfService.tsx` with new sections:
  - **Pilot certification responsibility** — pilots/orgs are solely responsible for maintaining current certifications, insurance, registrations, and complying with FAA/local regulations.
  - **No liability** — Dronie, its operators, employees, and affiliates accept no responsibility for damages, losses, injuries, regulatory violations, contract disputes, payment disputes, deliverable quality, or any other claims between clients and pilots/orgs. The platform is provided "as is" and acts only as an introduction/listing service.
  - **Indemnification** — users indemnify Dronie against all third-party claims arising from their use of the platform.
- New reusable component `src/components/LiabilityNotice.tsx` — short inline notice rendered:
  - On `PilotSignup.tsx` (above the submit button, with checkbox "I understand I am solely responsible for my certifications and compliance").
  - On `MarketplaceNew.tsx` (client posting a job — acknowledge platform is not responsible for pilot conduct).
  - On `MarketplaceDetail.tsx` (when accepting a quote).
  - In the footer as a permanent small-text link to Terms.

---

## Files

**New**
- `src/pages/PilotsMap.tsx`
- `src/pages/Organizations.tsx`, `src/pages/OrgDetail.tsx`, `src/pages/AcceptOrgInvite.tsx`
- `src/components/LiabilityNotice.tsx`
- `src/lib/orgs.ts`, `src/lib/jitter.ts`
- `supabase/functions/check-cert-expirations/index.ts`
- One migration adding columns/tables/RPC/cron.

**Edited**
- `src/lib/pilots.ts` — schema fields, jitter on save, public RPC fetch.
- `src/pages/PilotSignup.tsx` — privacy card + liability checkbox.
- `src/pages/Compliance.tsx` — recert confirmation flow + banner.
- `src/pages/Dashboard.tsx` — recert banner for pilots, "Manage organization" tile.
- `src/pages/MarketplaceNew.tsx`, `src/pages/MarketplaceDetail.tsx` — liability notice.
- `src/pages/TermsOfService.tsx` — disclaimer sections.
- `src/components/Navbar.tsx` — add `/pilots` and `/orgs` links.
- `src/App.tsx` — register new routes.
- `supabase/config.toml` — schedule cron for cert-check function.

---

## Open assumptions (will follow unless you say otherwise)

- Jitter distance: random 6–10 km (~4–6 mi). Reseeded every time the pilot edits their service location, otherwise stable.
- Org managers can **read** their pilots' certs but cannot edit them — pilot must confirm their own recerts.
- Cert reminders: in-app banner + Resend email (already configured? if not, in-app only for v1).
- Disclaimer is informational; the "agree" checkbox is gated only on first pilot/client/org signup, not on every action.

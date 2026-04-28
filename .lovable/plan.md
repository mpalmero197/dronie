
# Dronie Platform Evolution — Phased Plan

The spec describes a complete drone ecosystem (marketplace + SaaS + AI + API + verticals). Much of it already exists in Dronie today: photogrammetry pipeline, fleet/swarm ops, AI Insights, Compliance/LAANC, Gaussian Splatting, public portfolios, and Stripe-tiered subscriptions. This plan focuses on the **gaps** — and ships them in three phases so each release is testable.

I recommend approving **Phase 1 only** for now. Phases 2–3 can be revisited after Phase 1 ships.

---

## What already exists (no rebuild needed)

- Photogrammetry: orthomosaic, DSM, point cloud, contours (`process-project` edge fn, Workflow page)
- 3D + Gaussian Splatting viewer (`/splats`)
- Fleet & swarm ops, live telemetry, camera feeds
- AI Insights (`/insights`), Compliance (`/compliance`)
- Portfolio system (`/u/:username`, `/portfolio`)
- Auth + RBAC (admin / pilot / viewer), Stripe tiers (Pilot / Pro / Enterprise)
- Project lifecycle (queued → processing → complete) with progress

The spec's "missing" features that are actually already there: photogrammetry outputs, Gaussian splatting, AI processing layer, fleet, compliance, portfolio.

---

## Phase 1 — Marketplace, verticals, public surface (this approval)

The biggest real gap is that Dronie has **no service marketplace** and **no industry-specific positioning**. Phase 1 fixes both.

### 1a. Service marketplace (request → match → deliver)

New tables:
- `service_requests` — client posts a job: location, vertical, deliverables wanted, budget, deadline, status (`open` / `quoted` / `assigned` / `in_progress` / `delivered` / `closed`)
- `service_quotes` — pilots bid on requests: price, eta, message, status
- `client_profiles` — extends `profiles` with `account_type` (`pilot` | `client` | `both`) so existing users can also post jobs

New pages:
- `/marketplace` — public board of open requests (filter by vertical, location radius, deliverable type)
- `/marketplace/new` — client posts a request (auth required)
- `/marketplace/:id` — request detail + quote thread; pilot can submit quote; client can accept; on accept, auto-creates a linked `projects` row tied to both pilot and client
- `/marketplace/inbox` — split view: "My requests" (as client) and "My quotes" (as pilot)

Reuses existing `projects` + processing pipeline once a quote is accepted, so deliverables flow into the same SaaS dashboards.

### 1b. Industry vertical landing pages

New routes (public, SEO-targeted, share marketing layout):
- `/solutions/construction` — progress tracking, volumetrics, BIM-ready exports
- `/solutions/real-estate` — aerial photo/video, 3D walkthroughs, portfolio CTAs
- `/solutions/agriculture` — NDVI/multispectral, crop stress, field boundaries
- `/solutions/energy` — tower/solar/wind inspection, defect heatmaps
- `/solutions/mining` — stockpile volumetrics, haul-road monitoring
- `/solutions/insurance` — roof inspection, damage assessment, claims reports
- `/solutions/government` — public safety, SAR, emergency mapping

Each page = hero + vertical-specific value props + sample deliverable preview + "Request a pilot" CTA → `/marketplace/new?vertical=…`. One shared `<VerticalLanding>` component driven by config so all 7 ship together.

### 1c. Client deliverables dashboard

Currently the dashboard is pilot-centric. Add a **Client view** when `account_type === 'client'`:
- "My projects" — projects delivered to them via marketplace
- One-click access to map viewer, 3D scene, downloadable report PDF, share links
- Comment / approval thread per deliverable

### 1d. Navbar + homepage updates

- Top nav: add "Solutions" dropdown (verticals) and "Marketplace" link
- Homepage: add a "Built for your industry" section with the 7 vertical cards
- Hero adds a secondary CTA: "Hire a pilot" → `/marketplace`

---

## Phase 2 — Enterprise, API, digital twin (future approval)

- **Public REST API + API keys** (`api_keys` table, scoped to user, edge fn `api-v1` with rate limiting). Endpoints: list projects, fetch deliverable URLs, trigger processing, fetch AI insights.
- **Webhooks** — `webhooks` table, fire on job status changes (queued/complete/failed).
- **Digital twin / time series** — `project_versions` table so a site can have repeated captures over time; viewer adds a date slider to compare orthos and 3D scenes across captures.
- **Enterprise org accounts** — `organizations` + `org_members` tables; shared projects, seat-based billing tier, SSO-ready (SAML stub).
- **SLA + audit log** — `audit_logs` table, surfaced in admin panel.

## Phase 3 — Advanced AI & content (future approval)

- AI defect detection on inspection photos (Lovable AI vision: classify cracks, corrosion, missing shingles, vegetation encroachment) — new `inspection_findings` table, visualized as pins on the map viewer.
- Crop analytics module (NDVI tile generation if multispectral imagery uploaded; zonal stats by field boundary).
- Auto-generated branded PDF reports per vertical (already partly done in AI Insights — extend with vertical templates).
- SEO content hub: `/blog` + `/case-studies` (markdown-driven, public).

---

## Technical details

### Database (Phase 1 migration)

```sql
create type account_type as enum ('pilot','client','both');
create type request_status as enum ('open','quoted','assigned','in_progress','delivered','closed');
create type quote_status as enum ('pending','accepted','rejected','withdrawn');
create type industry_vertical as enum (
  'construction','real_estate','agriculture','energy','mining','insurance','government','other'
);

alter table profiles add column account_type account_type not null default 'pilot';

create table service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  vertical industry_vertical not null default 'other',
  deliverables text[] not null default '{}',     -- ['ortho','3d','video',...]
  location_label text,
  latitude double precision,
  longitude double precision,
  budget_cents integer,
  deadline date,
  status request_status not null default 'open',
  assigned_pilot_id uuid references auth.users(id),
  project_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table service_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  pilot_id uuid not null references auth.users(id) on delete cascade,
  price_cents integer not null,
  eta_days integer,
  message text,
  status quote_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique(request_id, pilot_id)
);
```

RLS:
- `service_requests`: public SELECT when `status = 'open'`; client manages their own; assigned pilot can SELECT/UPDATE their assigned ones
- `service_quotes`: pilot manages their own quotes; request owner can SELECT all quotes on their requests; pilot can SELECT their own
- `profiles.account_type`: covered by existing self-update policy

### File structure (Phase 1)

```text
src/pages/
  Marketplace.tsx           # public board + filters
  MarketplaceNew.tsx        # client posts a request
  MarketplaceDetail.tsx     # request + quotes thread
  MarketplaceInbox.tsx      # my requests / my quotes
  solutions/
    VerticalLanding.tsx     # shared layout
    verticals.config.ts     # 7 vertical configs (copy, icons, sample images)
src/components/marketplace/
  RequestCard.tsx
  QuoteForm.tsx
  QuoteList.tsx
  VerticalFilter.tsx
src/lib/marketplace.ts      # types + supabase helpers
```

Routes added in `App.tsx`:
- `/marketplace`, `/marketplace/new`, `/marketplace/:id`, `/marketplace/inbox`
- `/solutions/:vertical` (single dynamic route, looked up in `verticals.config.ts`)

Navbar updated with Solutions dropdown + Marketplace link. Homepage gets a `VerticalsSection` component.

### What I'm NOT changing in Phase 1

- No changes to existing photogrammetry pipeline, fleet, AI insights, splats, portfolio
- Stripe tiers stay as-is (marketplace is free to use for now; revenue comes from existing subscriptions + a future commission in Phase 2)
- No new external API keys required — everything uses Lovable Cloud + existing Stripe

---

## Deliverables of Phase 1

1. Marketplace (4 pages + tables + RLS)
2. 7 industry vertical landing pages
3. Client-mode dashboard view
4. Updated navbar + homepage with verticals section
5. Migration with new enums, tables, RLS policies

After approval I'll ship Phase 1 in one pass. Phases 2 and 3 will be re-planned when you're ready.

## Goal
Restyle and reorganize both dashboards (`/dashboard` client, `/pilot/dashboard`) inside a consistent Illustrator-style app shell — same chrome as the map viewer — so navigation feels grounded and content has a clear hierarchy.

## App shell (shared)
Create `src/components/shell/AppShell.tsx` and `AppSidebar.tsx` using shadcn `Sidebar` (`collapsible="icon"`).

- **Left rail** (collapsible, icons + labels): Overview, Projects, Missions, Map, Fleet, Splats, Video Editor, Marketplace, Portfolio, Community, Settings. Pilot-only extras (Active Jobs, Payouts, Verification) appear when the user has a pilot profile.
- **Header bar**: `SidebarTrigger`, breadcrumb, global search (opens existing `CommandPalette`), `NotificationBell`, subscription pill, avatar menu.
- **Main region**: page workspace with consistent max-width, gutters, and section rhythm.
- **Right insight rail** (optional, per page): contextual cards (verification status, tips, activity).
- Sidebar remembers active route via `NavLink`; mini-collapse keeps icons visible.
- Wired at the route level so `Dashboard` and `PilotDashboard` render inside `<AppShell>`. Non-dashboard pages remain untouched this pass.

## `/dashboard` (client) reorganization
Rewrite `src/pages/Dashboard.tsx` inside the shell:

1. **Hero strip** — compact greeting, plan badge, primary CTAs (New Project, Plan Mission, Open Map). Replaces the current gradient block; less vertical weight.
2. **Metric row** — 4 KPI tiles (Active projects, Processing, Completed, Storage used) with sparkline placeholder area and hover affordance.
3. **Workspace grid (2 columns on lg)**:
   - Left (2/3): **Recent projects** table with status pills, thumbnail, last-updated, quick-open — replaces the current card list; empty state promotes "Start a project".
   - Right (1/3): **Activity feed** (recent renders, deliverables, mission events) + **Quick actions** stack.
4. **Modules bento** — Swarm, Splats, RTK, Video Editor, Portfolio, Fleet as a 3×2 tile grid with icon, one-line value prop, and CTA. Groups advanced features and removes them from the main flow.
5. **Footer strip** — subscription usage bar + link to `/subscription`.

Remove the ad-hoc emoji/heading mix; standardize section headers (small caps label + h2).

## `/pilot/dashboard` reorganization
Rewrite `src/pages/PilotDashboard.tsx` inside the shell:

1. **Hero strip** — pilot name, verification pill, service area, availability toggle promoted here (was buried in right column).
2. **Metric row** — Active jobs, Quotes pending, Quotes won, Completed (keep existing counts, restyled to match client dashboard).
3. **Workspace grid**:
   - Left (2/3): existing `Tabs` (Active / My quotes / Completed) restyled with consistent row cards, better empty states, deadline highlighting.
   - Right (1/3): **Profile snapshot** (rate, experience, Part 107, insured, verticals, equipment) + **Availability & map visibility** toggles + **Verification CTA** (`Part107Prompt` + `PilotVerificationBanner`) consolidated.
4. **Suggested work** — small "Open marketplace requests near you" strip beneath the tabs (uses existing marketplace list; capped at 3, links to `/marketplace`).

## Visual/style rules
- Reuse existing tokens (forest green primary, amber highlight, sky accent, `bg-card`, `border-border`, `bg-secondary`). No new color literals.
- Space Grotesk display for hero + section headers, Inter body. Consistent `rounded-2xl` cards, `border-border`, subtle `shadow-sm`; hover states use `border-primary/30`.
- Lucide icons throughout. No emoji.
- Motion: light `framer-motion` fade/slide on hero + metric row only.
- Responsive: sidebar auto-collapses under `lg`; grids collapse to single column on `md`.

## Files
**New**
- `src/components/shell/AppShell.tsx`
- `src/components/shell/AppSidebar.tsx`
- `src/components/shell/DashboardHeader.tsx`
- `src/components/dashboard/MetricTile.tsx`
- `src/components/dashboard/ActivityFeed.tsx`
- `src/components/dashboard/ModuleTile.tsx`

**Edited**
- `src/pages/Dashboard.tsx` — full rewrite around shell + new sections
- `src/pages/PilotDashboard.tsx` — full rewrite around shell + reorganized right rail
- `src/App.tsx` — wrap the two dashboard routes in `<AppShell>` (other routes untouched)

**Not touched**: map viewer, marketplace, project detail, portfolio, and all other pages. Business logic, data fetching, Supabase calls, subscription gating, and Realtime channels are preserved verbatim — this is a UI restructure only.

## Verification
- Typecheck + build must pass.
- Run Playwright against `http://localhost:8080/dashboard` and `/pilot/dashboard`, screenshot each at 1280×1800 and at mobile 448×830 to confirm layout, collapsed sidebar, and no overlapping chrome.

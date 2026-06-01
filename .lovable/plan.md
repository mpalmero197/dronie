
## Current feature inventory

Grouped by route. This is what exists today and what each phase below will sharpen.

**Marketing & onboarding** — `/` (Index), `/solutions/:vertical` (7 verticals), `/pilots/join`, `/auth`, `/demo`, `/install`.
**Mission planning** — `/map`, `/plan` (PlanWizard), `/missions` (saved plans), `/workflow`, `/swarm` (multi-drone), `/reality`, `/rtk`.
**In-field execution** — `/jobs`, `/jobs/:id/fly` (PilotCompanion), `/fleet` (live telemetry, command queue, drone catalog, maintenance), `/pilots/verify`.
**Processing & deliverables** — `/project/:id` (WebODM pipeline, GCPs, accuracy report, image QA, AI report), `/viewer/:id`, `/splats` (Gaussian Splatting + share/embed), `/insights`.
**Portfolio & reputation** — `/portfolio` (Studio + Hero Reel), `/portfolio/edit/:item` (Video Editor w/ ffmpeg.wasm + captions), `/u/:username` (public, scrollytelling).
**Marketplace** — `/marketplace` (requests/quotes/messages/inbox/receipts), `/pilots` (map), `/pilots/:id` (profile), `/pilot/payouts` (Stripe Connect).
**Org & billing** — `/orgs`, `/orgs/:id`, invites; `/subscription` (Stripe tiers), `/compliance`.
**Admin** — `/admin` (users, verification reviews, API keys vault, secrets).

```text
Competitive yardstick per area
  Planning .......... DJI Pilot 2, Litchi, DroneDeploy, Pix4Dcapture, UgCS
  Fleet/telemetry ... Skydio Cloud, Auterion Suite, FlytBase
  Processing ........ DroneDeploy, Pix4D, WebODM, RealityCapture
  Portfolio ......... SmugMug + Squarespace + Behance
  Marketplace ....... Thumbtack + Upwork (vertical drone version)
  Compliance ........ Aloft, Airdata, Kittyhawk
```

---

## Phase 1 — Foundations & UX consistency (2 wks)

Stops every later phase from being papered over a broken base.

- **Global shell**: shared `AppShell` with persistent sidebar (Planning / Fleet / Projects / Portfolio / Marketplace / Org), command palette (⌘K — jump to project, drone, pilot, action), notification center bound to a new `notifications` table, breadcrumbs, and a global empty-state pattern.
- **Design tokens audit**: enforce semantic tokens; remove ad-hoc colors found in `PortfolioPolish`, fleet, and marketplace components; lock the aviation palette (forest green / amber / sky blue) per project memory.
- **Auth UX**: passwordless magic link + Google OAuth in addition to email/password; "continue as guest demo" path on `/auth`.
- **Mobile parity sweep**: PilotCompanion, MapViewer, and FleetManagement get full mobile layouts (current implementations assume desktop).
- **Observability**: wire `analytics_events` consistently (page_view, key actions); add a thin `useTrack()` hook.
- **Performance baseline**: route-level code-splitting, lazy Leaflet/ffmpeg/HeroReel video, image `loading="lazy"` + `decoding="async"` everywhere.

---

## Phase 2 — Mission planning & in-field execution (3 wks)

Goal: match DroneDeploy + DJI Pilot, then add what they don't have.

- **PlanWizard v2**: terrain-following toggle backed by elevation tiles, obstacle clearance buffer, smart battery splitting (auto-RTH + resume per battery), live area/flight-time/photo-count estimates as overlays on the map, oblique + nadir + crosshatch + perimeter + facade + tower-orbit presets.
- **MapViewer v2**: airspace overlay (LAANC) becomes interactive — click a grid cell to file an authorization request; weather widget gets 6-hour forecast w/ wind aloft and visibility; KMZ/SHP/GeoJSON import; measurement tool (distance / area / bearing); offline tile caching for field use.
- **PilotCompanion**: pre-flight checklist enforced (battery, props, SD, compass, GPS lock, NOTAMs); in-flight HUD with live link quality, RTH point pin, geofence ring; one-tap "log incident" with photo.
- **Swarm**: visual choreographer (drag drones onto subareas), conflict detection (airspace overlap), staggered launch timing, leader/follower roles.
- **Saved Missions**: versioning + diff, share to org, duplicate-and-modify, scheduled flights with weather gating.

---

## Phase 3 — Fleet & telemetry (2 wks)

Goal: Skydio Cloud / Auterion-grade ops center.

- **DroneControlConsole** (referenced in earlier work, not yet built): arm/disarm, takeoff/land/RTH/emergency, gimbal pitch+yaw sliders, zoom, payload switcher, mission upload/start/pause/resume/abort, geofence editor, max-altitude clamp, spotlight/speaker/parachute (capability-gated), live command-history feed via the existing `drone_commands` table.
- **Live map of fleet** with status pins, battery rings, link-quality halos, click-through to console.
- **Maintenance**: cycles_left countdown, predictive flags (battery cycles, motor hours), one-click work order assignment.
- **Black box**: persist telemetry to `mission_logs` at 1 Hz during a job; post-flight playback timeline with synced video.
- **Multi-pilot handoff**: transfer control mid-flight with confirm-from-receiving-pilot.

---

## Phase 4 — Processing pipeline & deliverables (2 wks)

Goal: DroneDeploy parity for outputs, RealityCapture-grade splats.

- **Image QA upfront**: blur, exposure, overlap heatmap before queue; recommend re-shoots tied to specific GPS points.
- **Processing presets v2**: Fast Draft / Standard / Survey-grade / Mapping+Mesh / Splat-only; per-preset settings preview.
- **Deliverable bundles**: orthomosaic (GeoTIFF + COG), DSM/DTM, point cloud (LAS/LAZ), 3D mesh (OBJ/GLB), contour lines (DXF), annotated PDF report.
- **Annotations & measurements** on the viewer: pin notes, distance/area/volume, stockpile volumetrics, before/after slider across project versions.
- **Sharing**: per-deliverable share links with view/comment/download permissions and expiry; embed iframe.
- **Splats**: training queue UI w/ ETA, cost estimate, share-token expiry editor, embed viewer color/quality controls.

---

## Phase 5 — Portfolio & video editor (2 wks)

Goal: Behance + SmugMug for drone work.

- **Public portfolio**: keep cinematic scrollytelling; add per-album themes, password-protected unlisted albums, watermark toggle, EXIF/GPS strip on public images, OG/Twitter card generation per item.
- **Video Editor**: add cuts/trim/split timeline, music library w/ ducking, color LUTs, end-card templates, render presets (Reels 9:16, YouTube 16:9, Square 1:1), background-render queue with email-when-done.
- **AI captions**: existing transcription → add auto-translate, position/style presets, profanity filter.
- **SEO**: per-portfolio JSON-LD `Person`+`CreativeWork`, sitemap entry on publish, OG image auto-render.
- **Analytics for pilots**: portfolio views, inquiry conversion, top items, referrers.

---

## Phase 6 — Marketplace & monetization (3 wks)

Goal: Thumbtack-style match quality + Upwork-style trust.

- **Request flow**: structured form (vertical, deliverables, schedule, budget, location radius); attach existing project; client sees matched pilots ranked by distance, verticals, rating, response time.
- **Quotes**: line-item quotes, milestones, escrow via Stripe Connect (already wired) with milestone release.
- **Messaging**: rich text + attachments + read receipts (`request_message_reads` exists), typing indicators via Realtime, mobile push.
- **Reviews & reputation**: dual-sided reviews, verified-job badges, response-time SLA badge.
- **Pricing intelligence**: show market-rate range per vertical/region pulled from past quotes.
- **Discovery**: `/pilots` map gets filters (verticals, equipment, insurance, hourly), saved searches, "available this week" pill.
- **Subscriptions v2**: Free / Pro / Enterprise tiers with concrete gated features (Splats, Swarm, multi-drone fleet, white-label portfolio, org seats).

---

## Phase 7 — Compliance, org, admin, AI (2 wks)

- **Compliance**: certification expiry reminders (cron edge fn → email + in-app), per-region rule pack (FAA, EASA, CAA, Transport Canada), one-click LAANC + flight-log export for audits.
- **Organizations**: seats & roles (owner / manager / pilot / viewer), shared fleet + projects, billing roll-up, SSO (SAML) for Enterprise.
- **Admin**: API key vault (done) + usage dashboard per key, audit log, user impersonation for support, feature-flag toggles.
- **AI**: project insights expanded — anomaly detection on imagery, automatic site report generation (markdown + PDF), natural-language query over a project ("show me all roof damage > 1m²") using Lovable AI (`google/gemini-2.5-pro` for vision).

---

## Phase 8 — Polish, growth, retention (1 wk)

- Onboarding tour using existing Demo overlay extended to each feature area.
- Empty states with CTAs that route to the demo data.
- Templated email drips (welcome, first-flight tips, abandoned-project nudge, marketplace digest).
- Public changelog page + in-app "What's new" badge.
- Lighthouse 95+ on all marketing routes; CWV monitoring.

---

## Cross-cutting technical notes

- **Realtime**: enable `supabase_realtime` for `drones`, `drone_commands`, `request_messages`, `notifications`.
- **New tables**: `notifications`, `reviews`, `quote_milestones`, `mission_incidents`, `org_audit_log`, `feature_flags`. All with GRANTs + RLS following project conventions (roles in `user_roles`, never on profile).
- **Edge functions to add**: `laanc-submit`, `weather-forecast`, `cert-reminder-cron`, `pilot-match-rank`, `project-insights-vision`, `og-image-render`.
- **Tests**: add Playwright smoke per phase (auth, plan, fly, process, publish portfolio, post & quote a request).
- **No DB migrations or code edits happen until you approve each phase**; I'll surface a focused migration set at the start of each.

---

## What I recommend deciding now

1. Approve the phase order (or reshuffle — e.g. portfolio before fleet).
2. Confirm scope: do you want **all 8 phases** queued, or should we ship **Phase 1+2** first and re-plan after?
3. Flag any "must-have right now" features that should jump into Phase 1.

# Automated Data Service Provider (ADSP) Suite — 14 CFR Part 146

Dronie gains a full ADSP capability: operators can subscribe to and consume automated data services for their missions, and Dronie itself gets the provider-side toolkit (service catalog, performance monitoring, quality management, personnel records, incident reporting, audit trail) that Part 146 accreditation requires.

Data comes from Dronie's own internal engine (deconfliction against other Dronie missions, conformance from existing telemetry) plus free public feeds — FAA UAS data, NOAA/aviation weather, USGS terrain.

## What gets built

### 1. ADSP hub at `/adsp`
A new sidebar entry with four tabs:

- **Services** — catalog of the Part 146 service types Dronie offers or brokers: strategic deconfliction, conformance monitoring, terrain & obstacle data, aeronautical data, weather, and flight-planning support. Each shows status, source (internal vs external feed), coverage area, and current performance.
- **Subscriptions** — operators enable the services they want for their account or per aircraft, with acceptance of each service's declared limitations.
- **Performance** — live service-level dashboard: availability, latency, data currency, and error rate per service, with a rolling 30-day chart.
- **Compliance** — provider-side accreditation record: quality management documents, personnel training/competency records, safety incidents, and the immutable audit log.

### 2. Operator-side services

- **Strategic deconfliction**: before a flight is scheduled, the mission volume (polygon + altitude band + time window) is checked against every other active Dronie operation. Conflicts return the overlapping volume, time overlap, and suggested resolutions (shift window, lower ceiling, shrink area). Wired into the mission scheduler and the pre-flight checklist.
- **Conformance monitoring**: while a job is live, telemetry already flowing into Dronie is compared against the planned volume. Deviations (lateral, vertical, time overrun, geofence breach) raise an alert, notify the pilot, and write a conformance record.
- **Terrain & obstacle data**: elevation and obstacle lookups for the operating area from USGS and FAA obstacle data, surfaced in the flight planner as a minimum-safe-altitude advisory.
- **Aeronautical + weather data**: airspace class, TFRs, NOTAMs and current/forecast conditions for the operating area, with a go/no-go summary against configurable limits.
- **Flight intent sharing**: an operator can publish a mission's intent so other Dronie operators' deconfliction checks see it, with opt-out per mission.

Every service call writes a timestamped record (inputs, outputs, source, data currency) so an operator can produce evidence for any flight.

### 3. Provider-side Part 146 toolkit (admin)

- **Service declarations**: for each service — description, performance criteria, known limitations, data sources, update frequency. Versioned; changes are logged.
- **Quality management system**: policy documents, procedures, review dates, and responsible personnel, with expiry warnings.
- **Personnel records**: named roles (accountable manager, safety lead, service engineers), training completed, competency dates.
- **Incident & malfunction reporting**: log service outages, erroneous data, and degradations, with severity, affected users, root cause, and corrective action — plus a notification obligation checklist.
- **Audit trail**: append-only record of service outputs, configuration changes, and compliance actions; exportable as PDF/CSV for an accreditation review.

### 4. Reference content

A `/guides/part-146-adsp` long-form guide explaining what an ADSP is, which services Part 146 covers, obligations for providers and users, and how Dronie's tooling maps to them — with the same SEO/JSON-LD treatment as the existing guides, and added to the sitemap and llms.txt.

## Technical details

**Database (new tables, all with RLS + grants):**
- `adsp_services` — service type, name, description, source, performance criteria, limitations, status, version. Public read; admin write.
- `adsp_subscriptions` — user/org subscription per service, accepted-limitations timestamp.
- `adsp_service_records` — every service invocation: service, user, mission/job ref, request payload, response, data source + currency, latency. Owner read, service-role write.
- `flight_intents` — published mission volumes: polygon, min/max altitude AGL, start/end time, status, shared flag.
- `deconfliction_checks` — check result, conflicts array, resolution suggestions.
- `conformance_events` — job ref, deviation type, magnitude, position, resolved flag.
- `adsp_incidents` — severity, affected service, description, root cause, corrective action, reported/closed timestamps.
- `adsp_qms_documents` and `adsp_personnel` — provider records, admin-only.
- `adsp_performance_samples` — per-service availability/latency/error samples for the dashboard.

**Edge functions:**
- `adsp-deconflict` — validates volume input with Zod, queries overlapping `flight_intents`, returns conflicts + suggestions, writes a service record. Paid-gated via existing `requirePaid`.
- `adsp-conformance` — evaluates a telemetry sample against its flight intent; writes `conformance_events` and fires a notification on breach.
- `adsp-aero-data` — proxies FAA/NOAA/USGS feeds with caching, normalizes airspace, TFR, weather, terrain into one response.
- `adsp-health` — scheduled probe of each service, writing `adsp_performance_samples`.

**Frontend:**
- `src/pages/AdspHub.tsx` plus components under `src/components/adsp/` (ServiceCatalog, SubscriptionPanel, DeconflictionPanel, ConformanceMonitor, PerformanceDashboard, IncidentLog, QmsPanel).
- `src/lib/adsp.ts` — types, service constants, Zod schemas, client helpers.
- Deconfliction check added to `PlanWizard`/`ScheduleMissionDialog`; conformance status added to `PilotCompanion` and the CRM pre-flight checklist.
- Admin tab in `AdminPanel` for QMS, personnel, incidents, and audit export.

**Delivery order:** schema → operator services (deconfliction, conformance, aero data) → ADSP hub UI → provider-side compliance toolkit → guide + SEO.

## Notes

Part 146 accreditation is a regulatory process with the FAA; this build produces the tooling and evidence trail, not the accreditation itself. Service outputs carry advisory-only disclaimers consistent with the existing liability notice.

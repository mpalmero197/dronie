## Goal

Replace the flat tag-list of drone models in two places (pilot profile and Fleet "Add Drone") with a structured **Manufacturer → Model** picker, support **multi-select with quantities**, and let users register **per-airframe serial numbers** in Fleet Management with strong duplicate-detection fail-safes.

## What changes for the user

### 1. Drone catalog (shared)

A single curated catalog of manufacturers and their full model lineups (DJI, Autel, Skydio, Parrot, Yuneec, Freefly, Wingtra, senseFly, plus an "Other / Custom" escape hatch). Each model knows its category (consumer, prosumer, enterprise, survey, FPV, fixed-wing) and class hints.

### 2. Pilot Signup → "Your fleet" section

Replaces the current pill grid:

```text
┌── Manufacturer ▾  ─┐  ┌── Models (checkboxes) ────────────────┐
│ DJI                │  │ ☑ Mavic 3 Pro          × 2            │
│ Autel              │  │ ☑ Mini 4 Pro           × 1            │
│ Skydio             │  │ ☐ Air 3S                              │
│ ...                │  │ ☐ Matrice 350 RTK                     │
│ Other / Custom     │  └───────────────────────────────────────┘
└────────────────────┘
   [+ Add custom model]      Selected: 3 drones across 2 models
```

- Click a manufacturer to expand its models (accordion-style; multiple manufacturers can be open).
- Each model has a checkbox; once checked, a small "× N" stepper appears so a pilot can say "I own 2 Mavic 3 Pros".
- A search box filters models across all manufacturers.
- "Add custom model" still supported under "Other / Custom" — preserves the existing free-text flow.
- Serial numbers are NOT collected here. Public-facing profile only states what models a pilot operates.

### 3. Fleet Management → "Add Drone" / "Edit Drone" dialogs

New flow inside the dialog:

```text
Step 1  ── Manufacturer  [DJI ▾]
Step 2  ── Model         [Mavic 3 Pro ▾]    (filtered by manufacturer)
Step 3  ── Friendly name [Mavic-Lead ]      (auto-suggested from model)
Step 4  ── Serial number [1ZNBJ1234567]
            ⓘ Duplicate-detection happens here (see below)
Step 5  ── Stream source (unchanged StreamSourcePicker)
```

When a user wants to add another physical drone of the same model, they
just open the dialog again. A **"Duplicate model" banner** appears in the
dialog the moment they pick a model that already exists in their fleet:

> "You already have 2 × DJI Mavic 3 Pro. Add another one with a different
>  serial number, or cancel."

### 4. Serial-number fail-safes

Triggered **as the user types** in the serial field, debounced 300 ms:

| Condition | Behavior |
|---|---|
| Empty | Allowed (some pilots don't track S/N), shows hint "Recommended for warranty + insurance" |
| Length < 4 or > 40 | Inline validation error |
| Non-alphanumeric (besides `- _`) | Inline validation error |
| Already exists on **another of your drones** (case-insensitive, trimmed) | Red banner: "Serial 1ZNBJ1234567 is already on '[Mavic-Lead]'." Submit button disabled. |
| Differs from another only by case/whitespace | Same red banner — "looks identical to '[Mavic-Lead]'" |
| Edit dialog matches its own current S/N | No warning |

A second pass server-side: **a UNIQUE partial index** on `(assigned_pilot_id, lower(trim(serial_number)))` where `serial_number <> ''`, so even a race between two browser tabs cannot create duplicates. The client surfaces the resulting Postgres error as a friendly toast.

### 5. Bonus fail-safes

- **Friendly-name uniqueness within a fleet** — soft warning, not blocking, since pilots may want "Mavic-1" / "Mavic-1 (backup)".
- **Confirm-on-delete** stays in EditDroneDialog; if the drone is currently `active` (mid-flight per telemetry), deletion is blocked with a toast: "Cannot remove a drone that is in the air. Land it first."

## Out of scope

- No public exposure of serial numbers — current RLS already restricts the `drones` table to `assigned_pilot_id = auth.uid()` (or admin); we keep that boundary.
- No bulk-import of drones (CSV) — can be a follow-up.
- No model-spec metadata (weight, sensor) on the public profile yet — catalog has the data structure ready for a later release.

## Technical section

### New files

```text
src/lib/drone-catalog.ts                        (NEW)
  export type DroneManufacturer =
    | "DJI" | "Autel" | "Skydio" | "Parrot" | "Yuneec"
    | "Freefly" | "Wingtra" | "senseFly" | "Other";
  export interface DroneModel {
    id: string;        // stable slug e.g. "dji-mavic-3-pro"
    label: string;     // display: "Mavic 3 Pro"
    fullLabel: string; // "DJI Mavic 3 Pro" — used for free-text fallback
    manufacturer: DroneManufacturer;
    category: "consumer" | "prosumer" | "enterprise" | "survey" | "fpv" | "fixed-wing" | "custom";
  }
  export const DRONE_MODELS: DroneModel[] = [...];   // ~60 models
  export const MANUFACTURERS: DroneManufacturer[] = [...];
  export function findModelByLabel(label: string): DroneModel | null;
  export function modelsByManufacturer(m: DroneManufacturer): DroneModel[];

src/components/pilot/FleetCatalogPicker.tsx     (NEW)
  Props: { value: { modelId: string; quantity: number; customLabel?: string }[];
           onChange(next): void;
           maxTotal?: number /* default 50 */ }
  - Accordion of manufacturers, each expandable
  - Search input filters models across manufacturers
  - Per-row checkbox + quantity stepper (1–20)
  - Renders selected count badge per manufacturer
  - "Add custom model" inline form under "Other / Custom"

src/components/fleet/SerialNumberField.tsx      (NEW)
  Props: { value, onChange, ownDroneId?: string }
  - Debounced query: select id, name, serial_number from drones
    (RLS already scopes to the user's drones)
  - Shows inline status: idle / checking / available / duplicate
  - Exposes isValid via parent form
```

### Changes to existing files

```text
src/lib/pilots.ts
  - Update EQUIPMENT_OPTIONS to be derived from DRONE_MODELS.fullLabel
    (so existing pilot_profiles.equipment string[] stays compatible).
  - Persist format unchanged: equipment is still string[] of fullLabels,
    with quantity encoded as suffix " ×N" only when N > 1
    (parseable, backwards compatible). Example:
      ["DJI Mavic 3 Pro ×2", "DJI Mini 4 Pro"]
  - Add helpers: serializeFleet(rows) / parseFleet(strings).
  - pilotProfileSchema.equipment max stays 20; bump max element length to 80.

src/pages/PilotSignup.tsx
  - Replace the "Your fleet" pill grid + CustomDronePicker with
    <FleetCatalogPicker value={parseFleet(equipment)} onChange={...} />
  - On submit, equipment = serializeFleet(rows).

src/components/fleet/AddDroneDialog.tsx
  - Replace plain Model <Input> with two <Select>s: Manufacturer → Model.
  - Auto-fill the friendly Name with model label on first selection
    (only if Name is empty so we don't overwrite user edits).
  - Replace plain Serial <Input> with <SerialNumberField/>.
  - Show "duplicate model" warning banner above the form when current
    selection matches an existing fleet entry (informational, non-blocking).
  - Disable submit while serial validation fails.

src/components/fleet/EditDroneDialog.tsx
  - Same Manufacturer/Model selects (initial values resolved by
    findModelByLabel(drone.model)).
  - Pass ownDroneId={drone.id} to SerialNumberField so editing without
    changing the S/N never trips the duplicate warning.
  - Block delete (handled in caller) when drone.status === "active".

src/integrations/supabase/types.ts
  - Auto-regenerated by the migration; we don't hand-edit.
```

### Database migration (one migration file)

```sql
-- Trim/lowercase comparison to catch case + whitespace duplicates,
-- but only when serial_number is non-empty.
CREATE UNIQUE INDEX IF NOT EXISTS drones_pilot_serial_unique
  ON public.drones (assigned_pilot_id, lower(btrim(serial_number)))
  WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '';
```

No RLS changes needed — existing policies (`Pilots view assigned drones`,
`Admins manage all drones`) continue to scope reads/writes correctly.

### Validation summary

- All client inputs validated with **zod** (length, character set).
- Serial-number lookup uses parameterized Supabase query (no string concat).
- No serial numbers are written to console logs or analytics.
- Server-side UNIQUE index is the final source of truth.

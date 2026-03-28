

# Include LAANC Check Results in PDF Mission Report

## What changes

Add LAANC airspace authorization data to the mission PDF report so pilots have a complete pre-flight document with airspace clearance status.

## Implementation

### 1. Export `LaancResult` interface and expose result via callback

**File: `src/components/map/LaancChecker.tsx`**
- Export the `LaancResult` interface so it can be used by other components
- Add an `onResult` callback prop to `LaancChecker` that fires whenever a new LAANC result is set, allowing parent components to capture the data

### 2. Wire LAANC result state through MapViewer to FlightPlanner

**File: `src/pages/MapViewer.tsx`**
- Add `laancResult` state using `useState`
- Pass `onResult` callback to `<LaancChecker>` to capture the result
- Pass `laancResult` as a new prop to `<FlightPlanner>`

### 3. Accept LAANC data in FlightPlanner and pass to PDF generator

**File: `src/components/map/FlightPlanner.tsx`**
- Add `laancResult` to `FlightPlannerProps`
- Pass it through to `generateMissionPDF()` in the `downloadPDF` callback

### 4. Add LAANC section to PDF report

**File: `src/lib/generateMissionPDF.ts`**
- Add `LaancData` interface to options (authorization status, max altitude, message, details, zone names, coordinates)
- Render a new **"Airspace Authorization (LAANC)"** section between Flight Statistics and Waypoint Table:
  - Color-coded status badge (green/amber/red) matching the UI
  - Max auto-approval altitude
  - Check location coordinates
  - Advisory message and detail bullet points
  - List of detected airspace zones (name + class)
  - Disclaimer text

## Technical Details

The LAANC data is optional — when no check has been performed, the section is simply omitted from the PDF. The color coding uses the same green (#16a34a) / amber (#d97706) / red (#dc2626) scheme as the map UI panel.


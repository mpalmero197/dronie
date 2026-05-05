/**
 * Mission-planning math used by every serious photogrammetry tool
 * (Pix4D Capture, DJI Pilot, UgCS, Drone Harmony, Map Pilot, DroneDeploy).
 *
 * All formulas are first-principles photogrammetry — no fudge factors.
 *
 *   GSD (cm/px) = (sensorWidth_mm × altitude_m × 100) / (focalLength_mm × imageWidth_px)
 *   Footprint width  = GSD × imageWidth  (m)
 *   Footprint height = GSD × imageHeight (m)
 *   Side spacing     = footprintWidth  × (1 - sideOverlap)
 *   Capture interval = footprintHeight × (1 - frontOverlap) / speed
 */
import type { SensorSpec } from "./sensor-specs";

export interface MissionInputs {
  spec: SensorSpec;
  altitudeM: number;
  frontOverlapPct: number; // 0–95
  sideOverlapPct: number;  // 0–95
  speedMs: number;
  /** Total area to cover (hectares) — used for time/image count. */
  areaHa?: number;
  /** Has RTK or PPK base station capturing the survey? */
  rtkEnabled?: boolean;
  /** Number of well-distributed ground control points (0 if RTK only). */
  gcpCount?: number;
}

export interface MissionPlan {
  gsdCmPx: number;
  footprintWidthM: number;
  footprintHeightM: number;
  lineSpacingM: number;
  captureIntervalS: number;
  /** Estimated horizontal accuracy at 1σ, in cm. */
  predictedHorizontalCm: number;
  /** Estimated vertical accuracy at 1σ, in cm. */
  predictedVerticalCm: number;
  /** Recommended minimum altitude before rolling-shutter blur dominates. */
  minSafeAltitudeM: number;
  /** Estimated images needed to cover areaHa (null if no area given). */
  estimatedImageCount: number | null;
  /** Estimated flight duration in minutes (null if no area). */
  estimatedFlightMinutes: number | null;
  warnings: string[];
}

export function computeMission(input: MissionInputs): MissionPlan {
  const {
    spec, altitudeM, frontOverlapPct, sideOverlapPct, speedMs,
    areaHa, rtkEnabled = false, gcpCount = 0,
  } = input;

  const front = clamp(frontOverlapPct, 0, 95) / 100;
  const side  = clamp(sideOverlapPct,  0, 95) / 100;

  const gsdCmPx =
    (spec.sensorWidthMm * altitudeM * 100) /
    (spec.focalLengthMm * spec.imageWidthPx);

  const gsdM = gsdCmPx / 100;
  const footprintWidthM  = gsdM * spec.imageWidthPx;
  const footprintHeightM = gsdM * spec.imageHeightPx;

  const lineSpacingM = footprintWidthM * (1 - side);
  const distancePerImageM = footprintHeightM * (1 - front);
  const captureIntervalS = distancePerImageM / Math.max(0.5, speedMs);

  // Rolling-shutter blur: motion blur per frame should stay below ½ pixel.
  // For rolling shutters we approximate read time at ~1/30 s.
  const readTimeS = spec.hasMechanicalShutter ? 1 / 1000 : 1 / 30;
  const blurPx = (speedMs * readTimeS) / gsdM;
  const minSafeAltitudeM = spec.hasMechanicalShutter
    ? 5
    : Math.ceil((speedMs * readTimeS * spec.focalLengthMm * spec.imageWidthPx) /
                (spec.sensorWidthMm * 0.5)); // altitude where blur ≤ 0.5 px

  // Predicted accuracy — empirical rule of thumb tuned to ODM/Metashape:
  //   horizontal ≈ 1.5 × GSD (consumer GPS)
  //   horizontal ≈ 0.8 × GSD (RTK + 5 GCPs)
  //   vertical   ≈ 3 × horizontal
  let horiz = gsdCmPx * 1.5;
  if (rtkEnabled) horiz *= 0.55;
  if (gcpCount >= 5) horiz *= 0.7;
  if (gcpCount >= 9) horiz *= 0.85;
  const vert = horiz * (rtkEnabled ? 2.2 : 3.0);

  let estimatedImageCount: number | null = null;
  let estimatedFlightMinutes: number | null = null;
  if (areaHa && areaHa > 0) {
    const areaM2 = areaHa * 10_000;
    const imageAreaM2 = footprintWidthM * footprintHeightM;
    // effective image area accounting for overlaps
    const effectivePerImage = imageAreaM2 * (1 - front) * (1 - side);
    estimatedImageCount = Math.max(1, Math.ceil(areaM2 / Math.max(1, effectivePerImage)));

    const totalPathM = (areaM2 / lineSpacingM) * 1.05; // +5% for turns
    estimatedFlightMinutes = Math.ceil(totalPathM / Math.max(1, speedMs) / 60);
  }

  const warnings: string[] = [];
  if (front < 0.7) warnings.push(`Front overlap ${Math.round(front * 100)}% is low — aim for 75–85% for a clean orthomosaic.`);
  if (side  < 0.6) warnings.push(`Side overlap ${Math.round(side * 100)}% is low — aim for 65–75%.`);
  if (!spec.hasMechanicalShutter && speedMs > spec.maxSpeedMs) {
    warnings.push(`Speed ${speedMs.toFixed(1)} m/s exceeds safe ${spec.maxSpeedMs} m/s for this rolling-shutter camera (≈ ${blurPx.toFixed(1)} px blur).`);
  }
  if (altitudeM < minSafeAltitudeM) {
    warnings.push(`Altitude ${altitudeM} m is below the minimum (${minSafeAltitudeM} m) for sub-pixel motion blur at ${speedMs} m/s.`);
  }
  if (altitudeM > 120) warnings.push(`Altitude ${altitudeM} m exceeds the FAA Part 107 ceiling (120 m / 400 ft AGL).`);
  if (!rtkEnabled && gcpCount < 5 && gsdCmPx < 3) {
    warnings.push("Sub-3 cm GSD without RTK or 5+ GCPs will not actually deliver sub-3 cm accuracy.");
  }

  return {
    gsdCmPx,
    footprintWidthM,
    footprintHeightM,
    lineSpacingM,
    captureIntervalS,
    predictedHorizontalCm: horiz,
    predictedVerticalCm: vert,
    minSafeAltitudeM,
    estimatedImageCount,
    estimatedFlightMinutes,
    warnings,
  };
}

/** Solve: what altitude do I need for a given target GSD (cm/px)? */
export function altitudeForTargetGsd(spec: SensorSpec, targetGsdCmPx: number): number {
  return Math.round(
    (targetGsdCmPx * spec.focalLengthMm * spec.imageWidthPx) /
    (spec.sensorWidthMm * 100)
  );
}

/* ────── GCP advisor ────── */

export interface GcpAdvice {
  recommendedCount: number;
  recommendedCheckpoints: number;
  splitWell: boolean;
  edgeCoveragePct: number;
  centerHasPoint: boolean;
  zCoverage: "good" | "poor" | "none";
  notes: string[];
}

export interface GcpPoint {
  latitude: number;
  longitude: number;
  elevation: number | null;
}

/**
 * Real surveyor practice:
 *   - Minimum 5 horizontal GCPs (4 corners + 1 centre).
 *   - 1 GCP per 5 ha for areas > 10 ha.
 *   - At least 30 % of GCPs reserved as checkpoints (validation only).
 *   - GCPs should span the full project bounding box, not cluster.
 *   - Z (elevation) on every GCP — without it vertical RMSE is meaningless.
 */
export function adviseGcps(opts: {
  gcps: GcpPoint[];
  areaHa: number | null;
  rtkEnabled: boolean;
}): GcpAdvice {
  const { gcps, areaHa, rtkEnabled } = opts;

  const baseRecommended = rtkEnabled ? 3 : 5;
  const recommendedCount = areaHa
    ? Math.max(baseRecommended, Math.ceil(areaHa / 5))
    : baseRecommended;
  const recommendedCheckpoints = Math.max(1, Math.round(recommendedCount * 0.3));

  let edgeCoveragePct = 0;
  let centerHasPoint = false;
  let splitWell = false;
  let zCoverage: GcpAdvice["zCoverage"] = "none";
  const notes: string[] = [];

  if (gcps.length === 0) {
    notes.push(
      rtkEnabled
        ? "RTK detected — at minimum, drop 3 checkpoints to validate accuracy claims."
        : "No GCPs uploaded. Without RTK, expect ±1–3 m vertical drift."
    );
  } else {
    const lats = gcps.map((g) => g.latitude);
    const lngs = gcps.map((g) => g.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;

    // Edge coverage: count how many of the 4 corners have a GCP within 20% of bbox edge.
    const edgeMargin = 0.2;
    const corners = [
      { lat: minLat, lng: minLng },
      { lat: minLat, lng: maxLng },
      { lat: maxLat, lng: minLng },
      { lat: maxLat, lng: maxLng },
    ];
    let cornerHits = 0;
    for (const c of corners) {
      if (
        gcps.some(
          (g) =>
            Math.abs(g.latitude - c.lat) <= latSpan * edgeMargin &&
            Math.abs(g.longitude - c.lng) <= lngSpan * edgeMargin
        )
      )
        cornerHits++;
    }
    edgeCoveragePct = Math.round((cornerHits / 4) * 100);

    const cLat = (minLat + maxLat) / 2;
    const cLng = (minLng + maxLng) / 2;
    centerHasPoint = gcps.some(
      (g) =>
        Math.abs(g.latitude - cLat) <= latSpan * 0.25 &&
        Math.abs(g.longitude - cLng) <= lngSpan * 0.25
    );

    splitWell = cornerHits >= 3 && centerHasPoint;

    const withZ = gcps.filter((g) => g.elevation != null).length;
    const zPct = withZ / gcps.length;
    zCoverage = zPct >= 0.9 ? "good" : zPct >= 0.5 ? "poor" : "none";

    if (gcps.length < recommendedCount) {
      notes.push(`Only ${gcps.length} GCPs — recommend ≥ ${recommendedCount} for this area.`);
    }
    if (!splitWell) {
      notes.push("GCP distribution is uneven — place points at the 4 corners and 1 centre.");
    }
    if (zCoverage !== "good") {
      notes.push("Some GCPs lack elevation. Vertical RMSE will be unreliable.");
    }
    if (gcps.length >= recommendedCount + recommendedCheckpoints) {
      notes.push(`Plenty of points — reserve ${recommendedCheckpoints} as checkpoints (validation only).`);
    }
  }

  return {
    recommendedCount,
    recommendedCheckpoints,
    splitWell,
    edgeCoveragePct,
    centerHasPoint,
    zCoverage,
    notes,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

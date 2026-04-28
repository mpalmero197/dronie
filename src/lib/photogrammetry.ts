/**
 * Shared photogrammetry helpers: presets, cost/time estimation, QA.
 * Pure functions — safe in any React or worker context.
 */

export type Quality = "low" | "medium" | "high" | "ultra";
export type MeshType = "3d" | "2.5d" | "none";

export interface ProcessingSettings {
  quality: Quality;
  meshType: MeshType;
  dsmEnabled: boolean;
  dtmEnabled: boolean;
  contoursEnabled: boolean;
  contourInterval: number;
  outputFormat: "geotiff" | "ecw" | "jpg2000";
  pointDensity: number[];
  crs: string;
  /** Optional advanced fields */
  targetGsdCm?: number;
  imageScale?: number;
  minFeatures?: number;
  matcher?: "bow" | "bruteforce";
  preset?: PresetId;
}

export type PresetId =
  | "mapping"
  | "inspection"
  | "model3d"
  | "agriculture"
  | "volumetrics"
  | "custom";

export interface Preset {
  id: PresetId;
  label: string;
  description: string;
  settings: Omit<ProcessingSettings, "preset">;
}

const base: Omit<ProcessingSettings, "preset"> = {
  quality: "high",
  meshType: "2.5d",
  dsmEnabled: true,
  dtmEnabled: true,
  contoursEnabled: true,
  contourInterval: 1,
  outputFormat: "geotiff",
  pointDensity: [75],
  crs: "EPSG:4326",
  targetGsdCm: 3,
  imageScale: 1,
  minFeatures: 10000,
  matcher: "bow",
};

export const PRESETS: Preset[] = [
  {
    id: "mapping",
    label: "Mapping",
    description: "2D orthomosaic + DSM for surveys, GIS, and base maps.",
    settings: { ...base, quality: "high", meshType: "2.5d", pointDensity: [50] },
  },
  {
    id: "inspection",
    label: "Inspection",
    description: "Towers, roofs, façades. Dense cloud and full 3D mesh.",
    settings: {
      ...base,
      quality: "ultra",
      meshType: "3d",
      pointDensity: [100],
      dsmEnabled: false,
      dtmEnabled: false,
      contoursEnabled: false,
      minFeatures: 20000,
    },
  },
  {
    id: "model3d",
    label: "3D Model",
    description: "Buildings, monuments, BIM. Textured 3D mesh export.",
    settings: {
      ...base,
      quality: "ultra",
      meshType: "3d",
      pointDensity: [85],
      dsmEnabled: false,
      dtmEnabled: false,
      contoursEnabled: false,
    },
  },
  {
    id: "agriculture",
    label: "Agriculture",
    description: "Field-scale orthomosaic for crop scouting & NDVI overlays.",
    settings: {
      ...base,
      quality: "medium",
      meshType: "2.5d",
      pointDensity: [40],
      contoursEnabled: false,
      targetGsdCm: 5,
    },
  },
  {
    id: "volumetrics",
    label: "Volumetrics",
    description: "Stockpiles, pits, earthworks. DSM + DTM at fine intervals.",
    settings: {
      ...base,
      quality: "high",
      meshType: "2.5d",
      pointDensity: [70],
      contourInterval: 0.5,
      contoursEnabled: true,
    },
  },
  {
    id: "custom",
    label: "Custom",
    description: "Use your own combination of settings.",
    settings: { ...base },
  },
];

export const DEFAULT_SETTINGS: ProcessingSettings = {
  ...PRESETS[0].settings,
  preset: "mapping",
};

/* ────── Cost / time estimator ────── */

const QUALITY_FACTOR: Record<Quality, number> = {
  low: 0.4,
  medium: 0.7,
  high: 1,
  ultra: 1.8,
};

export interface EstimateInput {
  imageCount: number;
  areaHa?: number | null;
  settings: ProcessingSettings;
}

export interface Estimate {
  minutes: number;
  credits: number;
  storageMb: number;
  notes: string[];
}

export function estimateProcessing(input: EstimateInput): Estimate {
  const { imageCount, areaHa, settings } = input;
  const q = QUALITY_FACTOR[settings.quality] ?? 1;
  const meshFactor = settings.meshType === "3d" ? 1.4 : settings.meshType === "none" ? 0.7 : 1;
  const layersFactor =
    1 +
    (settings.dsmEnabled ? 0.05 : 0) +
    (settings.dtmEnabled ? 0.05 : 0) +
    (settings.contoursEnabled ? 0.04 : 0);
  const density = (settings.pointDensity?.[0] ?? 75) / 75;

  // ~5s base per image at quality=high with 2.5D mesh
  const minutes = Math.max(
    2,
    Math.round((imageCount * 5 * q * meshFactor * layersFactor * density) / 60)
  );

  // Credits: 1 credit per 10 images, scaled by quality
  const credits = Math.max(1, Math.round((imageCount / 10) * q * meshFactor));

  // Storage: 8 MB / image at high, scaled
  const storageMb = Math.round(imageCount * 8 * q * meshFactor * density);

  const notes: string[] = [];
  if (areaHa && imageCount / Math.max(1, areaHa) < 80) {
    notes.push("Image density looks low (<80 img/ha). Coverage may be sparse.");
  }
  if (settings.quality === "ultra" && imageCount > 800) {
    notes.push("Ultra quality on >800 images can take many hours.");
  }
  if (settings.meshType === "3d" && (areaHa ?? 0) > 50) {
    notes.push("Full 3D mesh on >50 ha is memory-heavy. Consider 2.5D.");
  }
  return { minutes, credits, storageMb, notes };
}

/* ────── Image QA ────── */

export interface GpsPoint {
  lat: number;
  lng: number;
  alt?: number | null;
  camera?: string | null;
  date?: string | null;
}

export interface QaResult {
  overall: "pass" | "warn" | "fail";
  withGps: number;
  totalImages: number;
  gpsCoveragePct: number;
  estimatedOverlapPct: number | null;
  estimatedAreaHa: number | null;
  imagesPerHa: number | null;
  averageAltitude: number | null;
  uniqueCameras: string[];
  issues: { level: "info" | "warn" | "error"; message: string }[];
}

export function runImageQa(opts: {
  totalImages: number;
  gpsPoints: GpsPoint[];
}): QaResult {
  const { totalImages, gpsPoints } = opts;
  const issues: QaResult["issues"] = [];
  const withGps = gpsPoints.length;
  const gpsCoveragePct = totalImages > 0 ? Math.round((withGps / totalImages) * 100) : 0;

  if (totalImages === 0) issues.push({ level: "error", message: "No images uploaded yet." });
  else if (withGps < 3) issues.push({ level: "error", message: "Fewer than 3 images have GPS — cannot georeference." });
  if (totalImages > 0 && gpsCoveragePct < 70 && withGps >= 3)
    issues.push({ level: "warn", message: `Only ${gpsCoveragePct}% of images have GPS metadata.` });

  let area: number | null = null;
  let imagesPerHa: number | null = null;
  if (withGps >= 3) {
    const minLat = Math.min(...gpsPoints.map((p) => p.lat));
    const maxLat = Math.max(...gpsPoints.map((p) => p.lat));
    const minLng = Math.min(...gpsPoints.map((p) => p.lng));
    const maxLng = Math.max(...gpsPoints.map((p) => p.lng));
    const latM = (maxLat - minLat) * 111320;
    const lngM = (maxLng - minLng) * 111320 * Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    area = Math.max(0.01, (latM * lngM) / 10000);
    imagesPerHa = Math.round(totalImages / area);
    if (imagesPerHa < 80)
      issues.push({ level: "warn", message: `Low density (~${imagesPerHa} img/ha). Aim for 100+ for solid overlap.` });
  }

  const altSamples = gpsPoints.filter((p) => p.alt != null);
  const avgAlt = altSamples.length
    ? altSamples.reduce((s, p) => s + (p.alt as number), 0) / altSamples.length
    : null;

  // Estimated overlap from sequential spacing vs altitude (very rough)
  let estimatedOverlap: number | null = null;
  if (avgAlt && gpsPoints.length > 5) {
    // Footprint width ≈ 1.2 × altitude (consumer drone wide angle assumption)
    const footprintM = 1.2 * avgAlt;
    const distances: number[] = [];
    for (let i = 1; i < gpsPoints.length; i++) {
      const a = gpsPoints[i - 1];
      const b = gpsPoints[i];
      const dLat = (b.lat - a.lat) * 111320;
      const dLng = (b.lng - a.lng) * 111320 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
      distances.push(Math.sqrt(dLat * dLat + dLng * dLng));
    }
    const median = distances.sort((a, b) => a - b)[Math.floor(distances.length / 2)];
    if (median > 0) {
      estimatedOverlap = Math.max(
        0,
        Math.min(95, Math.round((1 - median / footprintM) * 100))
      );
      if (estimatedOverlap < 60)
        issues.push({
          level: "warn",
          message: `Estimated forward overlap is only ~${estimatedOverlap}%. Aim for 75%+.`,
        });
    }
  }

  const cameras = Array.from(
    new Set(gpsPoints.map((p) => p.camera).filter(Boolean) as string[])
  );
  if (cameras.length > 1)
    issues.push({ level: "info", message: `Mixed cameras detected: ${cameras.join(", ")}.` });

  const overall: QaResult["overall"] = issues.some((i) => i.level === "error")
    ? "fail"
    : issues.some((i) => i.level === "warn")
    ? "warn"
    : "pass";

  return {
    overall,
    withGps,
    totalImages,
    gpsCoveragePct,
    estimatedOverlapPct: estimatedOverlap,
    estimatedAreaHa: area,
    imagesPerHa,
    averageAltitude: avgAlt,
    uniqueCameras: cameras,
    issues,
  };
}

/* ────── Pipeline stages (shared between UI & backend) ────── */

export const PIPELINE_STAGES = [
  { key: "alignment", label: "Image Alignment", desc: "Feature matching & camera calibration", from: 0, to: 20 },
  { key: "pointcloud", label: "Dense Point Cloud", desc: "Multi-view stereo reconstruction", from: 20, to: 45 },
  { key: "mesh", label: "Mesh Generation", desc: "Surface reconstruction", from: 45, to: 60 },
  { key: "texture", label: "Texturing", desc: "Color & UV mapping", from: 60, to: 70 },
  { key: "ortho", label: "Orthomosaic", desc: "Georeferenced composite image", from: 70, to: 85 },
  { key: "dem", label: "DSM / DTM", desc: "Digital surface & terrain models", from: 85, to: 95 },
  { key: "export", label: "Final Export", desc: "Package deliverables", from: 95, to: 100 },
] as const;

export type StageKey = (typeof PIPELINE_STAGES)[number]["key"];

export interface StageLogEntry {
  stage: StageKey | "system";
  message: string;
  ts: string;
  level?: "info" | "warn" | "error";
}

export function stageForProgress(progress: number): StageKey {
  for (const s of PIPELINE_STAGES) {
    if (progress < s.to) return s.key;
  }
  return "export";
}

export function formatDurationShort(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
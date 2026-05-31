/**
 * Shared 3D Gaussian Splatting (3DGS) knowledge used across the splat UI.
 *
 * Centralizes the failure modes that wreck splat reconstructions so the
 * landing page, the studio, and the pre-flight checklist all speak with
 * one voice. The 5 limitations come from the platform spec — keep them
 * short enough to fit in chips and tooltips.
 */

export interface SplatLimitation {
  key: "pose" | "lighting" | "motion" | "shutter" | "weight";
  label: string;
  short: string;
  detail: string;
}

export const SPLAT_LIMITATIONS: SplatLimitation[] = [
  {
    key: "pose",
    label: "Pose accuracy",
    short: "GPS / RTK & overlap matter",
    detail:
      "3DGS depends on Structure-from-Motion poses. Weak GPS/RTK or thin overlap produces flawed camera positions and severe spatial artifacts.",
  },
  {
    key: "lighting",
    label: "Lighting drift",
    short: "Keep light stable",
    detail:
      "Optimization assumes static lighting. Moving shadows during long flights bake incorrect geometry into the splat as floating slivers and halos.",
  },
  {
    key: "motion",
    label: "Non-static scene",
    short: "No wind / water / traffic",
    detail:
      "Foliage, water, vehicles and people confuse the optimizer and end up as blurry, spiky or blown-out particles around the moving area.",
  },
  {
    key: "shutter",
    label: "Rolling shutter",
    short: "Prefer mechanical shutter",
    detail:
      "CMOS rolling-shutter readouts add sub-pixel skew that corrupts covariance estimation, reducing crisp high-frequency detail in the splat.",
  },
  {
    key: "weight",
    label: "Data weight",
    short: "Use .ksplat for web",
    detail:
      "Explicit particles produce multi-GB files. Without quantization they kill mobile streaming — prefer the compressed .ksplat format for sharing.",
  },
];

export interface SplatPresetSpec {
  value: "draft" | "balanced" | "cinematic";
  minImages: number;
  recommendedImages: string;
}

export const SPLAT_PRESET_SPECS: Record<string, SplatPresetSpec> = {
  draft:     { value: "draft",     minImages: 60,  recommendedImages: "80–150"  },
  balanced:  { value: "balanced",  minImages: 150, recommendedImages: "200–400" },
  cinematic: { value: "cinematic", minImages: 350, recommendedImages: "500+"    },
};

/**
 * Drone models known to ship a mechanical / global shutter. Anything not
 * on this list is treated as rolling-shutter for the purposes of warning
 * the pilot before they train a splat.
 */
const MECHANICAL_SHUTTER_MODELS = [
  "phantom 4 pro",
  "phantom 4 rtk",
  "mavic 3 enterprise", // M3E ships a mechanical shutter
  "mavic 3 multispectral",
  "matrice 4e",
  "p1", // Zenmuse P1
  "h20", // Zenmuse H20 series (mech shutter on wide)
];

export function hasMechanicalShutter(model: string | null | undefined): boolean {
  if (!model) return false;
  const m = model.toLowerCase();
  return MECHANICAL_SHUTTER_MODELS.some((needle) => m.includes(needle));
}

export interface CaptureFlags {
  staticScene: boolean;
  stableLighting: boolean;
  rtkOrGcp: boolean;
  mechanicalShutter: boolean;
  overlapConfirmed: boolean;
}

export const DEFAULT_CAPTURE_FLAGS: CaptureFlags = {
  staticScene: false,
  stableLighting: false,
  rtkOrGcp: false,
  mechanicalShutter: false,
  overlapConfirmed: false,
};
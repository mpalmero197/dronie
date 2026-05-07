import exifr from "exifr";
import { SENSOR_SPECS, GENERIC_SPEC, type SensorSpec } from "@/lib/sensor-specs";

export interface ExifDetection {
  spec: SensorSpec;
  matched: boolean;
  /** True if either GPS DOP/HPositioningError suggests RTK-grade fix (< 0.05 m). */
  rtkLikely: boolean;
  raw: {
    make?: string;
    model?: string;
    lensModel?: string;
    focalLengthMm?: number;
    imageWidthPx?: number;
    imageHeightPx?: number;
    gpsHpe?: number;
    gpsDop?: number;
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_\-]+/g, "");

/** Fuzzy match an EXIF make+model string against our SENSOR_SPECS table. */
function matchSpec(make?: string, model?: string, lens?: string): SensorSpec | null {
  if (!model && !lens) return null;
  const hay = norm(`${make ?? ""} ${model ?? ""} ${lens ?? ""}`);
  // Score each spec by longest substring of normalized model contained in hay.
  let best: { spec: SensorSpec; score: number } | null = null;
  for (const spec of SENSOR_SPECS) {
    const needle = norm(spec.model);
    if (!needle) continue;
    if (hay.includes(needle)) {
      const score = needle.length;
      if (!best || score > best.score) best = { spec, score };
    }
  }
  // Manufacturer-only fallback (e.g. "FC8482" -> Mavic 3): match on make if model unknown.
  if (!best && make) {
    const mk = norm(make);
    for (const spec of SENSOR_SPECS) {
      if (norm(spec.manufacturer).includes(mk) || mk.includes(norm(spec.manufacturer))) {
        // Pick the most common rig per make as a weak guess.
        if (!best) best = { spec, score: 1 };
      }
    }
  }
  return best?.spec ?? null;
}

/** Read EXIF from a single image and infer drone/sensor + RTK likelihood. */
export async function detectSensorFromImage(file: File): Promise<ExifDetection | null> {
  try {
    const tags = await exifr.parse(file, {
      tiff: true, exif: true, gps: true, xmp: true,
      pick: [
        "Make", "Model", "LensModel", "FocalLength", "FocalLengthIn35mmFormat",
        "ExifImageWidth", "ExifImageHeight", "PixelXDimension", "PixelYDimension",
        "GPSDOP", "GPSHPositioningError", "RtkFlag", "RtkStdLon", "RtkStdLat",
      ],
    });
    if (!tags) return null;

    const make = tags.Make as string | undefined;
    const model = tags.Model as string | undefined;
    const lens = tags.LensModel as string | undefined;
    const focal = (tags.FocalLength as number | undefined) ?? undefined;
    const w = (tags.ExifImageWidth ?? tags.PixelXDimension) as number | undefined;
    const h = (tags.ExifImageHeight ?? tags.PixelYDimension) as number | undefined;
    const gpsHpe = tags.GPSHPositioningError as number | undefined;
    const gpsDop = tags.GPSDOP as number | undefined;
    const rtkStd = (tags.RtkStdLon ?? tags.RtkStdLat) as number | undefined;

    const matched = matchSpec(make, model, lens);
    let spec: SensorSpec = matched ?? { ...GENERIC_SPEC };
    if (!matched && (focal || w)) {
      // Build an ad-hoc spec from EXIF when no preset matches.
      spec = {
        ...GENERIC_SPEC,
        manufacturer: make || "Generic",
        model: model || lens || "Unknown drone",
        camera: [make, model, lens].filter(Boolean).join(" ") || GENERIC_SPEC.camera,
        focalLengthMm: focal ?? GENERIC_SPEC.focalLengthMm,
        imageWidthPx: w ?? GENERIC_SPEC.imageWidthPx,
        imageHeightPx: h ?? GENERIC_SPEC.imageHeightPx,
      };
    }

    // RTK heuristic: DJI writes RtkStdLon/Lat on RTK frames; otherwise sub-decimetre HPE
    // is a strong RTK signal (consumer GPS ~2–5 m).
    const rtkLikely =
      (typeof rtkStd === "number" && rtkStd < 0.5) ||
      (typeof gpsHpe === "number" && gpsHpe < 0.1) ||
      spec.hasRtk;

    if (rtkLikely && !spec.hasRtk) {
      spec = { ...spec, hasRtk: true };
    }

    return {
      spec,
      matched: !!matched,
      rtkLikely,
      raw: {
        make, model, lensModel: lens,
        focalLengthMm: focal,
        imageWidthPx: w, imageHeightPx: h,
        gpsHpe, gpsDop,
      },
    };
  } catch {
    return null;
  }
}
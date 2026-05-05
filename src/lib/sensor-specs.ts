/**
 * Photogrammetry sensor specifications for common drones.
 *
 * Values are pulled from manufacturer datasheets and are accurate enough
 * for mission planning (GSD, footprint, line spacing, capture interval).
 *
 *   sensorWidthMm × sensorHeightMm   — physical sensor dimensions (mm)
 *   focalLengthMm                    — 35-mm-equivalent focal length adjusted for sensor (NOT EFL)
 *   imageWidthPx × imageHeightPx     — output image resolution (pixels)
 *   hasRtk                           — onboard RTK / network RTK capable
 *   hasMechanicalShutter             — mechanical (true) vs rolling (false)
 *   maxSpeedMs                       — typical safe survey speed (m/s)
 *   notes                            — operator-relevant gotchas
 */
export interface SensorSpec {
  manufacturer: string;
  model: string;
  /** Camera marketing name (e.g. "Hasselblad L2D-20c"). */
  camera: string;
  sensorWidthMm: number;
  sensorHeightMm: number;
  focalLengthMm: number;
  imageWidthPx: number;
  imageHeightPx: number;
  hasRtk: boolean;
  hasMechanicalShutter: boolean;
  maxSpeedMs: number;
  notes?: string;
}

export const SENSOR_SPECS: SensorSpec[] = [
  // ───── DJI ─────
  {
    manufacturer: "DJI", model: "Mavic 3", camera: "Hasselblad L2D-20c (4/3 CMOS)",
    sensorWidthMm: 17.3, sensorHeightMm: 13.0, focalLengthMm: 12.29,
    imageWidthPx: 5280, imageHeightPx: 3956,
    hasRtk: false, hasMechanicalShutter: false, maxSpeedMs: 8,
    notes: "Rolling shutter — limit speed to 8 m/s for clean orthos.",
  },
  {
    manufacturer: "DJI", model: "Mavic 3 Pro", camera: "Hasselblad L2D-20c (4/3 CMOS, 24 mm)",
    sensorWidthMm: 17.3, sensorHeightMm: 13.0, focalLengthMm: 12.29,
    imageWidthPx: 5280, imageHeightPx: 3956,
    hasRtk: false, hasMechanicalShutter: false, maxSpeedMs: 8,
  },
  {
    manufacturer: "DJI", model: "Mavic 3 Enterprise", camera: "4/3 CMOS, 24 mm",
    sensorWidthMm: 17.3, sensorHeightMm: 13.0, focalLengthMm: 12.29,
    imageWidthPx: 5280, imageHeightPx: 3956,
    hasRtk: true, hasMechanicalShutter: true, maxSpeedMs: 15,
    notes: "Mechanical shutter — fly fast. RTK module recommended for cm-grade accuracy.",
  },
  {
    manufacturer: "DJI", model: "Mini 4 Pro", camera: "1/1.3-inch CMOS",
    sensorWidthMm: 9.6, sensorHeightMm: 7.2, focalLengthMm: 6.7,
    imageWidthPx: 8064, imageHeightPx: 6048,
    hasRtk: false, hasMechanicalShutter: false, maxSpeedMs: 6,
    notes: "Sub-250 g, but small sensor → noisier dense cloud. Fly low for sub-2 cm GSD.",
  },
  {
    manufacturer: "DJI", model: "Air 3S", camera: "1-inch CMOS (24 mm)",
    sensorWidthMm: 13.2, sensorHeightMm: 8.8, focalLengthMm: 9.0,
    imageWidthPx: 5280, imageHeightPx: 3956,
    hasRtk: false, hasMechanicalShutter: false, maxSpeedMs: 8,
  },
  {
    manufacturer: "DJI", model: "Phantom 4 RTK", camera: "1-inch CMOS",
    sensorWidthMm: 13.2, sensorHeightMm: 8.8, focalLengthMm: 8.8,
    imageWidthPx: 5472, imageHeightPx: 3648,
    hasRtk: true, hasMechanicalShutter: true, maxSpeedMs: 15,
    notes: "Workhorse survey rig. RTK + mechanical shutter = sub-cm with few/no GCPs.",
  },
  {
    manufacturer: "DJI", model: "Matrice 350 RTK", camera: "Zenmuse P1 (full-frame, 35 mm)",
    sensorWidthMm: 35.9, sensorHeightMm: 24.0, focalLengthMm: 35,
    imageWidthPx: 8192, imageHeightPx: 5460,
    hasRtk: true, hasMechanicalShutter: true, maxSpeedMs: 20,
    notes: "P1 is the gold standard. 45 MP full-frame, global mechanical shutter.",
  },
  {
    manufacturer: "DJI", model: "Matrice 4E", camera: "4/3 CMOS, 24 mm equivalent",
    sensorWidthMm: 17.3, sensorHeightMm: 13.0, focalLengthMm: 12.29,
    imageWidthPx: 5280, imageHeightPx: 3956,
    hasRtk: true, hasMechanicalShutter: true, maxSpeedMs: 18,
  },
  {
    manufacturer: "DJI", model: "Matrice 30", camera: "1/2-inch CMOS wide",
    sensorWidthMm: 6.4, sensorHeightMm: 4.8, focalLengthMm: 4.5,
    imageWidthPx: 4000, imageHeightPx: 3000,
    hasRtk: true, hasMechanicalShutter: false, maxSpeedMs: 12,
  },
  {
    manufacturer: "DJI", model: "Mavic 3 Multispectral", camera: "RGB + 4× MS (G/R/RE/NIR)",
    sensorWidthMm: 17.3, sensorHeightMm: 13.0, focalLengthMm: 12.29,
    imageWidthPx: 5280, imageHeightPx: 3956,
    hasRtk: true, hasMechanicalShutter: true, maxSpeedMs: 15,
    notes: "Use the RGB band for SfM; MS bands align via gimbal calibration.",
  },

  // ───── Autel ─────
  {
    manufacturer: "Autel Robotics", model: "EVO II Pro V3", camera: "1-inch CMOS",
    sensorWidthMm: 13.2, sensorHeightMm: 8.8, focalLengthMm: 10.6,
    imageWidthPx: 5472, imageHeightPx: 3648,
    hasRtk: false, hasMechanicalShutter: false, maxSpeedMs: 8,
  },
  {
    manufacturer: "Autel Robotics", model: "EVO II RTK V3", camera: "1-inch CMOS + RTK",
    sensorWidthMm: 13.2, sensorHeightMm: 8.8, focalLengthMm: 10.6,
    imageWidthPx: 5472, imageHeightPx: 3648,
    hasRtk: true, hasMechanicalShutter: true, maxSpeedMs: 15,
  },

  // ───── Parrot ─────
  {
    manufacturer: "Parrot", model: "Anafi Ai", camera: "1/2-inch CMOS, 24 mm",
    sensorWidthMm: 6.4, sensorHeightMm: 4.8, focalLengthMm: 4.04,
    imageWidthPx: 8000, imageHeightPx: 6000,
    hasRtk: true, hasMechanicalShutter: false, maxSpeedMs: 10,
    notes: "4G-connected, PIX4Dcloud-ready. RTK via NTRIP.",
  },
  {
    manufacturer: "Parrot", model: "Anafi USA", camera: "1/2-inch wide RGB",
    sensorWidthMm: 6.4, sensorHeightMm: 4.8, focalLengthMm: 4.04,
    imageWidthPx: 5344, imageHeightPx: 4016,
    hasRtk: false, hasMechanicalShutter: false, maxSpeedMs: 8,
  },

  // ───── senseFly / Wingtra (fixed-wing) ─────
  {
    manufacturer: "senseFly", model: "eBee X", camera: "S.O.D.A. 3D (1-inch)",
    sensorWidthMm: 13.2, sensorHeightMm: 8.8, focalLengthMm: 10.6,
    imageWidthPx: 5472, imageHeightPx: 3648,
    hasRtk: true, hasMechanicalShutter: true, maxSpeedMs: 30,
    notes: "Fixed-wing — long endurance, oblique trio for façades.",
  },
  {
    manufacturer: "Wingtra", model: "WingtraOne Gen II", camera: "Sony RX1R II (full-frame, 42 MP)",
    sensorWidthMm: 35.9, sensorHeightMm: 24.0, focalLengthMm: 35,
    imageWidthPx: 7952, imageHeightPx: 5304,
    hasRtk: true, hasMechanicalShutter: true, maxSpeedMs: 16,
    notes: "VTOL + 42 MP full-frame. Best-in-class GSD over large areas.",
  },

  // ───── Skydio ─────
  {
    manufacturer: "Skydio", model: "Skydio X10", camera: "1/1.3-inch RGB telephoto + wide",
    sensorWidthMm: 9.6, sensorHeightMm: 7.2, focalLengthMm: 6.7,
    imageWidthPx: 8064, imageHeightPx: 6048,
    hasRtk: false, hasMechanicalShutter: false, maxSpeedMs: 10,
    notes: "Autonomous orbit & inspection — best for façades / vertical structures.",
  },
];

const KEY = (m: string, model: string) => `${m.toLowerCase()}|${model.toLowerCase()}`;
const INDEX = new Map<string, SensorSpec>(
  SENSOR_SPECS.map((s) => [KEY(s.manufacturer, s.model), s])
);

export function findSensorSpec(manufacturer: string, model: string): SensorSpec | null {
  return INDEX.get(KEY(manufacturer, model)) ?? null;
}

/** Fallback for unknown drones — generic 1-inch consumer camera. */
export const GENERIC_SPEC: SensorSpec = {
  manufacturer: "Generic",
  model: "1-inch consumer drone",
  camera: "1-inch CMOS, 24 mm equivalent",
  sensorWidthMm: 13.2, sensorHeightMm: 8.8, focalLengthMm: 8.8,
  imageWidthPx: 5472, imageHeightPx: 3648,
  hasRtk: false, hasMechanicalShutter: false, maxSpeedMs: 8,
};

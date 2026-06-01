export interface DroneModel {
  name: string;
  category?: "consumer" | "prosumer" | "enterprise" | "survey" | "fpv" | "fixed-wing" | "heavy-lift" | "vtol" | "military";
  /** Capability flags drive the Drone Control Console. */
  capabilities?: {
    rtk?: boolean;
    thermal?: boolean;
    multispectral?: boolean;
    lidar?: boolean;
    zoomCamera?: boolean;
    parachute?: boolean;
    spotlight?: boolean;
    speaker?: boolean;
    sprayer?: boolean;
    cargo?: boolean;
    waypointMission?: boolean;
    obstacleAvoidance?: boolean;
    adsbIn?: boolean;
    swarm?: boolean;
  };
  /** Operating envelope. */
  envelope?: {
    maxAltitudeM?: number;
    maxSpeedMps?: number;
    maxFlightMinutes?: number;
    maxPayloadKg?: number;
    motorCount?: number;
  };
}

export interface DroneManufacturer {
  name: string;
  models: DroneModel[];
}

export const DRONE_CATALOG: DroneManufacturer[] = [
  {
    name: "DJI",
    models: [
      { name: "Mavic 3", category: "prosumer" },
      { name: "Mavic 3 Pro", category: "prosumer" },
      { name: "Mavic 3 Classic", category: "prosumer" },
      { name: "Mavic 3 Enterprise", category: "enterprise" },
      { name: "Mavic 3 Thermal", category: "enterprise" },
      { name: "Mavic 3 Multispectral", category: "enterprise" },
      { name: "Mini 4 Pro", category: "consumer" },
      { name: "Mini 4K", category: "consumer" },
      { name: "Mini 3 Pro", category: "consumer" },
      { name: "Mini 3", category: "consumer" },
      { name: "Air 3", category: "consumer" },
      { name: "Air 3S", category: "consumer" },
      { name: "Avata 2", category: "fpv" },
      { name: "Avata", category: "fpv" },
      { name: "FPV", category: "fpv" },
      { name: "Phantom 4 Pro V2", category: "prosumer" },
      { name: "Phantom 4 RTK", category: "survey" },
      { name: "Matrice 30", category: "enterprise" },
      { name: "Matrice 30T", category: "enterprise" },
      { name: "Matrice 300 RTK", category: "enterprise" },
      { name: "Matrice 350 RTK", category: "enterprise" },
      { name: "Matrice 4E", category: "survey" },
      { name: "Matrice 4T", category: "enterprise" },
      { name: "Matrice 200 V2", category: "enterprise" },
      { name: "Matrice 210 RTK V2", category: "enterprise" },
      { name: "Inspire 3", category: "prosumer" },
      { name: "Inspire 2", category: "prosumer" },
      { name: "Agras T40", category: "enterprise" },
      { name: "Agras T50", category: "enterprise" },
    ],
  },
  {
    name: "Autel Robotics",
    models: [
      { name: "EVO Lite+", category: "consumer" },
      { name: "EVO Nano+", category: "consumer" },
      { name: "EVO II Pro V3", category: "prosumer" },
      { name: "EVO II Dual 640T V3", category: "enterprise" },
      { name: "EVO II RTK V3", category: "survey" },
      { name: "EVO Max 4T", category: "enterprise" },
      { name: "EVO Max 4N", category: "enterprise" },
      { name: "Dragonfish Standard", category: "fixed-wing" },
      { name: "Dragonfish Pro", category: "fixed-wing" },
    ],
  },
  {
    name: "Skydio",
    models: [
      { name: "Skydio 2+", category: "prosumer" },
      { name: "Skydio X2", category: "enterprise" },
      { name: "Skydio X10", category: "enterprise" },
      { name: "Skydio X10D", category: "enterprise" },
    ],
  },
  {
    name: "Parrot",
    models: [
      { name: "Anafi", category: "consumer" },
      { name: "Anafi USA", category: "enterprise" },
      { name: "Anafi Ai", category: "enterprise" },
      { name: "Anafi Thermal", category: "enterprise" },
    ],
  },
  {
    name: "Yuneec",
    models: [
      { name: "Typhoon H Plus", category: "prosumer" },
      { name: "H520E", category: "enterprise" },
      { name: "H850-RTK", category: "survey" },
    ],
  },
  {
    name: "Freefly",
    models: [
      { name: "Astro", category: "survey" },
      { name: "Astro Map", category: "survey" },
      { name: "Alta X", category: "enterprise" },
      { name: "Alta 8 Pro", category: "enterprise" },
    ],
  },
  {
    name: "Wingtra",
    models: [
      { name: "WingtraOne Gen II", category: "fixed-wing" },
    ],
  },
  {
    name: "senseFly",
    models: [
      { name: "eBee X", category: "fixed-wing" },
      { name: "eBee Geo", category: "fixed-wing" },
      { name: "eBee TAC", category: "fixed-wing" },
    ],
  },
  {
    name: "Quantum Systems",
    models: [
      { name: "Trinity Pro", category: "fixed-wing" },
      { name: "Trinity F90+", category: "fixed-wing" },
      { name: "Vector", category: "fixed-wing" },
    ],
  },
  {
    name: "Teal",
    models: [
      { name: "Teal 2", category: "enterprise" },
      { name: "Black Widow", category: "enterprise" },
    ],
  },
  {
    name: "BRINC",
    models: [
      { name: "Lemur 2", category: "enterprise" },
      { name: "Responder", category: "enterprise" },
    ],
  },
  {
    name: "Holy Stone",
    models: [
      { name: "HS720E", category: "consumer" },
      { name: "HS900", category: "consumer" },
    ],
  },
  {
    name: "Hubsan",
    models: [
      { name: "Zino Mini Pro", category: "consumer" },
      { name: "Zino 2+", category: "consumer" },
    ],
  },
  {
    name: "Potensic",
    models: [
      { name: "Atom SE", category: "consumer" },
      { name: "Atom 2", category: "consumer" },
    ],
  },
  {
    name: "Other / Custom",
    models: [
      { name: "Custom build", category: "fpv" },
      { name: "Other", category: "consumer" },
    ],
  },
];

export function getManufacturer(name: string): DroneManufacturer | undefined {
  return DRONE_CATALOG.find((m) => m.name.toLowerCase() === name.toLowerCase());
}

export function getModelsFor(manufacturer: string): DroneModel[] {
  return getManufacturer(manufacturer)?.models ?? [];
}

export function formatDroneLabel(manufacturer: string, model: string): string {
  return `${manufacturer} ${model}`.trim();
}

/** Parse a flat equipment string ("DJI Mavic 3 Pro") into manufacturer + model. */
export function parseEquipmentString(value: string): { manufacturer: string; model: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  for (const mfr of DRONE_CATALOG) {
    if (trimmed.toLowerCase().startsWith(mfr.name.toLowerCase())) {
      const rest = trimmed.slice(mfr.name.length).trim();
      const found = mfr.models.find((m) => m.name.toLowerCase() === rest.toLowerCase());
      return { manufacturer: mfr.name, model: found?.name ?? rest };
    }
  }
  return null;
}

export function normalizeSerial(serial: string): string {
  return serial.trim().toLowerCase();
}
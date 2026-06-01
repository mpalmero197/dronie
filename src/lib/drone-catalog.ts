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
      { name: "Mavic 3", category: "prosumer", envelope: { maxAltitudeM: 6000, maxSpeedMps: 21, maxFlightMinutes: 46, motorCount: 4 }, capabilities: { obstacleAvoidance: true, waypointMission: true, adsbIn: true } },
      { name: "Mavic 3 Pro", category: "prosumer", envelope: { maxAltitudeM: 6000, maxSpeedMps: 21, maxFlightMinutes: 43, motorCount: 4 }, capabilities: { obstacleAvoidance: true, waypointMission: true, zoomCamera: true, adsbIn: true } },
      { name: "Mavic 3 Classic", category: "prosumer", envelope: { maxAltitudeM: 6000, maxSpeedMps: 21, maxFlightMinutes: 46, motorCount: 4 }, capabilities: { obstacleAvoidance: true, waypointMission: true } },
      { name: "Mavic 3 Enterprise", category: "enterprise", envelope: { maxAltitudeM: 6000, maxSpeedMps: 21, maxFlightMinutes: 45, motorCount: 4 }, capabilities: { rtk: true, zoomCamera: true, spotlight: true, speaker: true, waypointMission: true, obstacleAvoidance: true, adsbIn: true } },
      { name: "Mavic 3 Thermal", category: "enterprise", envelope: { maxAltitudeM: 6000, maxSpeedMps: 21, maxFlightMinutes: 45, motorCount: 4 }, capabilities: { thermal: true, rtk: true, zoomCamera: true, spotlight: true, speaker: true, waypointMission: true, obstacleAvoidance: true } },
      { name: "Mavic 3 Multispectral", category: "enterprise", envelope: { maxAltitudeM: 6000, maxSpeedMps: 21, maxFlightMinutes: 43, motorCount: 4 }, capabilities: { multispectral: true, rtk: true, waypointMission: true } },
      { name: "Mini 4 Pro", category: "consumer", envelope: { maxAltitudeM: 4000, maxSpeedMps: 16, maxFlightMinutes: 34, motorCount: 4 }, capabilities: { obstacleAvoidance: true, waypointMission: true } },
      { name: "Mini 4K", category: "consumer", envelope: { maxAltitudeM: 4000, maxSpeedMps: 16, maxFlightMinutes: 31, motorCount: 4 } },
      { name: "Mini 3 Pro", category: "consumer", envelope: { maxAltitudeM: 4000, maxSpeedMps: 16, maxFlightMinutes: 34, motorCount: 4 }, capabilities: { obstacleAvoidance: true } },
      { name: "Mini 3", category: "consumer", envelope: { maxAltitudeM: 4000, maxSpeedMps: 16, maxFlightMinutes: 38, motorCount: 4 } },
      { name: "Air 3", category: "consumer", envelope: { maxAltitudeM: 6000, maxSpeedMps: 21, maxFlightMinutes: 46, motorCount: 4 }, capabilities: { obstacleAvoidance: true, waypointMission: true, zoomCamera: true } },
      { name: "Air 3S", category: "consumer", envelope: { maxAltitudeM: 6000, maxSpeedMps: 21, maxFlightMinutes: 45, motorCount: 4 }, capabilities: { obstacleAvoidance: true, waypointMission: true, zoomCamera: true, adsbIn: true } },
      { name: "Avata 2", category: "fpv", envelope: { maxAltitudeM: 5000, maxSpeedMps: 27, maxFlightMinutes: 23, motorCount: 4 } },
      { name: "Avata", category: "fpv", envelope: { maxAltitudeM: 5000, maxSpeedMps: 27, maxFlightMinutes: 18, motorCount: 4 } },
      { name: "FPV", category: "fpv", envelope: { maxAltitudeM: 6000, maxSpeedMps: 39, maxFlightMinutes: 20, motorCount: 4 } },
      { name: "Phantom 4 Pro V2", category: "prosumer", envelope: { maxAltitudeM: 6000, maxSpeedMps: 20, maxFlightMinutes: 30, motorCount: 4 } },
      { name: "Phantom 4 RTK", category: "survey", envelope: { maxAltitudeM: 6000, maxSpeedMps: 20, maxFlightMinutes: 30, motorCount: 4 }, capabilities: { rtk: true, waypointMission: true } },
      { name: "Matrice 30", category: "enterprise", envelope: { maxAltitudeM: 7000, maxSpeedMps: 23, maxFlightMinutes: 41, motorCount: 4 }, capabilities: { rtk: true, zoomCamera: true, spotlight: true, speaker: true, waypointMission: true, obstacleAvoidance: true, adsbIn: true } },
      { name: "Matrice 30T", category: "enterprise", envelope: { maxAltitudeM: 7000, maxSpeedMps: 23, maxFlightMinutes: 41, motorCount: 4 }, capabilities: { thermal: true, rtk: true, zoomCamera: true, spotlight: true, speaker: true, waypointMission: true, obstacleAvoidance: true, adsbIn: true } },
      { name: "Matrice 300 RTK", category: "enterprise", envelope: { maxAltitudeM: 7000, maxSpeedMps: 23, maxFlightMinutes: 55, maxPayloadKg: 2.7, motorCount: 4 }, capabilities: { rtk: true, thermal: true, lidar: true, zoomCamera: true, spotlight: true, speaker: true, waypointMission: true, obstacleAvoidance: true, adsbIn: true, parachute: true } },
      { name: "Matrice 350 RTK", category: "enterprise", envelope: { maxAltitudeM: 7000, maxSpeedMps: 23, maxFlightMinutes: 55, maxPayloadKg: 2.7, motorCount: 4 }, capabilities: { rtk: true, thermal: true, lidar: true, zoomCamera: true, spotlight: true, speaker: true, waypointMission: true, obstacleAvoidance: true, adsbIn: true, parachute: true } },
      { name: "Matrice 4E", category: "survey", envelope: { maxAltitudeM: 6000, maxSpeedMps: 21, maxFlightMinutes: 49, motorCount: 4 }, capabilities: { rtk: true, lidar: true, waypointMission: true, obstacleAvoidance: true } },
      { name: "Matrice 4T", category: "enterprise", envelope: { maxAltitudeM: 6000, maxSpeedMps: 21, maxFlightMinutes: 49, motorCount: 4 }, capabilities: { thermal: true, rtk: true, zoomCamera: true, spotlight: true, speaker: true, waypointMission: true, obstacleAvoidance: true } },
      { name: "Matrice 200 V2", category: "enterprise", envelope: { maxAltitudeM: 3000, maxSpeedMps: 23, maxFlightMinutes: 38, motorCount: 4 } },
      { name: "Matrice 210 RTK V2", category: "enterprise", envelope: { maxAltitudeM: 3000, maxSpeedMps: 23, maxFlightMinutes: 33, motorCount: 4 }, capabilities: { rtk: true, thermal: true } },
      { name: "Matrice 600 Pro", category: "heavy-lift", envelope: { maxAltitudeM: 2500, maxSpeedMps: 18, maxFlightMinutes: 38, maxPayloadKg: 6, motorCount: 6 }, capabilities: { rtk: true, cargo: true, waypointMission: true } },
      { name: "FlyCart 30", category: "heavy-lift", envelope: { maxAltitudeM: 6000, maxSpeedMps: 20, maxFlightMinutes: 29, maxPayloadKg: 30, motorCount: 8 }, capabilities: { rtk: true, cargo: true, parachute: true, waypointMission: true, obstacleAvoidance: true } },
      { name: "Inspire 3", category: "prosumer", envelope: { maxAltitudeM: 7000, maxSpeedMps: 26, maxFlightMinutes: 28, motorCount: 4 }, capabilities: { rtk: true, waypointMission: true, obstacleAvoidance: true } },
      { name: "Inspire 2", category: "prosumer", envelope: { maxAltitudeM: 5000, maxSpeedMps: 30, maxFlightMinutes: 27, motorCount: 4 } },
      { name: "Agras T40", category: "enterprise", envelope: { maxAltitudeM: 4500, maxSpeedMps: 10, maxFlightMinutes: 18, maxPayloadKg: 40, motorCount: 4 }, capabilities: { rtk: true, sprayer: true, waypointMission: true, obstacleAvoidance: true } },
      { name: "Agras T50", category: "enterprise", envelope: { maxAltitudeM: 4500, maxSpeedMps: 10, maxFlightMinutes: 18, maxPayloadKg: 50, motorCount: 4 }, capabilities: { rtk: true, sprayer: true, waypointMission: true, obstacleAvoidance: true } },
      { name: "Dock 2", category: "enterprise", envelope: { maxAltitudeM: 6000, maxSpeedMps: 21, maxFlightMinutes: 50, motorCount: 4 }, capabilities: { rtk: true, waypointMission: true, obstacleAvoidance: true, adsbIn: true } },
    ],
  },
  {
    name: "Autel Robotics",
    models: [
      { name: "EVO Lite+", category: "consumer", envelope: { maxAltitudeM: 5000, maxSpeedMps: 18, maxFlightMinutes: 40, motorCount: 4 } },
      { name: "EVO Nano+", category: "consumer", envelope: { maxAltitudeM: 4000, maxSpeedMps: 15, maxFlightMinutes: 28, motorCount: 4 } },
      { name: "EVO II Pro V3", category: "prosumer", envelope: { maxAltitudeM: 7000, maxSpeedMps: 20, maxFlightMinutes: 40, motorCount: 4 }, capabilities: { waypointMission: true, obstacleAvoidance: true } },
      { name: "EVO II Dual 640T V3", category: "enterprise", envelope: { maxAltitudeM: 7000, maxSpeedMps: 20, maxFlightMinutes: 38, motorCount: 4 }, capabilities: { thermal: true, waypointMission: true, obstacleAvoidance: true } },
      { name: "EVO II RTK V3", category: "survey", envelope: { maxAltitudeM: 7000, maxSpeedMps: 20, maxFlightMinutes: 38, motorCount: 4 }, capabilities: { rtk: true, waypointMission: true } },
      { name: "EVO Max 4T", category: "enterprise", envelope: { maxAltitudeM: 7000, maxSpeedMps: 23, maxFlightMinutes: 42, motorCount: 4 }, capabilities: { thermal: true, zoomCamera: true, spotlight: true, speaker: true, waypointMission: true, obstacleAvoidance: true } },
      { name: "EVO Max 4N", category: "enterprise", envelope: { maxAltitudeM: 7000, maxSpeedMps: 23, maxFlightMinutes: 42, motorCount: 4 }, capabilities: { zoomCamera: true, spotlight: true, speaker: true, waypointMission: true, obstacleAvoidance: true } },
      { name: "Dragonfish Standard", category: "vtol", envelope: { maxAltitudeM: 5000, maxSpeedMps: 28, maxFlightMinutes: 120, motorCount: 5 }, capabilities: { rtk: true, waypointMission: true } },
      { name: "Dragonfish Pro", category: "vtol", envelope: { maxAltitudeM: 5000, maxSpeedMps: 28, maxFlightMinutes: 180, motorCount: 5 }, capabilities: { rtk: true, thermal: true, zoomCamera: true, waypointMission: true } },
      { name: "Dragonfish Lite", category: "vtol", envelope: { maxAltitudeM: 4500, maxSpeedMps: 26, maxFlightMinutes: 90, motorCount: 5 }, capabilities: { rtk: true, waypointMission: true } },
    ],
  },
  {
    name: "Skydio",
    models: [
      { name: "Skydio 2+", category: "prosumer", envelope: { maxAltitudeM: 4500, maxSpeedMps: 16, maxFlightMinutes: 27, motorCount: 4 }, capabilities: { obstacleAvoidance: true, waypointMission: true } },
      { name: "Skydio X2", category: "enterprise", envelope: { maxAltitudeM: 5000, maxSpeedMps: 16, maxFlightMinutes: 35, motorCount: 4 }, capabilities: { thermal: true, obstacleAvoidance: true, waypointMission: true } },
      { name: "Skydio X10", category: "enterprise", envelope: { maxAltitudeM: 5000, maxSpeedMps: 20, maxFlightMinutes: 40, motorCount: 4 }, capabilities: { thermal: true, zoomCamera: true, obstacleAvoidance: true, waypointMission: true, adsbIn: true, swarm: true } },
      { name: "Skydio X10D", category: "military", envelope: { maxAltitudeM: 5000, maxSpeedMps: 20, maxFlightMinutes: 40, motorCount: 4 }, capabilities: { thermal: true, zoomCamera: true, obstacleAvoidance: true, waypointMission: true, swarm: true } },
      { name: "Skydio Dock for X10", category: "enterprise", envelope: { maxAltitudeM: 5000, maxSpeedMps: 20, maxFlightMinutes: 40, motorCount: 4 }, capabilities: { thermal: true, zoomCamera: true, obstacleAvoidance: true, waypointMission: true } },
    ],
  },
  {
    name: "Parrot",
    models: [
      { name: "Anafi", category: "consumer", envelope: { maxAltitudeM: 4500, maxSpeedMps: 15, maxFlightMinutes: 25, motorCount: 4 } },
      { name: "Anafi USA", category: "enterprise", envelope: { maxAltitudeM: 4500, maxSpeedMps: 15, maxFlightMinutes: 32, motorCount: 4 }, capabilities: { thermal: true, zoomCamera: true, waypointMission: true } },
      { name: "Anafi Ai", category: "enterprise", envelope: { maxAltitudeM: 5000, maxSpeedMps: 15, maxFlightMinutes: 32, motorCount: 4 }, capabilities: { rtk: true, waypointMission: true, obstacleAvoidance: true } },
      { name: "Anafi Thermal", category: "enterprise", envelope: { maxAltitudeM: 4500, maxSpeedMps: 15, maxFlightMinutes: 26, motorCount: 4 }, capabilities: { thermal: true, waypointMission: true } },
    ],
  },
  {
    name: "Yuneec",
    models: [
      { name: "Typhoon H Plus", category: "prosumer", envelope: { maxAltitudeM: 500, maxSpeedMps: 13, maxFlightMinutes: 28, motorCount: 6 } },
      { name: "H520E", category: "enterprise", envelope: { maxAltitudeM: 4000, maxSpeedMps: 14, maxFlightMinutes: 28, motorCount: 6 }, capabilities: { thermal: true, waypointMission: true } },
      { name: "H850-RTK", category: "survey", envelope: { maxAltitudeM: 4000, maxSpeedMps: 20, maxFlightMinutes: 55, motorCount: 6 }, capabilities: { rtk: true, thermal: true, waypointMission: true } },
    ],
  },
  {
    name: "Freefly",
    models: [
      { name: "Astro", category: "survey", envelope: { maxAltitudeM: 5000, maxSpeedMps: 18, maxFlightMinutes: 35, maxPayloadKg: 1.5, motorCount: 4 }, capabilities: { rtk: true, waypointMission: true } },
      { name: "Astro Map", category: "survey", envelope: { maxAltitudeM: 5000, maxSpeedMps: 18, maxFlightMinutes: 35, motorCount: 4 }, capabilities: { rtk: true, lidar: true, waypointMission: true } },
      { name: "Alta X", category: "heavy-lift", envelope: { maxAltitudeM: 5500, maxSpeedMps: 27, maxFlightMinutes: 50, maxPayloadKg: 15.9, motorCount: 4 }, capabilities: { rtk: true, cargo: true, lidar: true, waypointMission: true, parachute: true } },
      { name: "Alta 8 Pro", category: "heavy-lift", envelope: { maxAltitudeM: 5500, maxSpeedMps: 24, maxFlightMinutes: 35, maxPayloadKg: 9, motorCount: 8 }, capabilities: { cargo: true, waypointMission: true } },
    ],
  },
  {
    name: "Wingtra",
    models: [
      { name: "WingtraOne Gen II", category: "vtol", envelope: { maxAltitudeM: 4800, maxSpeedMps: 16, maxFlightMinutes: 59, motorCount: 4 }, capabilities: { rtk: true, multispectral: true, waypointMission: true } },
      { name: "WingtraOne Gen III", category: "vtol", envelope: { maxAltitudeM: 4800, maxSpeedMps: 16, maxFlightMinutes: 65, motorCount: 4 }, capabilities: { rtk: true, multispectral: true, lidar: true, waypointMission: true } },
    ],
  },
  {
    name: "senseFly",
    models: [
      { name: "eBee X", category: "fixed-wing", envelope: { maxAltitudeM: 4500, maxSpeedMps: 30, maxFlightMinutes: 90, motorCount: 1 }, capabilities: { rtk: true, waypointMission: true } },
      { name: "eBee Geo", category: "fixed-wing", envelope: { maxAltitudeM: 4500, maxSpeedMps: 30, maxFlightMinutes: 45, motorCount: 1 }, capabilities: { waypointMission: true } },
      { name: "eBee TAC", category: "military", envelope: { maxAltitudeM: 4500, maxSpeedMps: 30, maxFlightMinutes: 90, motorCount: 1 }, capabilities: { rtk: true, thermal: true, waypointMission: true } },
    ],
  },
  {
    name: "Quantum Systems",
    models: [
      { name: "Trinity Pro", category: "vtol", envelope: { maxAltitudeM: 4500, maxSpeedMps: 17, maxFlightMinutes: 90, motorCount: 5 }, capabilities: { rtk: true, multispectral: true, lidar: true, waypointMission: true } },
      { name: "Trinity F90+", category: "vtol", envelope: { maxAltitudeM: 4500, maxSpeedMps: 17, maxFlightMinutes: 90, motorCount: 5 }, capabilities: { rtk: true, waypointMission: true } },
      { name: "Vector", category: "vtol", envelope: { maxAltitudeM: 4500, maxSpeedMps: 18, maxFlightMinutes: 120, motorCount: 5 }, capabilities: { rtk: true, thermal: true, zoomCamera: true, waypointMission: true } },
      { name: "Reliant", category: "vtol", envelope: { maxAltitudeM: 4500, maxSpeedMps: 25, maxFlightMinutes: 120, motorCount: 5 }, capabilities: { rtk: true, lidar: true, waypointMission: true } },
    ],
  },
  {
    name: "Teal",
    models: [
      { name: "Teal 2", category: "military", envelope: { maxAltitudeM: 4000, maxSpeedMps: 22, maxFlightMinutes: 30, motorCount: 4 }, capabilities: { thermal: true, obstacleAvoidance: true, waypointMission: true } },
      { name: "Black Widow", category: "military", envelope: { maxAltitudeM: 4000, maxSpeedMps: 22, maxFlightMinutes: 30, motorCount: 4 }, capabilities: { thermal: true, obstacleAvoidance: true, swarm: true } },
      { name: "Golden Eagle", category: "military", envelope: { maxAltitudeM: 5000, maxSpeedMps: 25, maxFlightMinutes: 50, motorCount: 4 }, capabilities: { thermal: true, zoomCamera: true, swarm: true } },
    ],
  },
  {
    name: "BRINC",
    models: [
      { name: "Lemur 2", category: "enterprise", envelope: { maxAltitudeM: 1500, maxSpeedMps: 11, maxFlightMinutes: 31, motorCount: 4 }, capabilities: { thermal: true, spotlight: true, speaker: true, obstacleAvoidance: true } },
      { name: "Responder", category: "enterprise", envelope: { maxAltitudeM: 3000, maxSpeedMps: 20, maxFlightMinutes: 55, motorCount: 4 }, capabilities: { thermal: true, zoomCamera: true, spotlight: true, speaker: true, waypointMission: true } },
    ],
  },
  {
    name: "Anduril",
    models: [
      { name: "Anvil", category: "military", envelope: { maxAltitudeM: 4500, maxSpeedMps: 45, maxFlightMinutes: 50, motorCount: 4 }, capabilities: { thermal: true, swarm: true, obstacleAvoidance: true } },
      { name: "Altius 600", category: "military", envelope: { maxAltitudeM: 7600, maxSpeedMps: 38, maxFlightMinutes: 240, motorCount: 1 }, capabilities: { thermal: true, swarm: true, waypointMission: true } },
      { name: "Ghost 4", category: "military", envelope: { maxAltitudeM: 6000, maxSpeedMps: 31, maxFlightMinutes: 100, motorCount: 4 }, capabilities: { thermal: true, zoomCamera: true, swarm: true, waypointMission: true } },
    ],
  },
  {
    name: "AeroVironment",
    models: [
      { name: "Puma 3 AE", category: "military", envelope: { maxAltitudeM: 4500, maxSpeedMps: 23, maxFlightMinutes: 165, motorCount: 1 }, capabilities: { thermal: true, zoomCamera: true, waypointMission: true } },
      { name: "Quantix Recon", category: "vtol", envelope: { maxAltitudeM: 3000, maxSpeedMps: 19, maxFlightMinutes: 45, motorCount: 4 }, capabilities: { multispectral: true, waypointMission: true } },
      { name: "JUMP 20", category: "vtol", envelope: { maxAltitudeM: 4500, maxSpeedMps: 50, maxFlightMinutes: 840, motorCount: 5 }, capabilities: { thermal: true, zoomCamera: true, waypointMission: true } },
      { name: "Switchblade 300", category: "military", envelope: { maxAltitudeM: 4500, maxSpeedMps: 45, maxFlightMinutes: 15, motorCount: 1 } },
    ],
  },
  {
    name: "Insitu / Boeing",
    models: [
      { name: "ScanEagle", category: "military", envelope: { maxAltitudeM: 5800, maxSpeedMps: 41, maxFlightMinutes: 1440, motorCount: 1 }, capabilities: { thermal: true, zoomCamera: true, waypointMission: true } },
      { name: "Integrator", category: "military", envelope: { maxAltitudeM: 6400, maxSpeedMps: 41, maxFlightMinutes: 1320, motorCount: 1 }, capabilities: { thermal: true, zoomCamera: true, lidar: true, waypointMission: true } },
    ],
  },
  {
    name: "Inspired Flight",
    models: [
      { name: "IF800 Tomcat", category: "heavy-lift", envelope: { maxAltitudeM: 4500, maxSpeedMps: 26, maxFlightMinutes: 50, maxPayloadKg: 6.8, motorCount: 6 }, capabilities: { rtk: true, lidar: true, cargo: true, waypointMission: true } },
      { name: "IF1200A", category: "heavy-lift", envelope: { maxAltitudeM: 4500, maxSpeedMps: 23, maxFlightMinutes: 60, maxPayloadKg: 14, motorCount: 6 }, capabilities: { rtk: true, lidar: true, cargo: true, waypointMission: true, parachute: true } },
    ],
  },
  {
    name: "Watts Innovations",
    models: [
      { name: "Prism Sky", category: "heavy-lift", envelope: { maxAltitudeM: 5000, maxSpeedMps: 22, maxFlightMinutes: 45, maxPayloadKg: 6.8, motorCount: 8 }, capabilities: { rtk: true, cargo: true, lidar: true, waypointMission: true } },
    ],
  },
  {
    name: "Acecore",
    models: [
      { name: "Zoe", category: "heavy-lift", envelope: { maxAltitudeM: 5000, maxSpeedMps: 22, maxFlightMinutes: 40, maxPayloadKg: 8, motorCount: 8 }, capabilities: { rtk: true, cargo: true } },
      { name: "Neo X8", category: "heavy-lift", envelope: { maxAltitudeM: 5000, maxSpeedMps: 26, maxFlightMinutes: 50, maxPayloadKg: 15, motorCount: 8 }, capabilities: { rtk: true, cargo: true, waypointMission: true } },
      { name: "Noa", category: "heavy-lift", envelope: { maxAltitudeM: 5500, maxSpeedMps: 30, maxFlightMinutes: 70, maxPayloadKg: 25, motorCount: 8 }, capabilities: { rtk: true, cargo: true, waypointMission: true, parachute: true } },
    ],
  },
  {
    name: "Skyfront",
    models: [
      { name: "Perimeter 8", category: "heavy-lift", envelope: { maxAltitudeM: 6000, maxSpeedMps: 26, maxFlightMinutes: 300, maxPayloadKg: 4.5, motorCount: 8 }, capabilities: { thermal: true, lidar: true, waypointMission: true } },
    ],
  },
  {
    name: "Holy Stone",
    models: [
      { name: "HS720E", category: "consumer", envelope: { maxAltitudeM: 120, maxSpeedMps: 16, maxFlightMinutes: 26, motorCount: 4 } },
      { name: "HS900", category: "consumer", envelope: { maxAltitudeM: 120, maxSpeedMps: 18, maxFlightMinutes: 35, motorCount: 4 } },
    ],
  },
  {
    name: "Hubsan",
    models: [
      { name: "Zino Mini Pro", category: "consumer", envelope: { maxAltitudeM: 500, maxSpeedMps: 16, maxFlightMinutes: 40, motorCount: 4 } },
      { name: "Zino 2+", category: "consumer", envelope: { maxAltitudeM: 500, maxSpeedMps: 22, maxFlightMinutes: 35, motorCount: 4 } },
    ],
  },
  {
    name: "Potensic",
    models: [
      { name: "Atom SE", category: "consumer", envelope: { maxAltitudeM: 1000, maxSpeedMps: 16, maxFlightMinutes: 31, motorCount: 4 } },
      { name: "Atom 2", category: "consumer", envelope: { maxAltitudeM: 1000, maxSpeedMps: 16, maxFlightMinutes: 32, motorCount: 4 } },
    ],
  },
  {
    name: "Other / Custom",
    models: [
      { name: "Custom build", category: "fpv" },
      { name: "Custom heavy-lift", category: "heavy-lift", capabilities: { cargo: true, waypointMission: true } },
      { name: "Custom VTOL", category: "vtol", capabilities: { waypointMission: true } },
      { name: "Custom survey rig", category: "survey", capabilities: { rtk: true, lidar: true, waypointMission: true } },
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

/** Look up a model by full label like "DJI Matrice 350 RTK". */
export function findModel(label: string | null | undefined): DroneModel | null {
  if (!label) return null;
  const parsed = parseEquipmentString(label);
  if (!parsed) return null;
  return getModelsFor(parsed.manufacturer).find((m) => m.name === parsed.model) ?? null;
}

/** Capability flags for a drone model label. */
export function capabilitiesFor(label: string | null | undefined): NonNullable<DroneModel["capabilities"]> {
  return findModel(label)?.capabilities ?? {};
}

/** Operating envelope for a drone model label. */
export function envelopeFor(label: string | null | undefined): NonNullable<DroneModel["envelope"]> {
  return findModel(label)?.envelope ?? {};
}
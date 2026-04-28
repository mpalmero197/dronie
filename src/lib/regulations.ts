export type RegulationCategory =
  | "us-faa"
  | "international"
  | "airspace-weather"
  | "privacy-safety"
  | "books";

export interface RegulationLink {
  label: string;
  href: string;
  description: string;
  category: RegulationCategory;
  region?: string;
}

export const REGULATION_LINKS: RegulationLink[] = [
  // ── United States · FAA ───────────────────────────────────────────────
  {
    label: "FAA Part 107 — Small UAS Rule",
    href: "https://www.faa.gov/uas/commercial_operators",
    description: "Operating rules for commercial drone pilots in the United States.",
    category: "us-faa",
    region: "USA",
  },
  {
    label: "FAA Recreational Flyer Rules",
    href: "https://www.faa.gov/uas/recreational_flyers",
    description: "TRUST test, registration, and recreational operating limits.",
    category: "us-faa",
    region: "USA",
  },
  {
    label: "FAA DroneZone — Registration & Waivers",
    href: "https://faadronezone-access.faa.gov/",
    description: "Register your aircraft, request airspace waivers, and file accident reports.",
    category: "us-faa",
    region: "USA",
  },
  {
    label: "Remote ID Rule (Part 89)",
    href: "https://www.faa.gov/uas/getting_started/remote_id",
    description: "Broadcast identification and location requirements for most UAS.",
    category: "us-faa",
    region: "USA",
  },
  {
    label: "B4UFLY App",
    href: "https://www.faa.gov/uas/getting_started/b4ufly",
    description: "Official FAA app for checking airspace restrictions before flight.",
    category: "us-faa",
    region: "USA",
  },

  // ── International ──────────────────────────────────────────────────────
  {
    label: "EASA — EU Drone Regulations",
    href: "https://www.easa.europa.eu/en/domains/civil-drones",
    description: "Open, Specific, and Certified categories across the European Union.",
    category: "international",
    region: "EU",
  },
  {
    label: "UK CAA — Drone & Model Aircraft Code",
    href: "https://register-drones.caa.co.uk/drone-code",
    description: "Operator ID, flyer ID, and the UK Drone Code.",
    category: "international",
    region: "UK",
  },
  {
    label: "Transport Canada — RPAS Rules",
    href: "https://tc.canada.ca/en/aviation/drone-safety",
    description: "Basic & advanced operations, pilot certificates, and registration.",
    category: "international",
    region: "Canada",
  },
  {
    label: "CASA — Australian Drone Rules",
    href: "https://www.casa.gov.au/drones",
    description: "Recreational and commercial remotely piloted aircraft regulations.",
    category: "international",
    region: "Australia",
  },
  {
    label: "ICAO — Unmanned Aircraft Systems",
    href: "https://www.icao.int/safety/UA/Pages/default.aspx",
    description: "International civil aviation standards for UAS operations.",
    category: "international",
    region: "Global",
  },

  // ── Airspace & Weather ────────────────────────────────────────────────
  {
    label: "LAANC Authorization",
    href: "https://www.faa.gov/uas/getting_started/laanc",
    description: "Near real-time airspace authorizations in controlled airspace.",
    category: "airspace-weather",
  },
  {
    label: "TFR Lookup (FAA)",
    href: "https://tfr.faa.gov/tfr2/list.html",
    description: "Active Temporary Flight Restrictions in U.S. airspace.",
    category: "airspace-weather",
  },
  {
    label: "Aviation Weather Center",
    href: "https://www.aviationweather.gov/",
    description: "METARs, TAFs, winds aloft and other pre-flight weather products.",
    category: "airspace-weather",
  },
  {
    label: "SkyVector Sectional Charts",
    href: "https://skyvector.com/",
    description: "Free interactive aeronautical charts for flight planning.",
    category: "airspace-weather",
  },

  // ── Privacy & Safety ──────────────────────────────────────────────────
  {
    label: "AMA Drone Safety Code",
    href: "https://www.modelaircraft.org/safety",
    description: "Academy of Model Aeronautics safety standards for hobby flight.",
    category: "privacy-safety",
  },
  {
    label: "NIST Privacy Framework",
    href: "https://www.nist.gov/privacy-framework",
    description: "Best practices for handling imagery and location data responsibly.",
    category: "privacy-safety",
  },

  // ── Books & Further Reading ──────────────────────────────────────────
  {
    label: "Drone Photography & Operations Field Guide",
    href: "https://amzn.to/4cCG9m6",
    description: "Practical handbook by the Dronie team — available on Amazon.",
    category: "books",
  },
];

export const REGULATION_CATEGORIES: { id: RegulationCategory; label: string; blurb: string }[] = [
  { id: "us-faa", label: "United States · FAA", blurb: "Federal rules every U.S. operator must know." },
  { id: "international", label: "International", blurb: "Civil aviation authorities around the world." },
  { id: "airspace-weather", label: "Airspace & Weather", blurb: "Pre-flight planning tools and authorizations." },
  { id: "privacy-safety", label: "Privacy & Safety", blurb: "Operate responsibly and protect bystanders." },
  { id: "books", label: "Books & Reading", blurb: "Recommended deep-dives from our team." },
];
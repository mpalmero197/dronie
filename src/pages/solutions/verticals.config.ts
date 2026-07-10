import {
  Building2,
  Home,
  Sprout,
  Zap as ZapIcon,
  Mountain,
  ShieldCheck,
  Siren,
  Droplets,
  Bug,
  Clapperboard,
  RadioTower,
  type LucideIcon,
} from "lucide-react";
import type { IndustryVertical } from "@/lib/marketplace";

export interface VerticalConfig {
  slug: IndustryVertical;
  name: string;
  tagline: string;
  headline: string;
  intro: string;
  icon: LucideIcon;
  accent: string;
  valueProps: { title: string; desc: string }[];
  deliverables: string[];
  exampleClients: string;
}

export const VERTICALS: Record<string, VerticalConfig> = {
  construction: {
    slug: "construction",
    name: "Construction",
    tagline: "Track every cubic metre of progress",
    headline: "Site intelligence from rotor to ledger",
    intro:
      "Weekly orthos, volumetrics, and BIM-ready exports for project managers, GCs, and surveyors.",
    icon: Building2,
    accent: "from-amber-500/20 to-amber-500/5",
    valueProps: [
      { title: "Progress orthomosaics", desc: "Weekly stitched maps overlaid against your site plan." },
      { title: "Stockpile volumetrics", desc: "Calculate cut/fill and material volumes in cubic metres." },
      { title: "BIM & CAD exports", desc: "GeoTIFF, LAS/LAZ, DXF contours that drop into AutoCAD and Revit." },
      { title: "As-built docs", desc: "Time-stamped deliverables ready for inspectors and lenders." },
    ],
    deliverables: ["Orthomosaic", "DSM/DTM", "Volumetrics", "Contour lines", "3D point cloud"],
    exampleClients: "GCs, surveyors, project managers, site supers",
  },
  real_estate: {
    slug: "real_estate",
    name: "Real Estate",
    tagline: "Listings that fly off the page",
    headline: "Aerial media that closes deals",
    intro:
      "Cinematic stills, video, and immersive 3D walkthroughs for residential, commercial, and land listings.",
    icon: Home,
    accent: "from-sky-500/20 to-sky-500/5",
    valueProps: [
      { title: "Cinematic photo + video", desc: "MLS-ready stills and 60-second highlight reels." },
      { title: "Gaussian splat walkthroughs", desc: "Photorealistic 3D scenes prospects can explore in-browser." },
      { title: "Property line overlays", desc: "Annotated parcel maps that show the full lot." },
      { title: "Branded portfolio site", desc: "Every pilot gets a public showcase at dronieapp.com/u/your-name." },
    ],
    deliverables: ["Aerial photos", "Aerial video", "3D scene", "Parcel overlay"],
    exampleClients: "Realtors, brokerages, developers, AirBnB hosts",
  },
  agriculture: {
    slug: "agriculture",
    name: "Agriculture",
    tagline: "See your fields like never before",
    headline: "Precision ag from canopy to root zone",
    intro:
      "NDVI, crop health maps, and field boundary analytics that drive yield decisions.",
    icon: Sprout,
    accent: "from-emerald-500/20 to-emerald-500/5",
    valueProps: [
      { title: "NDVI & vegetation indices", desc: "Multispectral processing for crop stress detection." },
      { title: "Field boundary mapping", desc: "Accurate acreage and zonal stats per field." },
      { title: "Irrigation insights", desc: "Spot dry zones, leaks, and over-watering early." },
      { title: "Season-over-season tracking", desc: "Compare captures across the growing year." },
    ],
    deliverables: ["NDVI map", "Orthomosaic", "Field boundaries", "Plant count"],
    exampleClients: "Farmers, agronomists, co-ops, ag consultants",
  },
  energy: {
    slug: "energy",
    name: "Energy & Utilities",
    tagline: "Inspect without climbing",
    headline: "Asset inspection at fleet scale",
    intro:
      "AI-assisted inspections of solar farms, wind turbines, transmission lines, and substations.",
    icon: ZapIcon,
    accent: "from-yellow-500/20 to-yellow-500/5",
    valueProps: [
      { title: "Defect heatmaps", desc: "Auto-flagged hotspots, cracks, and shading on solar arrays." },
      { title: "Tower & blade inspection", desc: "High-resolution capture with no shutdown required." },
      { title: "Powerline corridor mapping", desc: "Vegetation encroachment and right-of-way reporting." },
      { title: "Audit-ready PDFs", desc: "One-click reports for compliance and asset owners." },
    ],
    deliverables: ["Inspection report", "Thermal imagery", "3D model", "Defect map"],
    exampleClients: "Utilities, solar O&M, wind farm operators, asset managers",
  },
  mining: {
    slug: "mining",
    name: "Mining & Aggregates",
    tagline: "Volumes you can take to the bank",
    headline: "Stockpile and pit intelligence",
    intro:
      "Monthly volumetric surveys, haul-road monitoring, and reserve estimation.",
    icon: Mountain,
    accent: "from-orange-500/20 to-orange-500/5",
    valueProps: [
      { title: "Stockpile volumetrics", desc: "Cubic metre accuracy, cross-validated against ground truth." },
      { title: "Pit progression", desc: "Track bench advance and reserve depletion over time." },
      { title: "Haul-road safety", desc: "Slope and surface monitoring for operational safety." },
      { title: "Drone-as-surveyor", desc: "Cut survey turnaround from weeks to days." },
    ],
    deliverables: ["Volumetrics", "DSM", "Orthomosaic", "Cut/fill report"],
    exampleClients: "Quarries, aggregate producers, mine operators, surveyors",
  },
  insurance: {
    slug: "insurance",
    name: "Insurance",
    tagline: "Claims, settled faster",
    headline: "Roof and property assessments without ladders",
    intro:
      "Rapid post-event captures and AI defect detection for adjusters and underwriters.",
    icon: ShieldCheck,
    accent: "from-blue-500/20 to-blue-500/5",
    valueProps: [
      { title: "Roof condition reports", desc: "Pitch, area, and damage classification in one PDF." },
      { title: "Catastrophe response", desc: "Rapid deployment of pilots after storms and wildfires." },
      { title: "Underwriting surveys", desc: "Pre-bind property captures for risk assessment." },
      { title: "AI damage detection", desc: "Auto-flagged hail, wind, and impact damage." },
    ],
    deliverables: ["Roof report", "Aerial photos", "3D model", "Damage map"],
    exampleClients: "Adjusters, underwriters, restoration contractors, TPA's",
  },
  government: {
    slug: "government",
    name: "Government & Public Safety",
    tagline: "Eyes in the sky for first responders",
    headline: "Compliance-grade aerial intelligence",
    intro:
      "Search & rescue, emergency mapping, and municipal asset surveys with full audit trails.",
    icon: Siren,
    accent: "from-red-500/20 to-red-500/5",
    valueProps: [
      { title: "Search & rescue", desc: "Rapid deployment, thermal imaging, live ground link." },
      { title: "Emergency mapping", desc: "Post-incident orthos for damage assessment." },
      { title: "Part 107 + LAANC", desc: "Every flight logged with airspace clearance." },
      { title: "Audit trails", desc: "Encrypted flight logs, pilot certs, and chain of custody." },
    ],
    deliverables: ["Orthomosaic", "Thermal map", "3D scene", "Incident report"],
    exampleClients: "Cities, counties, fire/police, emergency management",
  },
  power_washing: {
    slug: "power_washing" as any,
    name: "Power Washing & Exterior Cleaning",
    tagline: "Soft-wash from the sky, no ladders required",
    headline: "Drone-delivered exterior cleaning",
    intro:
      "Tethered spray drones and aerial inspection for roofs, façades, and solar arrays — no boom lifts, no ladder days lost to weather.",
    icon: Droplets,
    accent: "from-cyan-500/20 to-cyan-500/5",
    valueProps: [
      { title: "Roof soft-wash missions", desc: "Low-pressure biocide application that lifts algae and moss without damaging shingles." },
      { title: "Solar panel rinse", desc: "Restore lost yield with deionized-water washes flown on a repeatable grid pattern." },
      { title: "Multi-story façade cleaning", desc: "Reach 200+ ft on commercial buildings without scaffolding or lift permits." },
      { title: "Before/after proof reports", desc: "Aerial photo pairs and coverage maps clients can share with owners and HOAs." },
    ],
    deliverables: ["Before/after photos", "Coverage map", "3D façade scan", "Cleaning report PDF"],
    exampleClients: "Roofing contractors, solar O&M, HOAs, commercial property managers",
  },
  pest_control: {
    slug: "pest_control" as any,
    name: "Pest Control & Spraying",
    tagline: "Targeted spraying without the tractor",
    headline: "Precision pest and vegetation control from the air",
    intro:
      "Spray drones apply herbicide, insecticide, and mosquito adulticide exactly where needed — using NDVI and thermal data to skip healthy zones and cut chemical use.",
    icon: Bug,
    accent: "from-lime-500/20 to-lime-500/5",
    valueProps: [
      { title: "Spot-spray by prescription", desc: "Fly variable-rate zones from an NDVI map instead of blanket spraying the whole field." },
      { title: "Mosquito & vector control", desc: "Cover wetlands and standing water that ground crews can't safely access." },
      { title: "Invasive species knockdown", desc: "Target kudzu, phragmites, and hemlock on steep terrain and utility corridors." },
      { title: "Application records", desc: "Auto-logged flight paths, chemical used, and gallons per acre for regulator sign-off." },
    ],
    deliverables: ["Prescription map", "As-applied log", "NDVI baseline", "Compliance PDF"],
    exampleClients: "Ag co-ops, vector control districts, foresters, utility ROW managers",
  },
  film_events: {
    slug: "film_events" as any,
    name: "Film, Events & Weddings",
    tagline: "Cinematic aerials, delivered same-day",
    headline: "Broadcast-grade drone cinematography",
    intro:
      "FPV chase shots, sweeping establishing pulls, and multi-cam event coverage from Part 107 pilots insured for crowds and closed sets.",
    icon: Clapperboard,
    accent: "from-rose-500/20 to-rose-500/5",
    valueProps: [
      { title: "Cinema-grade capture", desc: "Inspire 3, Mavic 3 Cine, and custom FPV rigs shooting 5.1K ProRes." },
      { title: "Crowd-rated insurance", desc: "$5M+ liability and OOP waivers for weddings, festivals, and stadium events." },
      { title: "Same-day highlight reel", desc: "60-second social cut delivered within 24 hours, full edit within a week." },
      { title: "Multi-cam sync", desc: "Timecode-locked with ground cameras so aerials cut seamlessly into your edit." },
    ],
    deliverables: ["Highlight reel", "Raw 5.1K footage", "Aerial stills", "Vertical social cut"],
    exampleClients: "Wedding planners, film production, sports broadcasters, event agencies",
  },
  telecom: {
    slug: "telecom" as any,
    name: "Telecom & Tower Inspection",
    tagline: "Tower climbs, replaced by drones",
    headline: "Cell tower and antenna inspection without a climb",
    intro:
      "Close-visual and thermal inspections of monopoles, lattice towers, and rooftop sites — faster, safer, and OSHA-friendly.",
    icon: RadioTower,
    accent: "from-violet-500/20 to-violet-500/5",
    valueProps: [
      { title: "No-climb close visual", desc: "Sub-centimetre imagery of connectors, mounts, and antenna azimuths." },
      { title: "3D digital twin", desc: "Photogrammetric model of the full structure for engineering and colocation studies." },
      { title: "Thermal & RF hotspots", desc: "Spot failing amplifiers, loose connectors, and heat anomalies mid-flight." },
      { title: "Turnkey reports", desc: "Standardized carrier-ready PDFs with defect grading and photo evidence." },
    ],
    deliverables: ["Inspection PDF", "3D tower model", "Thermal imagery", "Azimuth report"],
    exampleClients: "Carriers, tower cos, NOC teams, colocation engineers",
  },
};

export const VERTICAL_LIST = Object.values(VERTICALS).filter((v) => v.slug !== "other");
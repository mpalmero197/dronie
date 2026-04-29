import {
  Building2,
  Home,
  Sprout,
  Zap as ZapIcon,
  Mountain,
  ShieldCheck,
  Siren,
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
};

export const VERTICAL_LIST = Object.values(VERTICALS).filter((v) => v.slug !== "other");
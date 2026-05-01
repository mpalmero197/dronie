import { supabase } from "@/integrations/supabase/client";

export type IndustryVertical =
  | "construction"
  | "real_estate"
  | "agriculture"
  | "energy"
  | "mining"
  | "insurance"
  | "government"
  | "other";

export type RequestStatus =
  | "open"
  | "quoted"
  | "assigned"
  | "in_progress"
  | "delivered"
  | "closed";

export type QuoteStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export const VERTICAL_LABELS: Record<IndustryVertical, string> = {
  construction: "Construction",
  real_estate: "Real Estate",
  agriculture: "Agriculture",
  energy: "Energy & Utilities",
  mining: "Mining",
  insurance: "Insurance",
  government: "Government & Public Safety",
  other: "Other",
};

export const DELIVERABLE_OPTIONS = [
  // Mapping & Survey
  { id: "ortho", label: "Orthomosaic Map", category: "Mapping & Survey" },
  { id: "dsm", label: "DSM / DTM", category: "Mapping & Survey" },
  { id: "pointcloud", label: "3D Point Cloud", category: "Mapping & Survey" },
  { id: "contour", label: "Contour Lines", category: "Mapping & Survey" },
  { id: "topo", label: "Topographic Survey", category: "Mapping & Survey" },
  { id: "gis", label: "GIS Layers (SHP / GeoJSON)", category: "Mapping & Survey" },
  { id: "gcp_survey", label: "Ground Control Point Survey", category: "Mapping & Survey" },
  { id: "lidar", label: "LiDAR Point Cloud", category: "Mapping & Survey" },
  { id: "dem", label: "Digital Elevation Model (DEM)", category: "Mapping & Survey" },
  { id: "mapping_kml", label: "KML / KMZ Flight Data", category: "Mapping & Survey" },
  // 3D & Visualization
  { id: "mesh", label: "3D Textured Mesh", category: "3D & Visualization" },
  { id: "splat", label: "Gaussian Splat / 3D Scene", category: "3D & Visualization" },
  { id: "cad", label: "CAD / DWG / DXF Export", category: "3D & Visualization" },
  { id: "bim", label: "BIM-Ready Model (IFC / RVT)", category: "3D & Visualization" },
  { id: "virtual_tour", label: "360° Virtual Tour", category: "3D & Visualization" },
  { id: "flythrough", label: "3D Flythrough Animation", category: "3D & Visualization" },
  // Construction & Engineering
  { id: "cutfill", label: "Cut & Fill / Stockpile Volumes", category: "Construction & Engineering" },
  { id: "volumetric", label: "Volumetric Analysis", category: "Construction & Engineering" },
  { id: "progress", label: "Construction Progress Report", category: "Construction & Engineering" },
  { id: "asbuilt", label: "As-Built Documentation", category: "Construction & Engineering" },
  { id: "grade_cert", label: "Grade Certification", category: "Construction & Engineering" },
  { id: "floor_plan", label: "Floor Plan / Site Plan", category: "Construction & Engineering" },
  // Inspection
  { id: "inspection", label: "Inspection Report", category: "Inspection" },
  { id: "roof", label: "Roof / Facade Inspection", category: "Inspection" },
  { id: "tower", label: "Tower / Antenna Inspection", category: "Inspection" },
  { id: "solar", label: "Solar Panel Inspection", category: "Inspection" },
  { id: "powerline", label: "Power Line / Utility Inspection", category: "Inspection" },
  { id: "bridge", label: "Bridge / Infrastructure Inspection", category: "Inspection" },
  { id: "flare_stack", label: "Flare Stack / Chimney Inspection", category: "Inspection" },
  // Specialty Imaging
  { id: "thermal", label: "Thermal / Infrared Imagery", category: "Specialty Imaging" },
  { id: "multispectral", label: "Multispectral / NDVI", category: "Specialty Imaging" },
  { id: "crop_health", label: "Crop Health Map", category: "Specialty Imaging" },
  { id: "water_stress", label: "Water Stress Analysis", category: "Specialty Imaging" },
  { id: "environmental", label: "Environmental Assessment", category: "Specialty Imaging" },
  // Photo & Video
  { id: "photo", label: "Aerial Photography", category: "Photo & Video" },
  { id: "video", label: "Aerial Video", category: "Photo & Video" },
  { id: "marketing", label: "Marketing Photo / Video Package", category: "Photo & Video" },
  { id: "fpv", label: "FPV / Cinematic Footage", category: "Photo & Video" },
  { id: "twilight", label: "Twilight / Golden Hour Shoot", category: "Photo & Video" },
  { id: "event", label: "Event / Live Coverage", category: "Photo & Video" },
  { id: "raw", label: "Raw Imagery (RAW / DNG)", category: "Photo & Video" },
];

export interface ServiceRequest {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  vertical: IndustryVertical;
  deliverables: string[];
  location_label: string | null;
  latitude: number | null;
  longitude: number | null;
  budget_cents: number | null;
  deadline: string | null;
  status: RequestStatus;
  assigned_pilot_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceQuote {
  id: string;
  request_id: string;
  pilot_id: string;
  price_cents: number;
  eta_days: number | null;
  message: string | null;
  status: QuoteStatus;
  created_at: string;
  updated_at: string;
}

export function formatBudget(cents: number | null): string {
  if (!cents) return "Open budget";
  return `$${(cents / 100).toLocaleString()}`;
}

export async function listOpenRequests(filters?: {
  vertical?: IndustryVertical;
}) {
  let q = supabase
    .from("service_requests")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filters?.vertical) q = q.eq("vertical", filters.vertical);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ServiceRequest[];
}

export async function getRequest(id: string) {
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as ServiceRequest | null;
}

export async function listQuotesForRequest(requestId: string) {
  const { data, error } = await supabase
    .from("service_quotes")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ServiceQuote[];
}

export async function listMyRequests(userId: string) {
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("client_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ServiceRequest[];
}

export async function listMyQuotes(userId: string) {
  const { data, error } = await supabase
    .from("service_quotes")
    .select("*, service_requests(*)")
    .eq("pilot_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
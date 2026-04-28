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
  { id: "ortho", label: "Orthomosaic Map" },
  { id: "dsm", label: "DSM / DTM" },
  { id: "pointcloud", label: "3D Point Cloud" },
  { id: "contour", label: "Contour Lines" },
  { id: "splat", label: "Gaussian Splat / 3D Scene" },
  { id: "photo", label: "Aerial Photography" },
  { id: "video", label: "Aerial Video" },
  { id: "inspection", label: "Inspection Report" },
  { id: "volumetric", label: "Volumetric Analysis" },
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
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type AdspServiceKind =
  | "strategic_deconfliction"
  | "conformance_monitoring"
  | "terrain_obstacle"
  | "aeronautical_data"
  | "weather"
  | "flight_planning_support";

export type AdspServiceStatus = "operational" | "degraded" | "maintenance" | "offline";
export type AdspIncidentSeverity = "low" | "medium" | "high" | "critical";
export type FlightIntentStatus = "planned" | "active" | "completed" | "cancelled";

export interface AdspService {
  id: string;
  kind: AdspServiceKind;
  name: string;
  description: string;
  source: string;
  data_sources: string[];
  performance_criteria: Record<string, number | string>;
  limitations: string[];
  update_frequency: string | null;
  coverage: string | null;
  status: AdspServiceStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AdspSubscription {
  id: string;
  user_id: string;
  service_id: string;
  drone_id: string | null;
  enabled: boolean;
  accepted_limitations_at: string | null;
}

export interface LatLng { lat: number; lng: number }

export interface FlightIntent {
  id: string;
  user_id: string;
  plan_id: string | null;
  project_id: string | null;
  job_id: string | null;
  name: string;
  polygon: LatLng[];
  min_alt_agl_m: number;
  max_alt_agl_m: number;
  start_time: string;
  end_time: string;
  status: FlightIntentStatus;
  shared: boolean;
  created_at: string;
}

export interface DeconflictionConflict {
  intent_id: string;
  name: string;
  own_operation: boolean;
  lateral: string;
  separation_m: number;
  altitude_overlap: boolean;
  altitude_band_m: [number, number];
  time_overlap_minutes: number;
  window: { start: string; end: string };
  severity: "low" | "medium" | "high";
}

export interface DeconflictionSuggestion {
  kind: string;
  label: string;
  start_time?: string;
  end_time?: string;
  max_alt_agl_m?: number;
  buffer_m?: number;
}

export interface DeconflictionResult {
  clear: boolean;
  conflicts: DeconflictionConflict[];
  suggestions: DeconflictionSuggestion[];
  checked: number;
  intent_id: string | null;
  latency_ms: number;
}

export interface AeroDataResult {
  terrain: {
    available: boolean;
    note?: string;
    samples?: number;
    min_elevation_m?: number;
    max_elevation_m?: number;
    relief_m?: number;
    min_safe_altitude_agl_m?: number;
    advisory?: string;
    source?: string;
  } | null;
  aeronautical: {
    available: boolean;
    tfr_count?: number;
    tfrs?: { notam: string | null; type: string | null; description: string | null; distance_km: number }[];
    advisory?: string;
    reminder?: string;
    source?: string;
  } | null;
  weather: {
    available: boolean;
    note?: string;
    current?: {
      temperature_c: number; wind_kph: number; gust_kph: number; wind_direction_deg: number;
      visibility_km: number; cloud_cover_pct: number; precipitation_mm: number;
    };
    go?: boolean;
    blockers?: string[];
    advisory?: string;
    source?: string;
    observed_at?: string | null;
  } | null;
  latency_ms: number;
}

export interface ConformanceEvent {
  id: string;
  intent_id: string | null;
  job_id: string | null;
  deviation_type: string;
  magnitude: number | null;
  unit: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude_m: number | null;
  detail: string | null;
  resolved: boolean;
  recorded_at: string;
}

export interface AdspServiceRecord {
  id: string;
  service_kind: AdspServiceKind;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  data_source: string | null;
  data_currency: string | null;
  latency_ms: number | null;
  ok: boolean;
  error: string | null;
  created_at: string;
}

export interface AdspIncident {
  id: string;
  service_kind: AdspServiceKind | null;
  severity: AdspIncidentSeverity;
  title: string;
  description: string;
  affected_users: number;
  root_cause: string | null;
  corrective_action: string | null;
  faa_notified: boolean;
  users_notified: boolean;
  started_at: string;
  resolved_at: string | null;
}

export interface AdspQmsDocument {
  id: string;
  title: string;
  doc_type: string;
  reference: string | null;
  summary: string | null;
  owner_name: string | null;
  document_url: string | null;
  version: string;
  effective_date: string | null;
  review_due: string | null;
}

export interface AdspPersonnel {
  id: string;
  full_name: string;
  role_title: string;
  responsibilities: string | null;
  training_completed: string[];
  competency_verified_at: string | null;
  next_review: string | null;
}

export interface AdspPerformanceSample {
  id: string;
  service_kind: AdspServiceKind;
  available: boolean;
  latency_ms: number | null;
  error_rate: number;
  data_currency_minutes: number | null;
  sampled_at: string;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const SERVICE_LABELS: Record<AdspServiceKind, string> = {
  strategic_deconfliction: "Strategic Deconfliction",
  conformance_monitoring: "Conformance Monitoring",
  terrain_obstacle: "Terrain & Obstacle Data",
  aeronautical_data: "Aeronautical Data",
  weather: "Weather Data",
  flight_planning_support: "Flight Planning Support",
};

export const STATUS_STYLES: Record<AdspServiceStatus, string> = {
  operational: "bg-primary/15 text-primary border-primary/25",
  degraded: "bg-accent/15 text-accent border-accent/25",
  maintenance: "bg-secondary text-muted-foreground border-border",
  offline: "bg-destructive/15 text-destructive border-destructive/25",
};

export const SEVERITY_STYLES: Record<AdspIncidentSeverity, string> = {
  low: "bg-secondary text-muted-foreground border-border",
  medium: "bg-accent/15 text-accent border-accent/25",
  high: "bg-destructive/10 text-destructive border-destructive/20",
  critical: "bg-destructive/20 text-destructive border-destructive/40",
};

/** Part 146 service families mapped to the obligations they satisfy. */
export const PART_146_OBLIGATIONS: { title: string; detail: string; reference: string }[] = [
  {
    title: "Declared service performance",
    detail: "Each automated data service publishes its performance criteria, data sources, update rate and known limitations.",
    reference: "Service declaration",
  },
  {
    title: "Quality management system",
    detail: "Documented procedures, review cycles and named owners covering how each service is produced and verified.",
    reference: "QMS records",
  },
  {
    title: "Personnel competency",
    detail: "Named accountable personnel with recorded training and periodic competency verification.",
    reference: "Personnel records",
  },
  {
    title: "Malfunction reporting",
    detail: "Service outages, degradations and erroneous data are logged with severity, affected users, root cause and corrective action.",
    reference: "Incident log",
  },
  {
    title: "Records retention",
    detail: "Every service output is stored with its inputs, source and data currency so any flight can be reconstructed.",
    reference: "Evidence trail",
  },
  {
    title: "User notification",
    detail: "Subscribers accept each service's limitations and are notified when performance degrades or a service is withdrawn.",
    reference: "Subscriptions",
  },
];

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

export const volumeSchema = z.object({
  name: z.string().trim().min(1, "Give the operation a name").max(160),
  min_alt_agl_m: z.coerce.number().min(0).max(3000),
  max_alt_agl_m: z.coerce.number().min(1).max(3000),
  start_time: z.string().min(1, "Start time required"),
  end_time: z.string().min(1, "End time required"),
  buffer_m: z.coerce.number().min(0).max(5000),
});

export const incidentSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(4000),
  severity: z.enum(["low", "medium", "high", "critical"]),
  service_kind: z.string().optional(),
  root_cause: z.string().trim().max(2000).optional().or(z.literal("")),
  corrective_action: z.string().trim().max(2000).optional().or(z.literal("")),
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const anyDb = supabase as unknown as {
  from: (table: string) => any;
  functions: { invoke: (name: string, opts?: { body?: unknown }) => Promise<{ data: any; error: any }> };
};

export async function listServices(): Promise<AdspService[]> {
  const { data, error } = await anyDb.from("adsp_services").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as AdspService[];
}

export async function listSubscriptions(userId: string): Promise<AdspSubscription[]> {
  const { data, error } = await anyDb
    .from("adsp_subscriptions").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as AdspSubscription[];
}

export async function setSubscription(userId: string, serviceId: string, enabled: boolean) {
  const { error } = await anyDb.from("adsp_subscriptions").upsert(
    {
      user_id: userId,
      service_id: serviceId,
      drone_id: null,
      enabled,
      accepted_limitations_at: enabled ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,service_id,drone_id" },
  );
  if (error) throw error;
}

export async function listPerformance(sinceDays = 30): Promise<AdspPerformanceSample[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
  const { data, error } = await anyDb
    .from("adsp_performance_samples")
    .select("*")
    .gte("sampled_at", since)
    .order("sampled_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as AdspPerformanceSample[];
}

export async function listServiceRecords(userId: string, limit = 100): Promise<AdspServiceRecord[]> {
  const { data, error } = await anyDb
    .from("adsp_service_records")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AdspServiceRecord[];
}

export async function listIntents(userId: string): Promise<FlightIntent[]> {
  const { data, error } = await anyDb
    .from("flight_intents")
    .select("*")
    .eq("user_id", userId)
    .order("start_time", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as FlightIntent[];
}

export async function updateIntent(id: string, patch: Partial<Pick<FlightIntent, "status" | "shared">>) {
  const { error } = await anyDb.from("flight_intents").update(patch).eq("id", id);
  if (error) throw error;
}

export async function listConformanceEvents(userId: string, limit = 50): Promise<ConformanceEvent[]> {
  const { data, error } = await anyDb
    .from("conformance_events")
    .select("*")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ConformanceEvent[];
}

export async function resolveConformanceEvent(id: string) {
  const { error } = await anyDb.from("conformance_events").update({ resolved: true }).eq("id", id);
  if (error) throw error;
}

export async function listIncidents(): Promise<AdspIncident[]> {
  const { data, error } = await anyDb
    .from("adsp_incidents").select("*").order("started_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as AdspIncident[];
}

export async function listQmsDocuments(): Promise<AdspQmsDocument[]> {
  const { data, error } = await anyDb
    .from("adsp_qms_documents").select("*").order("review_due", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AdspQmsDocument[];
}

export async function listPersonnel(): Promise<AdspPersonnel[]> {
  const { data, error } = await anyDb
    .from("adsp_personnel").select("*").order("role_title");
  if (error) throw error;
  return (data ?? []) as AdspPersonnel[];
}

export interface DeconflictRequest {
  name: string;
  polygon: LatLng[];
  min_alt_agl_m: number;
  max_alt_agl_m: number;
  start_time: string;
  end_time: string;
  buffer_m?: number;
  publish?: boolean;
  shared?: boolean;
  plan_id?: string | null;
  project_id?: string | null;
  job_id?: string | null;
}

export async function runDeconfliction(req: DeconflictRequest): Promise<DeconflictionResult> {
  const { data, error } = await anyDb.functions.invoke("adsp-deconflict", { body: req });
  if (error) throw new Error(readInvokeError(error, data));
  return data as DeconflictionResult;
}

export async function runAeroData(params: {
  polygon: LatLng[];
  services?: ("terrain_obstacle" | "aeronautical_data" | "weather")[];
  limits?: Partial<{ max_wind_kph: number; max_gust_kph: number; max_precip_pct: number; min_visibility_km: number; min_temp_c: number }>;
  plan_id?: string | null;
  project_id?: string | null;
}): Promise<AeroDataResult> {
  const { data, error } = await anyDb.functions.invoke("adsp-aero-data", { body: params });
  if (error) throw new Error(readInvokeError(error, data));
  return data as AeroDataResult;
}

export async function reportConformanceSample(params: {
  intent_id: string;
  job_id?: string | null;
  latitude: number;
  longitude: number;
  altitude_agl_m: number;
  recorded_at?: string;
}) {
  const { data, error } = await anyDb.functions.invoke("adsp-conformance", { body: params });
  if (error) throw new Error(readInvokeError(error, data));
  return data as {
    conforming: boolean;
    deviations: { deviation_type: string; magnitude: number; unit: string; detail: string }[];
    lateral_distance_m: number;
    inside_area: boolean;
  };
}

function readInvokeError(error: unknown, data: unknown): string {
  const fromData = (data as { message?: string; error?: string })?.message
    ?? (data as { error?: string })?.error;
  if (typeof fromData === "string") return fromData;
  const msg = (error as { message?: string })?.message;
  return msg || "Service request failed";
}

/** Aggregate performance samples into a per-service rollup. */
export function rollupPerformance(samples: AdspPerformanceSample[]) {
  const map = new Map<AdspServiceKind, { total: number; up: number; latencies: number[] }>();
  for (const s of samples) {
    const entry = map.get(s.service_kind) ?? { total: 0, up: 0, latencies: [] };
    entry.total += 1;
    if (s.available) entry.up += 1;
    if (typeof s.latency_ms === "number") entry.latencies.push(s.latency_ms);
    map.set(s.service_kind, entry);
  }
  return Array.from(map.entries()).map(([kind, v]) => {
    const sorted = [...v.latencies].sort((a, b) => a - b);
    const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : null;
    return {
      kind,
      samples: v.total,
      availability_pct: v.total ? (v.up / v.total) * 100 : 0,
      avg_latency_ms: v.latencies.length ? Math.round(v.latencies.reduce((a, b) => a + b, 0) / v.latencies.length) : null,
      p95_latency_ms: p95,
      error_rate_pct: v.total ? ((v.total - v.up) / v.total) * 100 : 0,
    };
  });
}

/** Export an evidence pack as CSV text. */
export function recordsToCsv(records: AdspServiceRecord[]) {
  const head = ["timestamp", "service", "data_source", "data_currency", "latency_ms", "ok", "error", "response"];
  const rows = records.map((r) => [
    r.created_at,
    SERVICE_LABELS[r.service_kind] ?? r.service_kind,
    r.data_source ?? "",
    r.data_currency ?? "",
    r.latency_ms ?? "",
    r.ok ? "yes" : "no",
    r.error ?? "",
    JSON.stringify(r.response ?? {}),
  ]);
  return [head, ...rows]
    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

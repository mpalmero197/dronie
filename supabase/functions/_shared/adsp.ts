// Shared helpers for the ADSP (14 CFR Part 146) edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { user: null, client: null, authHeader: null };
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { user: null, client: null, authHeader };
  return { user: data.user, client, authHeader };
}

export interface LatLng { lat: number; lng: number }

export function bbox(points: LatLng[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    min_lat: Math.min(...lats),
    max_lat: Math.max(...lats),
    min_lng: Math.min(...lngs),
    max_lng: Math.max(...lngs),
  };
}

export function centroid(points: LatLng[]): LatLng {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

export function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(pt: LatLng, poly: LatLng[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng, yi = poly[i].lat;
    const xj = poly[j].lng, yj = poly[j].lat;
    const intersect =
      yi > pt.lat !== yj > pt.lat &&
      pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Shortest distance in metres from a point to a polygon edge (0 when inside). */
export function distanceToPolygonM(pt: LatLng, poly: LatLng[]) {
  if (pointInPolygon(pt, poly)) return 0;
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    best = Math.min(best, segmentDistanceM(pt, poly[j], poly[i]));
  }
  return best;
}

function segmentDistanceM(p: LatLng, a: LatLng, b: LatLng) {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  const px = (p.lng - a.lng) * mPerDegLng;
  const py = (p.lat - a.lat) * mPerDegLat;
  const bx = (b.lng - a.lng) * mPerDegLng;
  const by = (b.lat - a.lat) * mPerDegLat;
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  const dx = px - bx * t;
  const dy = py - by * t;
  return Math.sqrt(dx * dx + dy * dy);
}

export function boxesOverlap(
  a: { min_lat: number; max_lat: number; min_lng: number; max_lng: number },
  b: { min_lat: number; max_lat: number; min_lng: number; max_lng: number },
) {
  return a.min_lat <= b.max_lat && a.max_lat >= b.min_lat && a.min_lng <= b.max_lng && a.max_lng >= b.min_lng;
}

/** Write an ADSP evidence record. Never throws. */
export async function recordService(params: {
  user_id: string;
  service_kind: string;
  request: unknown;
  response: unknown;
  data_source?: string;
  data_currency?: string | null;
  latency_ms?: number;
  ok?: boolean;
  error?: string | null;
  plan_id?: string | null;
  job_id?: string | null;
  project_id?: string | null;
}) {
  try {
    const admin = adminClient();
    await admin.from("adsp_service_records").insert({
      user_id: params.user_id,
      service_kind: params.service_kind,
      request: params.request ?? {},
      response: params.response ?? {},
      data_source: params.data_source ?? "internal",
      data_currency: params.data_currency ?? new Date().toISOString(),
      latency_ms: params.latency_ms ?? null,
      ok: params.ok ?? true,
      error: params.error ?? null,
      plan_id: params.plan_id ?? null,
      job_id: params.job_id ?? null,
      project_id: params.project_id ?? null,
    });
  } catch (e) {
    console.error("[adsp] recordService failed", e instanceof Error ? e.message : e);
  }
}

/** Write a performance sample. Never throws. */
export async function recordPerformance(kind: string, ok: boolean, latencyMs: number, currencyMinutes?: number) {
  try {
    const admin = adminClient();
    await admin.from("adsp_performance_samples").insert({
      service_kind: kind,
      available: ok,
      latency_ms: Math.round(latencyMs),
      error_rate: ok ? 0 : 1,
      data_currency_minutes: currencyMinutes ?? null,
    });
  } catch (e) {
    console.error("[adsp] recordPerformance failed", e instanceof Error ? e.message : e);
  }
}

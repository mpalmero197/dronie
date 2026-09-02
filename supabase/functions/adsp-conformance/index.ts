// ADSP — Conformance Monitoring service (14 CFR Part 146).
// Compares a live telemetry sample against the published operating volume.
import { z } from "https://esm.sh/zod@3.23.8";
import {
  adminClient, authenticate, corsHeaders, distanceToPolygonM, json,
  pointInPolygon, recordPerformance, recordService, type LatLng,
} from "../_shared/adsp.ts";

const BodySchema = z.object({
  intent_id: z.string().uuid(),
  job_id: z.string().uuid().nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude_agl_m: z.number().min(-100).max(10000),
  recorded_at: z.string().datetime().optional(),
  lateral_tolerance_m: z.number().min(0).max(1000).default(25),
  vertical_tolerance_m: z.number().min(0).max(300).default(8),
});

interface Deviation {
  deviation_type: string;
  magnitude: number;
  unit: string;
  detail: string;
}

function polyPoints(raw: unknown): LatLng[] {
  if (Array.isArray(raw)) return raw as LatLng[];
  const pts = (raw as { points?: LatLng[] })?.points;
  return Array.isArray(pts) ? pts : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const started = performance.now();

  const { user } = await authenticate(req);
  if (!user) return json(401, { error: "Unauthorized" });

  let raw: unknown;
  try { raw = await req.json(); } catch { return json(400, { error: "Invalid JSON body" }); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });
  const body = parsed.data;

  const admin = adminClient();
  const { data: intent } = await admin
    .from("flight_intents")
    .select("id,user_id,name,polygon,min_alt_agl_m,max_alt_agl_m,start_time,end_time,status")
    .eq("id", body.intent_id)
    .maybeSingle();

  if (!intent) return json(404, { error: "Flight intent not found" });
  if (intent.user_id !== user.id) return json(403, { error: "Not your operation" });

  const poly = polyPoints(intent.polygon);
  const pt: LatLng = { lat: body.latitude, lng: body.longitude };
  const recordedAt = body.recorded_at ?? new Date().toISOString();
  const deviations: Deviation[] = [];

  // Lateral conformance
  const inside = poly.length >= 3 ? pointInPolygon(pt, poly) : true;
  const distanceM = poly.length >= 3 ? Math.round(distanceToPolygonM(pt, poly)) : 0;
  if (!inside && distanceM > body.lateral_tolerance_m) {
    deviations.push({
      deviation_type: "lateral",
      magnitude: distanceM,
      unit: "m",
      detail: `Aircraft is ${distanceM} m outside the published operating area (tolerance ${body.lateral_tolerance_m} m).`,
    });
  }

  // Vertical conformance
  if (body.altitude_agl_m > Number(intent.max_alt_agl_m) + body.vertical_tolerance_m) {
    const over = Math.round(body.altitude_agl_m - Number(intent.max_alt_agl_m));
    deviations.push({
      deviation_type: "vertical_ceiling",
      magnitude: over,
      unit: "m",
      detail: `Aircraft is ${over} m above the published ceiling of ${intent.max_alt_agl_m} m AGL.`,
    });
  } else if (body.altitude_agl_m < Number(intent.min_alt_agl_m) - body.vertical_tolerance_m) {
    const under = Math.round(Number(intent.min_alt_agl_m) - body.altitude_agl_m);
    deviations.push({
      deviation_type: "vertical_floor",
      magnitude: under,
      unit: "m",
      detail: `Aircraft is ${under} m below the published floor of ${intent.min_alt_agl_m} m AGL.`,
    });
  }

  // Time conformance
  const now = Date.parse(recordedAt);
  if (now > Date.parse(intent.end_time)) {
    const over = Math.round((now - Date.parse(intent.end_time)) / 60000);
    deviations.push({
      deviation_type: "time_overrun",
      magnitude: over,
      unit: "min",
      detail: `Operation has run ${over} min past the published end time.`,
    });
  } else if (now < Date.parse(intent.start_time)) {
    const early = Math.round((Date.parse(intent.start_time) - now) / 60000);
    deviations.push({
      deviation_type: "early_start",
      magnitude: early,
      unit: "min",
      detail: `Operation started ${early} min before the published start time.`,
    });
  }

  if (deviations.length > 0) {
    await admin.from("conformance_events").insert(
      deviations.map((d) => ({
        user_id: user.id,
        intent_id: intent.id,
        job_id: body.job_id ?? null,
        deviation_type: d.deviation_type,
        magnitude: d.magnitude,
        unit: d.unit,
        latitude: body.latitude,
        longitude: body.longitude,
        altitude_m: body.altitude_agl_m,
        detail: d.detail,
        recorded_at: recordedAt,
      })),
    );

    await admin.rpc("create_notification", {
      _user_id: user.id,
      _kind: "conformance_alert",
      _title: "Conformance deviation detected",
      _body: deviations[0].detail,
      _link: "/adsp",
      _metadata: { intent_id: intent.id, deviations: deviations.map((d) => d.deviation_type) },
    });
  }

  const latency = Math.round(performance.now() - started);
  await recordService({
    user_id: user.id,
    service_kind: "conformance_monitoring",
    request: { intent_id: intent.id, position: [body.latitude, body.longitude], alt: body.altitude_agl_m },
    response: { conforming: deviations.length === 0, deviations },
    data_source: "Dronie telemetry stream",
    latency_ms: latency,
    job_id: body.job_id ?? null,
  });
  await recordPerformance("conformance_monitoring", true, latency, 0);

  return json(200, {
    conforming: deviations.length === 0,
    deviations,
    lateral_distance_m: distanceM,
    inside_area: inside,
    intent: { id: intent.id, name: intent.name, max_alt_agl_m: intent.max_alt_agl_m, end_time: intent.end_time },
  });
});

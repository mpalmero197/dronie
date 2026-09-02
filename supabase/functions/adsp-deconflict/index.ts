// ADSP — Strategic Deconfliction service (14 CFR Part 146).
// Checks a proposed operating volume against all shared flight intents.
import { z } from "https://esm.sh/zod@3.23.8";
import { requirePaid } from "../_shared/requirePaid.ts";
import {
  adminClient, authenticate, bbox, boxesOverlap, corsHeaders, distanceToPolygonM,
  json, pointInPolygon, recordPerformance, recordService, type LatLng,
} from "../_shared/adsp.ts";

const PointSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

const BodySchema = z.object({
  name: z.string().trim().min(1).max(160).default("Proposed operation"),
  polygon: z.array(PointSchema).min(3).max(500),
  min_alt_agl_m: z.number().min(0).max(3000).default(0),
  max_alt_agl_m: z.number().min(1).max(3000).default(121.92),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  plan_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  job_id: z.string().uuid().nullable().optional(),
  publish: z.boolean().default(false),
  shared: z.boolean().default(true),
  buffer_m: z.number().min(0).max(5000).default(150),
});

interface IntentRow {
  id: string;
  user_id: string;
  name: string;
  polygon: LatLng[] | { points?: LatLng[] };
  min_lat: number; max_lat: number; min_lng: number; max_lng: number;
  min_alt_agl_m: number; max_alt_agl_m: number;
  start_time: string; end_time: string;
  status: string;
}

function polyPoints(raw: IntentRow["polygon"]): LatLng[] {
  if (Array.isArray(raw)) return raw as LatLng[];
  if (raw && Array.isArray((raw as { points?: LatLng[] }).points)) return (raw as { points: LatLng[] }).points;
  return [];
}

function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return end > start ? Math.round((end - start) / 60000) : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const started = performance.now();

  const { user } = await authenticate(req);
  if (!user) return json(401, { error: "Unauthorized" });

  const paywall = await requirePaid({ id: user.id, email: user.email }, corsHeaders);
  if (paywall) return paywall;

  let raw: unknown;
  try { raw = await req.json(); } catch { return json(400, { error: "Invalid JSON body" }); }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });
  const body = parsed.data;

  const startMs = Date.parse(body.start_time);
  const endMs = Date.parse(body.end_time);
  if (endMs <= startMs) return json(400, { error: { end_time: ["End time must be after the start time"] } });
  if (body.max_alt_agl_m <= body.min_alt_agl_m) {
    return json(400, { error: { max_alt_agl_m: ["Ceiling must be above the floor"] } });
  }

  const admin = adminClient();
  const box = bbox(body.polygon);
  const degBuffer = body.buffer_m / 111_320;

  const { data: intents, error } = await admin
    .from("flight_intents")
    .select("id,user_id,name,polygon,min_lat,max_lat,min_lng,max_lng,min_alt_agl_m,max_alt_agl_m,start_time,end_time,status")
    .eq("shared", true)
    .in("status", ["planned", "active"])
    .lt("start_time", body.end_time)
    .gt("end_time", body.start_time)
    .limit(500);

  if (error) {
    await recordPerformance("strategic_deconfliction", false, performance.now() - started);
    return json(500, { error: "Deconfliction query failed" });
  }

  const conflicts: Record<string, unknown>[] = [];

  for (const intent of (intents ?? []) as IntentRow[]) {
    if (intent.user_id === user.id && body.plan_id && intent.id === body.plan_id) continue;

    const padded = {
      min_lat: intent.min_lat - degBuffer, max_lat: intent.max_lat + degBuffer,
      min_lng: intent.min_lng - degBuffer, max_lng: intent.max_lng + degBuffer,
    };
    if (!boxesOverlap(box, padded)) continue;

    const altOverlap =
      body.min_alt_agl_m <= intent.max_alt_agl_m && body.max_alt_agl_m >= intent.min_alt_agl_m;

    const other = polyPoints(intent.polygon);
    let minSeparationM = Infinity;
    let intersects = false;
    if (other.length >= 3) {
      for (const p of body.polygon) {
        if (pointInPolygon(p, other)) { intersects = true; minSeparationM = 0; break; }
        minSeparationM = Math.min(minSeparationM, distanceToPolygonM(p, other));
      }
      if (!intersects) {
        for (const p of other) {
          if (pointInPolygon(p, body.polygon)) { intersects = true; minSeparationM = 0; break; }
        }
      }
    } else {
      minSeparationM = 0;
      intersects = true;
    }

    const lateralConflict = intersects || minSeparationM <= body.buffer_m;
    if (!lateralConflict) continue;

    const mins = overlapMinutes(startMs, endMs, Date.parse(intent.start_time), Date.parse(intent.end_time));

    conflicts.push({
      intent_id: intent.id,
      name: intent.name,
      own_operation: intent.user_id === user.id,
      lateral: intersects ? "overlapping" : "within buffer",
      separation_m: Number.isFinite(minSeparationM) ? Math.round(minSeparationM) : 0,
      altitude_overlap: altOverlap,
      altitude_band_m: [intent.min_alt_agl_m, intent.max_alt_agl_m],
      time_overlap_minutes: mins,
      window: { start: intent.start_time, end: intent.end_time },
      severity: intersects && altOverlap && mins > 0 ? "high" : altOverlap && mins > 0 ? "medium" : "low",
    });
  }

  const blocking = conflicts.filter((c) => c.severity === "high" || c.severity === "medium");
  const clear = blocking.length === 0;

  const suggestions: Record<string, unknown>[] = [];
  if (!clear) {
    const latest = Math.max(...blocking.map((c) => Date.parse((c.window as { end: string }).end)));
    if (Number.isFinite(latest)) {
      suggestions.push({
        kind: "shift_window",
        label: "Delay the operation until conflicting traffic clears",
        start_time: new Date(latest + 5 * 60_000).toISOString(),
        end_time: new Date(latest + 5 * 60_000 + (endMs - startMs)).toISOString(),
      });
    }
    const lowestCeiling = Math.min(
      ...blocking.map((c) => (c.altitude_band_m as number[])[0]),
    );
    if (Number.isFinite(lowestCeiling) && lowestCeiling - 5 > body.min_alt_agl_m) {
      suggestions.push({
        kind: "lower_ceiling",
        label: `Cap the operation at ${Math.floor(lowestCeiling - 5)} m AGL to stay below conflicting traffic`,
        max_alt_agl_m: Math.floor(lowestCeiling - 5),
      });
    }
    suggestions.push({
      kind: "reduce_area",
      label: "Shrink the survey area to keep at least the configured lateral buffer from conflicting volumes",
      buffer_m: body.buffer_m,
    });
    suggestions.push({
      kind: "coordinate",
      label: "Contact the other operator to coordinate a shared time-slice of the volume",
    });
  }

  // Publish the intent when requested and the volume is clear (or the operator forces it).
  let intentId: string | null = null;
  if (body.publish) {
    const { data: inserted } = await admin
      .from("flight_intents")
      .insert({
        user_id: user.id,
        plan_id: body.plan_id ?? null,
        project_id: body.project_id ?? null,
        job_id: body.job_id ?? null,
        name: body.name,
        polygon: body.polygon,
        ...box,
        min_alt_agl_m: body.min_alt_agl_m,
        max_alt_agl_m: body.max_alt_agl_m,
        start_time: body.start_time,
        end_time: body.end_time,
        shared: body.shared,
        status: "planned",
      })
      .select("id")
      .maybeSingle();
    intentId = inserted?.id ?? null;
  }

  const latency = Math.round(performance.now() - started);
  const result = { clear, conflicts, suggestions, checked: (intents ?? []).length, intent_id: intentId, latency_ms: latency };

  await admin.from("deconfliction_checks").insert({
    user_id: user.id,
    intent_id: intentId,
    request: { ...body, polygon_points: body.polygon.length, polygon: undefined },
    clear,
    conflicts,
    suggestions,
  });

  await recordService({
    user_id: user.id,
    service_kind: "strategic_deconfliction",
    request: { name: body.name, window: [body.start_time, body.end_time], alt: [body.min_alt_agl_m, body.max_alt_agl_m] },
    response: { clear, conflict_count: conflicts.length },
    data_source: "Dronie flight intent registry",
    latency_ms: latency,
    plan_id: body.plan_id ?? null,
    project_id: body.project_id ?? null,
    job_id: body.job_id ?? null,
  });
  await recordPerformance("strategic_deconfliction", true, latency, 0);

  return json(200, result);
});

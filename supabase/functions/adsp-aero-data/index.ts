// ADSP — Terrain/Obstacle, Aeronautical Data and Weather services (14 CFR Part 146).
// Normalizes free public feeds (USGS 3DEP, FAA TFR, Open-Meteo/NWS) into one advisory payload.
import { z } from "https://esm.sh/zod@3.23.8";
import { requirePaid } from "../_shared/requirePaid.ts";
import {
  authenticate, centroid, corsHeaders, haversineKm, json,
  recordPerformance, recordService, type LatLng,
} from "../_shared/adsp.ts";

const PointSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

const BodySchema = z.object({
  polygon: z.array(PointSchema).min(1).max(500),
  services: z.array(z.enum(["terrain_obstacle", "aeronautical_data", "weather"]))
    .min(1).default(["terrain_obstacle", "aeronautical_data", "weather"]),
  limits: z.object({
    max_wind_kph: z.number().min(0).max(200).default(35),
    max_gust_kph: z.number().min(0).max(250).default(45),
    max_precip_pct: z.number().min(0).max(100).default(40),
    min_visibility_km: z.number().min(0).max(50).default(5),
    min_temp_c: z.number().min(-60).max(60).default(-5),
  }).default({}),
  plan_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
});

const cache = new Map<string, { at: number; value: unknown }>();
const TTL = 10 * 60_000;

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "DronieApp ADSP (dronieapp.com)" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** USGS 3DEP point elevation, metres. */
async function elevationM(pt: LatLng): Promise<number | null> {
  const url = `https://epqs.nationalmap.gov/v1/json?x=${pt.lng}&y=${pt.lat}&units=Meters&wkid=4326&includeDate=false`;
  const data = await cached(`elev:${pt.lat.toFixed(4)},${pt.lng.toFixed(4)}`, () => fetchJson(url));
  const v = (data as { value?: number | string })?.value;
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Sample terrain across the area to derive relief and a minimum safe altitude advisory. */
async function terrainService(poly: LatLng[]) {
  const c = centroid(poly);
  const samples = [c, ...poly.slice(0, 5)];
  const results = await Promise.all(samples.map((p) => elevationM(p)));
  const values = results.filter((v): v is number => v !== null);
  if (values.length === 0) {
    return { available: false, note: "Elevation service unavailable for this area." };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const relief = Math.round(max - min);
  // Part 107 ceiling is 400 ft AGL; relief eats into usable altitude band.
  const msaM = Math.round(relief + 30);
  return {
    available: true,
    samples: values.length,
    min_elevation_m: Math.round(min),
    max_elevation_m: Math.round(max),
    relief_m: relief,
    min_safe_altitude_agl_m: msaM,
    advisory:
      relief > 60
        ? `Terrain relief of ${relief} m across the area — use terrain-following or set the launch datum at the high point to stay under 400 ft AGL.`
        : `Terrain relief of ${relief} m — a fixed-altitude mission is acceptable; keep at least ${msaM} m AGL clearance above obstructions.`,
    source: "USGS 3DEP (EPQS)",
  };
}

/** FAA temporary flight restrictions + coarse airspace advisory. */
async function aeronauticalService(poly: LatLng[]) {
  const c = centroid(poly);
  const tfrList = await cached("tfr:all", () => fetchJson("https://tfr.faa.gov/tfrapi/exportTfrList", 8000));
  const nearby: Record<string, unknown>[] = [];
  if (Array.isArray(tfrList)) {
    for (const item of tfrList as Record<string, unknown>[]) {
      const lat = Number(item.latitude ?? item.lat);
      const lng = Number(item.longitude ?? item.lon ?? item.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const km = haversineKm(c, { lat, lng });
      if (km <= 90) {
        nearby.push({
          notam: item.notam_id ?? item.notamId ?? null,
          type: item.type ?? null,
          description: item.description ?? item.description ?? null,
          distance_km: Math.round(km),
        });
      }
    }
  }
  nearby.sort((a, b) => (a.distance_km as number) - (b.distance_km as number));

  return {
    available: tfrList !== null,
    tfr_count: nearby.length,
    tfrs: nearby.slice(0, 10),
    advisory:
      nearby.length > 0
        ? `${nearby.length} temporary flight restriction${nearby.length === 1 ? "" : "s"} within 90 km — review each before launch.`
        : "No temporary flight restrictions found within 90 km of the operating area.",
    reminder:
      "Controlled airspace requires LAANC or an FAA authorization. This advisory does not replace an official preflight briefing (14 CFR 107.49).",
    source: "FAA TFR service",
  };
}

/** Open-Meteo current + short-range forecast with a go/no-go summary. */
async function weatherService(poly: LatLng[], limits: z.infer<typeof BodySchema>["limits"]) {
  const c = centroid(poly);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${c.lat.toFixed(4)}&longitude=${c.lng.toFixed(4)}` +
    `&current=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,cloud_cover` +
    `&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_gusts_10m,visibility` +
    `&forecast_days=1&wind_speed_unit=kmh&timezone=UTC`;
  const data = await cached(`wx:${c.lat.toFixed(3)},${c.lng.toFixed(3)}`, () => fetchJson(url));
  if (!data) return { available: false, note: "Weather service unavailable." };

  const cur = (data as { current?: Record<string, number | string> }).current ?? {};
  const wind = Number(cur.wind_speed_10m ?? 0);
  const gust = Number(cur.wind_gusts_10m ?? 0);
  const temp = Number(cur.temperature_2m ?? 0);
  const visKm = Number(cur.visibility ?? 0) / 1000;
  const precip = Number(cur.precipitation ?? 0);

  const blockers: string[] = [];
  if (wind > limits.max_wind_kph) blockers.push(`Wind ${Math.round(wind)} km/h exceeds the ${limits.max_wind_kph} km/h limit`);
  if (gust > limits.max_gust_kph) blockers.push(`Gusts ${Math.round(gust)} km/h exceed the ${limits.max_gust_kph} km/h limit`);
  if (visKm > 0 && visKm < limits.min_visibility_km) blockers.push(`Visibility ${visKm.toFixed(1)} km below the ${limits.min_visibility_km} km minimum (14 CFR 107.51 requires 3 statute miles)`);
  if (temp < limits.min_temp_c) blockers.push(`Temperature ${Math.round(temp)} °C below the ${limits.min_temp_c} °C limit`);
  if (precip > 0.2) blockers.push(`Active precipitation (${precip} mm/h)`);

  return {
    available: true,
    current: {
      temperature_c: temp,
      wind_kph: Math.round(wind),
      gust_kph: Math.round(gust),
      wind_direction_deg: Number(cur.wind_direction_10m ?? 0),
      visibility_km: Number(visKm.toFixed(1)),
      cloud_cover_pct: Number(cur.cloud_cover ?? 0),
      precipitation_mm: precip,
    },
    go: blockers.length === 0,
    blockers,
    advisory: blockers.length === 0 ? "Conditions are within the configured operating limits." : blockers.join("; "),
    source: "Open-Meteo (NOAA/GFS blend)",
    observed_at: (data as { current?: { time?: string } }).current?.time ?? null,
  };
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

  const wanted = new Set(body.services);
  const [terrain, aero, weather] = await Promise.all([
    wanted.has("terrain_obstacle") ? terrainService(body.polygon) : Promise.resolve(null),
    wanted.has("aeronautical_data") ? aeronauticalService(body.polygon) : Promise.resolve(null),
    wanted.has("weather") ? weatherService(body.polygon, body.limits) : Promise.resolve(null),
  ]);

  const latency = Math.round(performance.now() - started);
  const payload = { terrain, aeronautical: aero, weather, latency_ms: latency };

  for (const [kind, value, source] of [
    ["terrain_obstacle", terrain, "USGS 3DEP"],
    ["aeronautical_data", aero, "FAA TFR service"],
    ["weather", weather, "Open-Meteo"],
  ] as const) {
    if (!value) continue;
    const ok = (value as { available?: boolean }).available !== false;
    await recordService({
      user_id: user.id,
      service_kind: kind,
      request: { centroid: centroid(body.polygon) },
      response: value,
      data_source: source,
      latency_ms: latency,
      ok,
      plan_id: body.plan_id ?? null,
      project_id: body.project_id ?? null,
    });
    await recordPerformance(kind, ok, latency, 60);
  }

  return json(200, payload);
});

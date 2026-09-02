// ADSP — service health probe. Writes availability/latency samples per service
// and flips adsp_services.status so the catalog reflects reality.
import { adminClient, corsHeaders, json } from "../_shared/adsp.ts";

async function probe(url: string, timeoutMs = 8000) {
  const started = performance.now();
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "DronieApp ADSP health" } });
    return { ok: res.ok, latency: performance.now() - started };
  } catch {
    return { ok: false, latency: performance.now() - started };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = adminClient();
  const results: Record<string, { ok: boolean; latency_ms: number }> = {};

  // Internal services: measured by a trivial registry query.
  const internalStart = performance.now();
  const { error: intentErr } = await admin.from("flight_intents").select("id", { count: "exact", head: true });
  const internalLatency = performance.now() - internalStart;
  for (const kind of ["strategic_deconfliction", "conformance_monitoring", "flight_planning_support"]) {
    results[kind] = { ok: !intentErr, latency_ms: Math.round(internalLatency) };
  }

  // External feeds.
  const [terrain, aero, weather] = await Promise.all([
    probe("https://epqs.nationalmap.gov/v1/json?x=-105.0&y=39.7&units=Meters&wkid=4326"),
    probe("https://tfr.faa.gov/tfrapi/exportTfrList"),
    probe("https://api.open-meteo.com/v1/forecast?latitude=39.7&longitude=-105.0&current=temperature_2m"),
  ]);
  results.terrain_obstacle = { ok: terrain.ok, latency_ms: Math.round(terrain.latency) };
  results.aeronautical_data = { ok: aero.ok, latency_ms: Math.round(aero.latency) };
  results.weather = { ok: weather.ok, latency_ms: Math.round(weather.latency) };

  const rows = Object.entries(results).map(([service_kind, r]) => ({
    service_kind,
    available: r.ok,
    latency_ms: r.latency_ms,
    error_rate: r.ok ? 0 : 1,
    data_currency_minutes: 0,
  }));
  await admin.from("adsp_performance_samples").insert(rows);

  for (const [kind, r] of Object.entries(results)) {
    await admin
      .from("adsp_services")
      .update({ status: r.ok ? (r.latency_ms > 6000 ? "degraded" : "operational") : "offline" })
      .eq("kind", kind);
  }

  return json(200, { sampled: rows.length, results });
});

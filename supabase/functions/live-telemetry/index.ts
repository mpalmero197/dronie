// Live telemetry edge function
// Sources real aircraft data from the OpenSky Network REST API.
// Docs: https://openskynetwork.github.io/opensky-api/rest.html
// No API key required for the anonymous tier.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// OpenSky returns state vectors as positional arrays. Index reference:
// https://openskynetwork.github.io/opensky-api/rest.html#response
const FIELDS = [
  "icao24", "callsign", "origin_country", "time_position", "last_contact",
  "longitude", "latitude", "baro_altitude", "on_ground", "velocity",
  "true_track", "vertical_rate", "sensors", "geo_altitude", "squawk",
  "spi", "position_source",
] as const;

type StateVector = (string | number | boolean | null)[];

interface Aircraft {
  icao24: string;
  callsign: string;
  origin_country: string;
  latitude: number | null;
  longitude: number | null;
  altitude_m: number | null;
  velocity_ms: number | null;
  heading_deg: number | null;
  vertical_rate_ms: number | null;
  on_ground: boolean;
  last_contact: number;
}

function decode(s: StateVector): Aircraft {
  const obj: Record<string, unknown> = {};
  FIELDS.forEach((f, i) => { obj[f] = s[i]; });
  return {
    icao24: (obj.icao24 as string) ?? "",
    callsign: ((obj.callsign as string) ?? "").trim() || "—",
    origin_country: (obj.origin_country as string) ?? "—",
    latitude: obj.latitude as number | null,
    longitude: obj.longitude as number | null,
    altitude_m: (obj.geo_altitude as number | null) ?? (obj.baro_altitude as number | null),
    velocity_ms: obj.velocity as number | null,
    heading_deg: obj.true_track as number | null,
    vertical_rate_ms: obj.vertical_rate as number | null,
    on_ground: Boolean(obj.on_ground),
    last_contact: obj.last_contact as number,
  };
}

// Tiny in-memory cache (function instance lifetime) — OpenSky rate-limits
// anonymous callers to ~once per 10s per IP. Cache keeps users smooth.
const cache = new Map<string, { at: number; data: Aircraft[] }>();
const CACHE_MS = 8000;

async function fetchOpenSky(bbox: { lamin: number; lomin: number; lamax: number; lomax: number }) {
  const key = `${bbox.lamin.toFixed(2)},${bbox.lomin.toFixed(2)},${bbox.lamax.toFixed(2)},${bbox.lomax.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const resp = await fetch(
    `https://opensky-network.org/api/states/all?lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`,
  );
  if (!resp.ok) {
    if (resp.status === 429) throw new Error("OpenSky rate limit hit — try again in ~10s");
    throw new Error(`OpenSky returned ${resp.status}`);
  }
  const json = await resp.json() as { time: number; states: StateVector[] | null };
  const data = (json.states ?? []).map(decode).filter((a) => a.latitude != null && a.longitude != null);
  cache.set(key, { at: Date.now(), data });
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const lamin = parseFloat(url.searchParams.get("lamin") ?? "");
    const lomin = parseFloat(url.searchParams.get("lomin") ?? "");
    const lamax = parseFloat(url.searchParams.get("lamax") ?? "");
    const lomax = parseFloat(url.searchParams.get("lomax") ?? "");

    if ([lamin, lomin, lamax, lomax].some(Number.isNaN)) {
      return new Response(
        JSON.stringify({
          error: "Provide lamin, lomin, lamax, lomax query params (lat/lng bounding box)",
          example: "?lamin=37.7&lomin=-122.5&lamax=37.85&lomax=-122.35",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (lamax - lamin > 5 || lomax - lomin > 5) {
      return new Response(
        JSON.stringify({ error: "Bounding box too large (max 5° each side)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aircraft = await fetchOpenSky({ lamin, lomin, lamax, lomax });

    return new Response(
      JSON.stringify({
        source: "opensky-network",
        fetched_at: new Date().toISOString(),
        count: aircraft.length,
        aircraft,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=8" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("live-telemetry error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requirePaid } from "../_shared/requirePaid.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

type Mode = "analyze" | "chat";

interface AnalyzeBody {
  mode: "analyze";
  project_id: string;
  model?: string;
}
interface ChatBody {
  mode: "chat";
  project_id: string;
  question: string;
  model?: string;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pickImageCandidates(urls: Record<string, string> | null): { key: string; url: string }[] {
  if (!urls) return [];
  const order = ["orthomosaic", "ortho", "preview", "thumbnail", "dsm_preview", "dtm_preview"];
  const out: { key: string; url: string }[] = [];
  for (const k of order) {
    const v = urls[k];
    if (typeof v === "string" && /^https?:\/\//.test(v) && /\.(png|jpe?g|webp)(\?|$)/i.test(v)) {
      out.push({ key: k, url: v });
    }
  }
  for (const [k, v] of Object.entries(urls)) {
    if (out.some((o) => o.key === k)) continue;
    if (typeof v === "string" && /^https?:\/\//.test(v) && /\.(png|jpe?g|webp)(\?|$)/i.test(v)) {
      out.push({ key: k, url: v });
    }
  }
  return out.slice(0, 3);
}

/** Only keep images that are real raster deliverables, not 1x1 placeholders. */
async function usableImages(cands: { key: string; url: string }[]) {
  const kept: { key: string; url: string; bytes: number }[] = [];
  const skipped: string[] = [];
  await Promise.all(
    cands.map(async (c) => {
      try {
        const res = await fetch(c.url, { method: "HEAD" });
        const bytes = Number(res.headers.get("content-length") ?? "0");
        if (res.ok && bytes > 5_000) kept.push({ ...c, bytes });
        else skipped.push(`${c.key} (${res.ok ? `${bytes} bytes — placeholder` : `HTTP ${res.status}`})`);
      } catch {
        skipped.push(`${c.key} (unreachable)`);
      }
    }),
  );
  return { kept, skipped };
}

async function fetchText(url: string, maxBytes = 60_000): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { Range: `bytes=0-${maxBytes}` } });
    if (!res.ok && res.status !== 206) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Parse the ESRI ASCII grid header from a DSM/DTM to derive real extent + resolution. */
function summarizeAsc(key: string, text: string): string | null {
  const head: Record<string, string> = {};
  for (const line of text.split(/\r?\n/).slice(0, 8)) {
    const m = line.trim().match(/^([A-Za-z_]+)\s+(-?[\d.eE+]+)$/);
    if (m) head[m[1].toLowerCase()] = m[2];
  }
  if (!head.ncols || !head.nrows) return null;
  const cell = Number(head.cellsize ?? 0);
  const cols = Number(head.ncols);
  const rows = Number(head.nrows);
  const parts = [`${key.toUpperCase()}: ${cols} x ${rows} cells`];
  if (cell) {
    parts.push(`cell size ${cell} (~${(cell * 100).toFixed(1)} cm/px)`);
    parts.push(`coverage ~${((cols * cell) * (rows * cell) / 10_000).toFixed(2)} ha`);
  }
  if (head.xllcorner && head.yllcorner) parts.push(`origin ${head.xllcorner}, ${head.yllcorner}`);
  // elevation range from the sampled body
  const nums = text
    .split(/\r?\n/)
    .slice(6, 400)
    .join(" ")
    .split(/\s+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n !== Number(head.nodata_value ?? -9999));
  if (nums.length > 20) {
    parts.push(`sampled elevation ${Math.min(...nums).toFixed(1)}–${Math.max(...nums).toFixed(1)} m`);
  }
  return parts.join(", ");
}

function summarizeGeoJson(text: string): string | null {
  try {
    const gj = JSON.parse(text);
    const feats = Array.isArray(gj?.features) ? gj.features : [];
    if (!feats.length) return null;
    const elevs = feats
      .map((f: any) => Number(f?.properties?.elevation ?? f?.properties?.ELEV ?? NaN))
      .filter((n: number) => Number.isFinite(n));
    let s = `Contours: ${feats.length} lines`;
    if (elevs.length) s += `, elevation band ${Math.min(...elevs)}–${Math.max(...elevs)} m`;
    return s;
  } catch {
    return null;
  }
}

function bboxFromGps(points: unknown): string | null {
  const arr = Array.isArray(points) ? points : (points as any)?.points;
  if (!Array.isArray(arr) || !arr.length) return null;
  const lats: number[] = [];
  const lngs: number[] = [];
  const alts: number[] = [];
  for (const p of arr) {
    const lat = Number(p?.lat ?? p?.latitude);
    const lng = Number(p?.lng ?? p?.lon ?? p?.longitude);
    const alt = Number(p?.alt ?? p?.altitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) { lats.push(lat); lngs.push(lng); }
    if (Number.isFinite(alt)) alts.push(alt);
  }
  if (!lats.length) return null;
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const spanKm = Math.max((maxLat - minLat) * 111, (maxLng - minLng) * 111 * Math.cos((minLat * Math.PI) / 180));
  let s = `Capture footprint: ${arr.length} geotagged photos, centroid ${(
    (minLat + maxLat) / 2
  ).toFixed(5)}, ${((minLng + maxLng) / 2).toFixed(5)}; bbox ${minLat.toFixed(5)},${minLng.toFixed(5)} → ${maxLat.toFixed(5)},${maxLng.toFixed(5)} (~${spanKm.toFixed(2)} km across)`;
  if (alts.length) s += `; flight altitude ${Math.min(...alts).toFixed(0)}–${Math.max(...alts).toFixed(0)} m`;
  return s;
}

const SYSTEM_PROMPT = `You are a senior aerial mapping analyst for Dronie, a drone photogrammetry platform.
You analyze completed drone survey projects and produce concise, actionable site intelligence for the project owner.
You are calibrated, never overconfident. If the imagery or metadata is insufficient, say so explicitly in the relevant section.
Use clear, professional language. No marketing fluff.`;

const ANALYZE_INSTRUCTIONS = `Return ONLY valid JSON (no markdown fences, no prose) with this exact shape:
{
  "summary": string,                       // 2-4 sentence executive summary
  "features": [{ "title": string, "detail": string }],          // 3-6 observed site features
  "risks":    [{ "title": string, "detail": string, "severity": "low"|"medium"|"high" }], // 0-5 risks/anomalies
  "recommendations": [{ "title": string, "detail": string }]    // 3-5 next actions
}`;

async function callGateway(messages: unknown[], model: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });

  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 402) throw new Error("PAYMENT_REQUIRED");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  return content;
}

function tryParseJson(s: string): any {
  // Strip code fences if the model wrapped them despite instructions
  const cleaned = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // try to find the first { ... } block
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* noop */ }
    }
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return json(401, { error: "Unauthorized" });

  const paywall = await requirePaid({ id: user.id, email: user.email }, corsHeaders);
  if (paywall) return paywall;

  let body: AnalyzeBody | ChatBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const mode: Mode = body.mode;
  const projectId = body.project_id;
  const model = body.model || DEFAULT_MODEL;

  if (!projectId) return json(400, { error: "project_id required" });

  // Load the project (RLS ensures the user owns it)
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select(
      "id, name, description, area_ha, image_count, status, outputs, outputs_urls, created_at, gps_points, processing_settings, accuracy_report, current_stage, stage_log",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (projErr || !project) return json(404, { error: "Project not found" });

  const urls = ((project as any).outputs_urls ?? null) as Record<string, string> | null;

  // ── Gather real, project-specific evidence ────────────────────────────────
  const [{ kept: images, skipped: skippedImages }, annotationsRes, gcpRes] = await Promise.all([
    usableImages(pickImageCandidates(urls)),
    supabase
      .from("project_annotations")
      .select("kind, label, body, measurement, resolved")
      .eq("project_id", projectId)
      .limit(40),
    supabase
      .from("ground_control_points")
      .select("name, latitude, longitude, elevation")
      .eq("project_id", projectId)
      .limit(30),
  ]);

  const rasterFacts: string[] = [];
  await Promise.all(
    ["dsm", "dtm"].map(async (k) => {
      const u = urls?.[k];
      if (!u || !/\.asc(\?|$)/i.test(u)) return;
      const txt = await fetchText(u, 40_000);
      if (!txt) return;
      const s = summarizeAsc(k, txt);
      if (s) rasterFacts.push(s);
    }),
  );
  if (urls?.contours && /\.(geo)?json(\?|$)/i.test(urls.contours)) {
    const txt = await fetchText(urls.contours, 200_000);
    if (txt) {
      const s = summarizeGeoJson(txt);
      if (s) rasterFacts.push(s);
    }
  }
  if (urls?.metadata && /\.json(\?|$)/i.test(urls.metadata)) {
    const txt = await fetchText(urls.metadata, 20_000);
    if (txt) rasterFacts.push(`Deliverable metadata: ${txt.replace(/\s+/g, " ").slice(0, 1200)}`);
  }

  const settings = ((project as any).processing_settings ?? {}) as Record<string, unknown>;
  const accuracy = (project as any).accuracy_report ?? null;
  const annotations = annotationsRes.data ?? [];
  const gcps = gcpRes.data ?? [];
  const gpsSummary = bboxFromGps((project as any).gps_points);

  const evidence = [
    gpsSummary ?? "Capture footprint: no geotags recorded with this project.",
    Object.keys(settings).length
      ? `Processing settings: ${Object.entries(settings)
          .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("/") : String(v)}`)
          .join(", ")}`
      : "Processing settings: (not recorded)",
    accuracy ? `Accuracy report: ${JSON.stringify(accuracy).slice(0, 1500)}` : "Accuracy report: none stored.",
    gcps.length
      ? `Ground control points (${gcps.length}): ${gcps
          .map((g: any) => `${g.name} @ ${g.latitude},${g.longitude}${g.elevation != null ? ` (${g.elevation} m)` : ""}`)
          .join("; ")}`
      : "Ground control points: none uploaded (results are GPS-accuracy only).",
    annotations.length
      ? `Site annotations (${annotations.length}): ${annotations
          .map((a: any) =>
            `[${a.kind}${a.resolved ? "/resolved" : ""}] ${a.label ?? "untitled"}${
              a.body ? ` — ${String(a.body).slice(0, 160)}` : ""
            }${a.measurement ? ` (${JSON.stringify(a.measurement).slice(0, 120)})` : ""}`,
          )
          .join("; ")}`
      : "Site annotations: none recorded by the operator.",
    rasterFacts.length ? `Raster/vector deliverable facts: ${rasterFacts.join(" | ")}` : "Raster deliverable headers: unavailable.",
    images.length
      ? `Imagery attached to this request: ${images.map((i) => `${i.key} (${Math.round(i.bytes / 1024)} KB)`).join(", ")}`
      : `Imagery attached to this request: NONE. ${
          skippedImages.length ? `Unusable outputs: ${skippedImages.join(", ")}.` : "No raster preview was exported."
        } Do NOT describe visual site contents — you cannot see the site. Base every statement on the metadata above and say plainly that visual interpretation is unavailable until a real orthomosaic is exported.`,
  ].join("\n");

  const projectContext = `PROJECT METADATA
Name: ${project.name}
Description: ${project.description ?? "(none)"}
Status: ${project.status}
Captured: ${new Date(project.created_at).toLocaleDateString()}
Surveyed area: ${project.area_ha != null ? `${Number(project.area_ha).toFixed(2)} ha` : "unknown"}
Image count: ${project.image_count}
Generated deliverables: ${(project.outputs ?? []).join(", ") || "(none)"}

PROJECT EVIDENCE
${evidence}`;

  try {
    if (mode === "analyze") {
      const userParts: unknown[] = [
        { type: "text", text: `${projectContext}\n\n${ANALYZE_INSTRUCTIONS}` },
      ];
      for (const img of images) {
        userParts.push({ type: "image_url", image_url: { url: img.url } });
      }

      const content = await callGateway(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userParts },
        ],
        model,
      );

      const parsed = tryParseJson(content);
      if (!parsed || typeof parsed.summary !== "string") {
        return json(502, { error: "Model did not return valid JSON", raw: content.slice(0, 500) });
      }

      const insertRow = {
        project_id: projectId,
        user_id: user.id,
        model,
        summary: String(parsed.summary).slice(0, 4000),
        features: Array.isArray(parsed.features) ? parsed.features.slice(0, 8) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 8) : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 8) : [],
        raw: parsed,
      };

      const { data: saved, error: insErr } = await supabase
        .from("project_ai_reports")
        .insert(insertRow)
        .select()
        .single();

      if (insErr) return json(500, { error: insErr.message });
      return json(200, { report: saved });
    }

    if (mode === "chat") {
      const question = (body as ChatBody).question?.trim();
      if (!question) return json(400, { error: "question required" });

      // Load latest report for grounding
      const { data: latest } = await supabase
        .from("project_ai_reports")
        .select("summary, features, risks, recommendations")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Load recent message history (last 10)
      const { data: history } = await supabase
        .from("project_ai_messages")
        .select("role, content")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
        .limit(20);

      const reportContext = latest
        ? `EXISTING ANALYSIS\nSummary: ${latest.summary}\nFeatures: ${JSON.stringify(latest.features)}\nRisks: ${JSON.stringify(latest.risks)}\nRecommendations: ${JSON.stringify(latest.recommendations)}`
        : "No prior analysis has been generated for this project.";

      const messages: unknown[] = [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\n${projectContext}\n\n${reportContext}\n\nAnswer the user's follow-up questions about this specific project. Be concise (under 180 words). If a question cannot be answered from the available data, say so.`,
        },
        ...((history ?? []).map((m) => ({ role: m.role, content: m.content }))),
        { role: "user", content: question },
      ];

      const content = await callGateway(messages, model);

      // Persist both turns
      await supabase.from("project_ai_messages").insert([
        { project_id: projectId, user_id: user.id, role: "user", content: question },
        { project_id: projectId, user_id: user.id, role: "assistant", content },
      ]);

      return json(200, { answer: content });
    }

    return json(400, { error: "Unknown mode" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "RATE_LIMIT") return json(429, { error: "Rate limit reached. Please try again shortly." });
    if (msg === "PAYMENT_REQUIRED") return json(402, { error: "AI credits exhausted. Please add credits in Lovable Cloud." });
    return json(500, { error: msg });
  }
});
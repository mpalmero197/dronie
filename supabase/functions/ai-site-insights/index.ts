import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function pickThumbnail(urls: Record<string, string> | null): string | null {
  if (!urls) return null;
  const keys = ["orthomosaic", "ortho", "preview", "thumbnail", "dem", "dsm"];
  for (const k of keys) {
    const v = urls[k];
    if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
  }
  // fall back to the first http url we find
  for (const v of Object.values(urls)) {
    if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
  }
  return null;
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
    .select("id, name, description, area_ha, image_count, status, outputs, outputs_urls, created_at")
    .eq("id", projectId)
    .maybeSingle();

  if (projErr || !project) return json(404, { error: "Project not found" });

  const thumb = pickThumbnail((project as any).outputs_urls ?? null);

  const projectContext = `PROJECT METADATA
Name: ${project.name}
Description: ${project.description ?? "(none)"}
Status: ${project.status}
Captured: ${new Date(project.created_at).toLocaleDateString()}
Surveyed area: ${project.area_ha != null ? `${Number(project.area_ha).toFixed(2)} ha` : "unknown"}
Image count: ${project.image_count}
Generated deliverables: ${(project.outputs ?? []).join(", ") || "(none)"}`;

  try {
    if (mode === "analyze") {
      const userParts: unknown[] = [
        { type: "text", text: `${projectContext}\n\n${ANALYZE_INSTRUCTIONS}` },
      ];
      if (thumb) {
        userParts.push({ type: "image_url", image_url: { url: thumb } });
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
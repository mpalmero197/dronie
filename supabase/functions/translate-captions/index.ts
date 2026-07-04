import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Body: { cues: [{ id?, startS, endS, text }], targetLang: string }
 * Returns: { cues: [{ id?, startS, endS, text }] }
 * Uses Lovable AI Gateway to translate caption text while preserving timing.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { cues, targetLang } = await req.json();
    if (!Array.isArray(cues) || cues.length === 0) throw new Error("cues array required");
    if (!targetLang) throw new Error("targetLang required");
    if (cues.length > 500) throw new Error("cues array too large (max 500)");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const numbered = cues.map((c: { text: string }, i: number) => `${i + 1}. ${c.text}`).join("\n");
    const prompt = `Translate the following numbered subtitle lines into ${targetLang}. Keep the same numbering, one translation per line, no commentary, preserve proper nouns.\n\n${numbered}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI gateway error: ${res.status} ${t}`);
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const map = new Map<number, string>();
    for (const line of lines) {
      const m = line.match(/^(\d+)[\.\)\:]\s*(.*)$/);
      if (m) map.set(parseInt(m[1], 10), m[2]);
    }
    const translated = cues.map((c: { startS: number; endS: number; text: string; id?: string }, i: number) => ({
      ...c,
      text: map.get(i + 1) ?? c.text,
    }));
    return new Response(JSON.stringify({ cues: translated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
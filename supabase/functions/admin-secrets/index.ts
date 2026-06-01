// Admin-only API key vault. Stores values encrypted with pgcrypto using the
// service-role key as the symmetric password. Plaintext never leaves backend.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Known categories shown in the admin UI. Adding here makes them appear as
// suggested entries even before a value is saved.
const KNOWN_KEYS: Record<string, { category: string; hint: string }> = {
  WEBODM_LIGHTNING_URL: { category: "processing", hint: "Base URL for your WebODM Lightning / WebODM instance, e.g. https://webodm.net" },
  WEBODM_LIGHTNING_TOKEN: { category: "processing", hint: "API token from WebODM Lightning (Account → API)" },
  CLOUDFLARE_ACCOUNT_ID: { category: "fleet", hint: "Cloudflare dashboard → right sidebar → Account ID" },
  CLOUDFLARE_STREAM_TOKEN: { category: "fleet", hint: "API token with Stream:Edit permission" },
  REPLICATE_API_TOKEN: { category: "splats", hint: "Optional override. If unset, the Replicate connector key is used." },
  MAPBOX_TOKEN: { category: "other", hint: "Optional Mapbox public token for premium basemaps" },
};

function mask(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 3)}${"•".repeat(Math.max(4, value.length - 7))}${value.slice(-4)}`;
}

async function assertAdmin(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) throw new Response("Missing token", { status: 401, headers: corsHeaders });
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Response("Admins only", { status: 403, headers: corsHeaders });
  return { user, admin };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let ctx: { user: any; admin: ReturnType<typeof createClient> };
  try {
    ctx = await assertAdmin(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const { user, admin } = ctx;

  try {
    if (req.method === "GET") {
      const { data, error } = await admin
        .from("app_secrets")
        .select("name, category, hint, updated_at, updated_by");
      if (error) throw error;
      const stored = new Map((data ?? []).map((r) => [r.name, r]));
      const entries = Object.entries(KNOWN_KEYS).map(([name, meta]) => {
        const row = stored.get(name);
        return {
          name,
          category: row?.category ?? meta.category,
          hint: row?.hint ?? meta.hint,
          is_set: !!row,
          updated_at: row?.updated_at ?? null,
        };
      });
      // Include custom (non-known) saved secrets too
      for (const row of data ?? []) {
        if (!KNOWN_KEYS[row.name]) {
          entries.push({ name: row.name, category: row.category, hint: row.hint ?? "", is_set: true, updated_at: row.updated_at });
        }
      }
      return new Response(JSON.stringify({ entries }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "PUT" || req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const name = String(body.name ?? "").trim();
      const value = String(body.value ?? "");
      const category = String(body.category ?? KNOWN_KEYS[name]?.category ?? "other");
      const hint = body.hint != null ? String(body.hint) : KNOWN_KEYS[name]?.hint ?? null;
      if (!/^[A-Z][A-Z0-9_]{1,127}$/.test(name)) {
        return new Response(JSON.stringify({ error: "Name must be UPPER_SNAKE_CASE." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!value || value.length > 8192) {
        return new Response(JSON.stringify({ error: "Value required (1–8192 chars)." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Encrypt server-side using pgcrypto
      const { data: encRow, error: encErr } = await admin
        .rpc("encrypt_app_secret", { _value: value, _key: SERVICE_ROLE });
      if (encErr) throw encErr;
      const { error } = await admin
        .from("app_secrets")
        .upsert({ name, value_encrypted: encRow as unknown as string, category, hint, updated_by: user.id, updated_at: new Date().toISOString() });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, masked: mask(value) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "DELETE") {
      const body = await req.json().catch(() => ({}));
      const name = String(body.name ?? "");
      if (!name) return new Response(JSON.stringify({ error: "Missing name" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error } = await admin.from("app_secrets").delete().eq("name", name);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (err) {
    console.error("admin-secrets error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

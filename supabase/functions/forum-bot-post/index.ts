import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BOT_EMAIL = "dronie-bot@internal.dronieapp.com";
const BOT_USERNAME = "dronie_bot";
const BOT_FULL_NAME = "Dronie Bot";
const BOT_HEADLINE = "Community topics, auto-posted daily 🤖";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80) || `topic-${Date.now()}`;
}

async function ensureBotUser(): Promise<string> {
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("username", BOT_USERNAME)
    .maybeSingle();
  if (existingProfile?.id) return existingProfile.id;

  // Try to find in auth first
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let userId = list?.users?.find((u) => u.email === BOT_EMAIL)?.id;

  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: BOT_EMAIL,
      email_confirm: true,
      user_metadata: { full_name: BOT_FULL_NAME, is_bot: true },
    });
    if (error) throw error;
    userId = created.user!.id;
  }

  await admin.from("profiles").upsert({
    id: userId,
    full_name: BOT_FULL_NAME,
    username: BOT_USERNAME,
    headline: BOT_HEADLINE,
    bio: "I'm an automated assistant that starts fresh drone-community discussions every day. Jump in and share your take!",
  });

  return userId;
}

async function pickCategory(): Promise<{ id: string; slug: string; title: string; description: string | null }> {
  const { data: cats, error } = await admin
    .from("forum_categories")
    .select("id, slug, title, description");
  if (error) throw error;
  if (!cats?.length) throw new Error("No forum categories");

  // Round-robin cursor
  const { data: state } = await admin
    .from("bot_state")
    .select("value")
    .eq("key", "forum_bot_cursor")
    .maybeSingle();
  const cursor = Number(state?.value ?? 0);
  const sorted = [...cats].sort((a, b) => a.slug.localeCompare(b.slug));
  const pick = sorted[cursor % sorted.length];
  await admin
    .from("bot_state")
    .upsert({ key: "forum_bot_cursor", value: String((cursor + 1) % sorted.length) });
  return pick;
}

async function generateTopic(category: { slug: string; title: string; description: string | null }) {
  const system = `You are a passionate drone pilot and community manager writing a NEW discussion topic for the "${category.title}" section of a drone-pilot forum called Dronie. Section description: ${category.description ?? "N/A"}.

Write something an actual working drone pilot, aerial photographer, mapper, or Part 107 operator would care about. Be specific, opinionated, and inviting — end with a real question that gets people replying. NO corporate fluff, NO "as an AI", NO hashtags, NO emojis in the title.

Return STRICT JSON only, no markdown fences:
{"title":"...", "body":"..."}

Rules:
- title: 6–90 chars, punchy, specific. No clickbait, no ALL CAPS.
- body: 350–900 chars, plain text with line breaks. Reference concrete gear/regs/workflows where relevant to "${category.title}". End with an open question.`;

  const user = `Generate ONE fresh topic for the "${category.title}" section. Avoid generic "what's your favorite drone?" prompts — get into a specific scenario, technique, gotcha, workflow, or debate.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway ${res.status}: ${text}`);
  }
  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  const cleaned = raw.replace(/^```json\s*|```$/g, "").trim();
  const parsed = JSON.parse(cleaned);
  let title = String(parsed.title ?? "").trim();
  let body = String(parsed.body ?? "").trim();
  if (title.length < 3) title = `Discussion: ${category.title}`;
  if (title.length > 200) title = title.slice(0, 197) + "...";
  if (body.length < 1) body = "Kicking off a fresh discussion — what's on your mind?";
  if (body.length > 20000) body = body.slice(0, 20000);
  return { title, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

    const botId = await ensureBotUser();
    const category = await pickCategory();
    const { title, body } = await generateTopic(category);
    const slug = `${slugify(title)}-${Date.now().toString(36)}`;

    const { data: thread, error: insErr } = await admin
      .from("forum_threads")
      .insert({
        category_id: category.id,
        author_id: botId,
        title,
        slug,
        body,
      })
      .select("id, slug")
      .single();
    if (insErr) throw insErr;

    return new Response(
      JSON.stringify({
        ok: true,
        thread_id: thread.id,
        category: category.slug,
        title,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("forum-bot-post error", e);
    return new Response(
      JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
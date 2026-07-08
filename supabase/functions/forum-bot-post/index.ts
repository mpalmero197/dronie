import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BOT_EMAIL = "dronie-bot@internal.dronieapp.com";
const BOT_USERNAME = "dronie_bot";
const BOT_FULL_NAME = "Dronie Bot";
const BOT_HEADLINE = "Community topics, auto-posted daily 🤖";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
// Dedup window (days) — bot won't repeat a title/link within this window.
const DEDUP_DAYS = Number(Deno.env.get("FORUM_BOT_DEDUP_DAYS") ?? "60");
// FAA news category slug — Part 107 & Regulations is the closest fit.
const FAA_CATEGORY_SLUG = "part-107";
// Multiple feeds — try in order, first that returns items wins. Google News is
// preferred (most FAA-centric) but often rate-limits edge egress, so we fall
// back to established drone news sites and filter to FAA / regulation stories.
const FAA_NEWS_FEEDS = [
  "https://news.google.com/rss/search?q=FAA+drone+OR+UAS+when:14d&hl=en-US&gl=US&ceid=US:en",
  "https://dronedj.com/feed/",
  "https://www.suasnews.com/feed/",
  "https://www.unmannedairspace.info/feed/",
];
const FAA_KEYWORDS = /\b(faa|part\s?107|remote\s?id|laanc|waiver|tfr|uas|unmanned|drone)\b/i;

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

function normalizeTitle(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|to|of|for|and|or|with|on|in|at|is|are|your|my)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getRecentBotTitles(botId: string): Promise<{ titles: Set<string>; bodies: string[] }> {
  const since = new Date(Date.now() - DEDUP_DAYS * 86400_000).toISOString();
  const { data, error } = await admin
    .from("forum_threads")
    .select("title, body")
    .eq("author_id", botId)
    .gte("created_at", since)
    .limit(500);
  if (error) throw error;
  const titles = new Set<string>((data ?? []).map((r: any) => normalizeTitle(r.title)));
  const bodies = (data ?? []).map((r: any) => String(r.body ?? ""));
  return { titles, bodies };
}

function isDuplicate(title: string, recentTitles: Set<string>): boolean {
  const norm = normalizeTitle(title);
  if (!norm) return true;
  if (recentTitles.has(norm)) return true;
  // Also flag near-duplicates: if 80%+ of tokens overlap with any prior title
  const tokens = new Set(norm.split(" ").filter((t) => t.length > 3));
  if (tokens.size < 3) return false;
  for (const prior of recentTitles) {
    const priorTokens = new Set(prior.split(" ").filter((t) => t.length > 3));
    if (priorTokens.size < 3) continue;
    let overlap = 0;
    for (const t of tokens) if (priorTokens.has(t)) overlap++;
    const ratio = overlap / Math.min(tokens.size, priorTokens.size);
    if (ratio >= 0.8) return true;
  }
  return false;
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

// ── FAA news ingestion ────────────────────────────────────────────────
interface FaaItem { title: string; link: string; pubDate: string; description: string; }

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, "").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function parseRssItems(xml: string): FaaItem[] {
  const items: FaaItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const pick = (tag: string) => {
      const r = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`).exec(block);
      if (!r) return "";
      return stripTags(r[1].replace(/<!\[CDATA\[|\]\]>/g, ""));
    };
    items.push({
      title: pick("title"),
      link: pick("link"),
      pubDate: pick("pubDate"),
      description: pick("description"),
    });
  }
  return items;
}

async function fetchFaaNews(): Promise<FaaItem[]> {
  const errors: string[] = [];
  for (const url of FAA_NEWS_FEEDS) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DronieBot/1.0; +https://dronieapp.com)",
          "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
      });
      if (!res.ok) { errors.push(`${url} ${res.status}`); continue; }
      const items = parseRssItems(await res.text())
        .filter((it) => FAA_KEYWORDS.test(`${it.title} ${it.description}`));
      if (items.length) { console.log("FAA feed used:", url, "items:", items.length); return items; }
    } catch (e) {
      errors.push(`${url} ${(e as Error).message}`);
    }
  }
  throw new Error(`no FAA feed available: ${errors.join(" | ")}`);
}

async function summarizeFaaItem(item: FaaItem): Promise<{ title: string; body: string }> {
  const system = `You are Dronie Bot summarizing an FAA / drone news headline for a pilot forum's "Part 107 & Regulations" section. Return STRICT JSON only:
{"title":"...", "body":"..."}

Rules:
- title: rewrite the headline as a plain, informative forum topic (6–90 chars). No clickbait, no emojis, no site names.
- body: 250–700 chars. Summarize what happened in plain English, why it matters for Part 107 / recreational pilots, and end with an open question inviting discussion. Include the source link on its own line at the end.
- No hashtags, no "as an AI".`;
  const user = `Headline: ${item.title}\nPublished: ${item.pubDate}\nSnippet: ${item.description}\nSource: ${item.link}`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI gateway ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "").trim());
  let title = String(parsed.title ?? item.title).trim().slice(0, 200);
  let body = String(parsed.body ?? "").trim();
  if (!body.includes(item.link)) body += `\n\nSource: ${item.link}`;
  return { title, body };
}

async function postAiTopic(botId: string, recentTitles: Set<string>) {
  const category = await pickCategory();
  let attempt = 0;
  let generated: { title: string; body: string } | null = null;
  while (attempt < 3) {
    const g = await generateTopic(category);
    if (!isDuplicate(g.title, recentTitles)) { generated = g; break; }
    console.log("ai duplicate detected, retrying", g.title);
    attempt++;
  }
  if (!generated) return { skipped: true, reason: "ai_duplicate", category: category.slug };
  const slug = `${slugify(generated.title)}-${Date.now().toString(36)}`;
  const { data: thread, error } = await admin
    .from("forum_threads")
    .insert({ category_id: category.id, author_id: botId, title: generated.title, slug, body: generated.body })
    .select("id, slug").single();
  if (error) throw error;
  recentTitles.add(normalizeTitle(generated.title));
  return { source: "ai", thread_id: thread.id, category: category.slug, title: generated.title };
}

async function postFaaUpdate(botId: string, recentTitles: Set<string>, recentBodies: string[]) {
  const { data: cat, error: cErr } = await admin
    .from("forum_categories").select("id, slug, title, description").eq("slug", FAA_CATEGORY_SLUG).maybeSingle();
  if (cErr) throw cErr;
  if (!cat) return { skipped: true, reason: "faa_category_missing" };
  const items = await fetchFaaNews();
  if (!items.length) return { skipped: true, reason: "faa_no_items" };
  // pick first item whose link/title isn't already in recent bot posts
  const priorLinks = new Set(recentBodies.flatMap((b) => Array.from(b.matchAll(/https?:\/\/\S+/g)).map((m) => m[0])));
  const pick = items.find((it) => it.link && !priorLinks.has(it.link) && !isDuplicate(it.title, recentTitles));
  if (!pick) return { skipped: true, reason: "faa_duplicate" };
  const { title, body } = await summarizeFaaItem(pick);
  if (isDuplicate(title, recentTitles)) return { skipped: true, reason: "faa_duplicate_after_rewrite" };
  const slug = `faa-${slugify(title)}-${Date.now().toString(36)}`;
  const { data: thread, error } = await admin
    .from("forum_threads")
    .insert({ category_id: cat.id, author_id: botId, title, slug, body })
    .select("id, slug").single();
  if (error) throw error;
  recentTitles.add(normalizeTitle(title));
  return { source: "faa", thread_id: thread.id, category: cat.slug, title, link: pick.link };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

    const url = new URL(req.url);
    const source = (url.searchParams.get("source") ?? "both").toLowerCase();

    const botId = await ensureBotUser();
    const { titles: recentTitles, bodies: recentBodies } = await getRecentBotTitles(botId);

    const results: any[] = [];
    if (source === "ai" || source === "both") {
      try { results.push(await postAiTopic(botId, recentTitles)); }
      catch (e) { results.push({ source: "ai", error: String((e as Error).message ?? e) }); }
    }
    if (source === "faa" || source === "both") {
      try { results.push(await postFaaUpdate(botId, recentTitles, recentBodies)); }
      catch (e) { results.push({ source: "faa", error: String((e as Error).message ?? e) }); }
    }

    return new Response(
      JSON.stringify({ ok: true, dedup_days: DEDUP_DAYS, results }),
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
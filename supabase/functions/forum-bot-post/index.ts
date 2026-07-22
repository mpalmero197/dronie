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
// "Did You Know" facts — FAA rule trivia + notable drone legal cases. Posted
// into Part 107 & Regulations. AI rewrites for freshness, seed rotates by cursor.
const DYK_CATEGORY_SLUG = "part-107";
const DYK_SEEDS: { topic: string; angle: "rule" | "case"; hint: string; citation: string; url: string }[] = [
  // FAA rule facts
  { topic: "400 ft AGL ceiling under Part 107", angle: "rule", hint: "You may exceed 400 ft AGL only within 400 ft of a structure — 14 CFR §107.51(b).", citation: "14 CFR §107.51", url: "https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-107/subpart-B/section-107.51" },
  { topic: "Night operations under Part 107", angle: "rule", hint: "Night flight allowed since April 2021 with anti-collision lighting visible for 3 statute miles — §107.29.", citation: "14 CFR §107.29", url: "https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-107/subpart-B/section-107.29" },
  { topic: "Operations over people (Categories 1–4)", angle: "rule", hint: "§107.39 & Subpart D — sustained flight over people requires an eligible drone and, in Cat 4, an airworthiness certificate.", citation: "14 CFR §107.39 & Subpart D", url: "https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-107/subpart-D" },
  { topic: "Remote ID compliance deadline", angle: "rule", hint: "Standard or Broadcast Module Remote ID required for nearly all Part 107 ops since March 16, 2024.", citation: "14 CFR Part 89 (Remote ID)", url: "https://www.faa.gov/uas/getting_started/remote_id" },
  { topic: "Recreational TRUST test", angle: "rule", hint: "Free, one-time test required under §44809 — carry proof when flying recreationally.", citation: "49 U.S.C. §44809 / TRUST", url: "https://www.faa.gov/uas/recreational_flyers/knowledge_test_updates" },
  { topic: "LAANC vs. DroneZone waiver", angle: "rule", hint: "LAANC = near-real-time controlled-airspace auth up to grid ceiling; DroneZone = manual waivers/further authorizations.", citation: "FAA LAANC & DroneZone", url: "https://www.faa.gov/uas/programs_partnerships/data_exchange" },
  { topic: "Registration threshold", angle: "rule", hint: "Any drone > 0.55 lb (250 g) must be registered with the FAA — recreational or Part 107.", citation: "14 CFR Part 48", url: "https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-48" },
  { topic: "Part 107 recurrent training", angle: "rule", hint: "Every 24 calendar months — free online recurrent training instead of an in-person retest since 2021.", citation: "14 CFR §107.65", url: "https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-107/subpart-C/section-107.65" },
  { topic: "Visual line of sight (VLOS)", angle: "rule", hint: "§107.31 — VLOS is required with unaided vision; corrective lenses count, binoculars do not.", citation: "14 CFR §107.31", url: "https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-107/subpart-B/section-107.31" },
  { topic: "Careless or reckless operation", angle: "rule", hint: "§107.23 — FAA can issue civil penalties even without a specific rule violation.", citation: "14 CFR §107.23", url: "https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-107/subpart-A/section-107.23" },
  { topic: "Accident reporting under Part 107", angle: "rule", hint: "§107.9 — report to FAA within 10 calendar days if serious injury or > $500 property damage.", citation: "14 CFR §107.9", url: "https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-107/subpart-A/section-107.9" },
  { topic: "TFRs and stadium restrictions", angle: "rule", hint: "3-nm no-drone zone around MLB/NFL/NCAA D1/NASCAR events from 1 hr before to 1 hr after — under §352 of the 2018 FAA Reauthorization Act.", citation: "FDC NOTAM 4/3621 (Stadium TFR)", url: "https://www.faa.gov/uas/getting_started/where_can_i_fly/airspace_restrictions/stadiums_sporting_events" },
  { topic: "Preemption of state/local drone laws", angle: "rule", hint: "FAA claims exclusive control of navigable airspace; localities may regulate takeoff/landing on their property.", citation: "FAA State & Local Fact Sheet (2015)", url: "https://www.faa.gov/uas/resources/policy_library/media/UAS_Fact_Sheet_Final.pdf" },

  // Notable drone legal cases
  { topic: "Huerta v. Pirker (2014)", angle: "case", hint: "NTSB overturned the FAA's ALJ ruling — first case establishing FAA authority to regulate small UAS as 'aircraft.'", citation: "Huerta v. Pirker, NTSB Order EA-5730 (2014)", url: "https://www.ntsb.gov/legal/alj/OnODocuments/Aviation/5730.pdf" },
  { topic: "Boggs v. Merideth (2017)", angle: "case", hint: "Kentucky 'drone slayer' case — federal court dismissed on jurisdiction, leaving airspace-vs-property rights unresolved.", citation: "Boggs v. Merideth, No. 3:16-cv-6-DJH (W.D. Ky. 2017)", url: "https://casetext.com/case/boggs-v-merideth" },
  { topic: "Taylor v. FAA (2017)", angle: "case", hint: "D.C. Circuit struck down FAA recreational registration rule; Congress reinstated it via 2017 NDAA.", citation: "Taylor v. Huerta, 856 F.3d 1089 (D.C. Cir. 2017)", url: "https://www.cadc.uscourts.gov/internet/opinions.nsf/FA6F27FFAA83E20585258125004FE314/$file/15-1495-1675918.pdf" },
  { topic: "Singer v. City of Newton (2017)", angle: "case", hint: "U.S. District Court struck down most of Newton, MA's drone ordinance as preempted by federal law.", citation: "Singer v. City of Newton, 284 F. Supp. 3d 125 (D. Mass. 2017)", url: "https://casetext.com/case/singer-v-city-of-newton" },
  { topic: "EPIC v. FAA (2017)", angle: "case", hint: "D.C. Circuit dismissed challenge to Part 107 privacy provisions — signaling FAA privacy standards are limited.", citation: "EPIC v. FAA, 892 F.3d 1249 (D.C. Cir. 2018)", url: "https://epic.org/documents/epic-v-faa-drones-2/" },
  { topic: "FAA v. SkyPan International (2015)", angle: "case", hint: "$1.9 M proposed civil penalty — largest single UAS enforcement action at the time; settled for $200 K.", citation: "FAA Press Release, SkyPan Enforcement (2015/2017)", url: "https://www.faa.gov/newsroom/faa-reaches-agreement-skypan-international-inc" },
  { topic: "RaceDayQuads v. FAA (2022)", angle: "case", hint: "D.C. Circuit upheld Remote ID rule against First Amendment challenge from hobbyist community.", citation: "RaceDayQuads LLC v. FAA, No. 21-1087 (D.C. Cir. 2022)", url: "https://www.cadc.uscourts.gov/internet/opinions.nsf/85D3B45B4E4E7B7C852588860052A46F/$file/21-1087-1957287.pdf" },
  { topic: "Brennan v. Dickson (2022)", angle: "case", hint: "Companion Remote ID challenge — court held FAA followed proper rulemaking under APA.", citation: "Brennan v. Dickson, 45 F.4th 48 (D.C. Cir. 2022)", url: "https://www.cadc.uscourts.gov/internet/opinions.nsf/85D3B45B4E4E7B7C852588860052A46F/$file/21-1087-1957287.pdf" },
  { topic: "Michael v. FAA (2018 enforcement)", angle: "case", hint: "Illustrates §107.23 'careless or reckless' penalties even when no other specific rule was violated.", citation: "In re: Michael, FAA Enforcement (2018)", url: "https://www.faa.gov/uas/resources/uas_regulations/part_107" },
];

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
  const system = `You are Dronie Bot — an automated assistant that posts NEUTRAL conversation starters in the "${category.title}" section of the Dronie community forum. Section description: ${category.description ?? "N/A"}.

STRICT IDENTITY RULES — never violate:
- You are a bot. Do NOT roleplay as a remote pilot, photographer, mapper, or operator.
- Do NOT describe jobs you flew, clients you worked with, or personal flight experiences.
- Do NOT give opinions, hot takes, recommendations, rankings, or "I prefer / I like / I think" statements.
- Do NOT use first-person singular ("I", "my", "me") as if you were a pilot. You may use "we" / "the community" sparingly.
- No hashtags, no emojis in the title, no "as an AI" disclaimers, no corporate fluff.

What you MAY post:
1. Verifiable facts (FAA rules, published specs, well-known industry data) stated plainly with a citation or source link when applicable.
2. Open conversation starters that invite pilots to share their own experience.
3. Gear questions — ask what drones, cameras, batteries, ND filters, software, apps, or accessories the community is using for a specific task.

Return STRICT JSON only, no markdown fences:
{"title":"...", "body":"..."}

Rules:
- title: 6–90 chars, neutral and specific. Phrase as a question or discussion prompt. No ALL CAPS, no clickbait.
- body: 250–800 chars, plain text with line breaks. If you state a fact, keep it accurate and cite the source (FAA reg, manufacturer spec sheet, etc.). End with an open question directed at the community (e.g., "What are you using?" / "How does your team handle this?").`;

  const user = `Generate ONE neutral conversation starter for the "${category.title}" section. Pick ONE of these formats: (a) a factual prompt with a citation and a follow-up question, or (b) a gear/tools question asking what the community is currently using for a specific task relevant to this section. Do NOT invent personal stories or opinions.`;

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
  const system = `You are Dronie Bot — an automated assistant summarizing an FAA / drone news headline for the "Part 107 & Regulations" section. Return STRICT JSON only:
{"title":"...", "body":"..."}

Rules:
- title: rewrite the headline as a plain, informative forum topic (6–90 chars). No clickbait, no emojis, no site names.
- body: 250–700 chars. Summarize what happened in plain English and note in neutral terms why it may matter for Part 107 / recreational pilots. End with an open question inviting the community to share how it affects them. Include the source link on its own line at the end.
- Facts only — no opinions, no recommendations, no "I think / we should". Do NOT roleplay as a pilot or claim personal experience with the event.
- No hashtags, no emojis, no "as an AI".`;
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
  const raw = String(json.choices?.[0]?.message?.content ?? "{}")
    .replace(/^```json\s*|```$/g, "").trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  const jsonSlice = first >= 0 && last > first ? raw.slice(first, last + 1) : "{}";
  let parsed: any;
  try { parsed = JSON.parse(jsonSlice); }
  catch { parsed = { title: item.title, body: item.description }; }
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

// ── Did You Know facts (FAA rules + notable drone legal cases) ────────
async function generateDidYouKnow(seed: { topic: string; angle: "rule" | "case"; hint: string; citation: string; url: string }) {
  const flavor = seed.angle === "rule"
    ? `an FAA rule fact — cite the specific regulation number (e.g. 14 CFR §107.xx) when relevant and explain what it means in practice`
    : `a notable drone-related lawsuit or enforcement action — name the parties, year, court/agency, and what pilots should take away from it`;
  const system = `You are Dronie Bot writing a "Did You Know?" post for the Part 107 & Regulations section of a drone pilot forum. Focus on ${flavor}.

Return STRICT JSON only, no code fences:
{"title":"...", "body":"..."}

Rules:
- title MUST start with "Did you know: " followed by a concise, factual hook (total 20–100 chars). No emojis.
- body: 300–800 chars, plain text. Start with the fact/case, then give practical context for working drone pilots. End with an open question inviting others to share their experience or interpretation.
- The body MUST include the exact citation string provided and end with a "Source:" line containing the exact URL provided. Do NOT invent alternate URLs or citations.
- Accuracy matters — do NOT invent regulation numbers or case citations. If unsure of a number, describe the rule without citing a number.
- No hashtags, no "as an AI", no marketing fluff.`;
  const user = `Seed topic: ${seed.topic}\nAngle: ${seed.angle}\nKey fact to build on (do not quote verbatim, rewrite in your own words): ${seed.hint}\nCitation (include verbatim in body): ${seed.citation}\nSource URL (include verbatim on final "Source:" line): ${seed.url}`;
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
  const raw = String(json.choices?.[0]?.message?.content ?? "{}")
    .replace(/^```json\s*|```$/g, "").trim();
  const first = raw.indexOf("{"); const last = raw.lastIndexOf("}");
  const jsonSlice = first >= 0 && last > first ? raw.slice(first, last + 1) : "{}";
  let parsed: any;
  try { parsed = JSON.parse(jsonSlice); }
  catch { parsed = { title: `Did you know: ${seed.topic}`, body: seed.hint }; }
  let title = String(parsed.title ?? "").trim();
  if (!/^did you know[:\-]/i.test(title)) title = `Did you know: ${title || seed.topic}`;
  if (title.length > 200) title = title.slice(0, 197) + "...";
  let body = String(parsed.body ?? "").trim();
  if (body.length < 40) body = seed.hint;
  // Guarantee the citation + source URL are present even if the model omitted them.
  if (!body.includes(seed.citation)) body += `\n\nCitation: ${seed.citation}`;
  if (!body.includes(seed.url)) body += `\nSource: ${seed.url}`;
  return { title, body };
}

async function postDidYouKnow(botId: string, recentTitles: Set<string>) {
  const { data: cat, error: cErr } = await admin
    .from("forum_categories").select("id, slug, title").eq("slug", DYK_CATEGORY_SLUG).maybeSingle();
  if (cErr) throw cErr;
  if (!cat) return { skipped: true, reason: "dyk_category_missing" };

  // Rotate seed cursor across DYK_SEEDS
  const { data: state } = await admin
    .from("bot_state").select("value").eq("key", "forum_bot_dyk_cursor").maybeSingle();
  let cursor = Number(state?.value ?? 0);

  // Try up to seed-list length to find one that isn't a duplicate
  let generated: { title: string; body: string } | null = null;
  let used: { topic: string; angle: string } | null = null;
  for (let i = 0; i < DYK_SEEDS.length; i++) {
    const seed = DYK_SEEDS[(cursor + i) % DYK_SEEDS.length];
    const g = await generateDidYouKnow(seed);
    if (!isDuplicate(g.title, recentTitles)) { generated = g; used = seed; cursor = (cursor + i + 1) % DYK_SEEDS.length; break; }
    console.log("dyk duplicate, trying next seed", seed.topic);
  }
  await admin.from("bot_state").upsert({ key: "forum_bot_dyk_cursor", value: String(cursor) });

  if (!generated) return { skipped: true, reason: "dyk_all_duplicates" };
  const slug = `dyk-${slugify(generated.title)}-${Date.now().toString(36)}`;
  const { data: thread, error } = await admin
    .from("forum_threads")
    .insert({ category_id: cat.id, author_id: botId, title: generated.title, slug, body: generated.body })
    .select("id, slug").single();
  if (error) throw error;
  recentTitles.add(normalizeTitle(generated.title));
  return { source: "dyk", thread_id: thread.id, category: cat.slug, title: generated.title, seed: used };
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
    if (source === "ai" || source === "both" || source === "all") {
      try { results.push(await postAiTopic(botId, recentTitles)); }
      catch (e) { results.push({ source: "ai", error: String((e as Error).message ?? e) }); }
    }
    if (source === "faa" || source === "both" || source === "all") {
      try { results.push(await postFaaUpdate(botId, recentTitles, recentBodies)); }
      catch (e) { results.push({ source: "faa", error: String((e as Error).message ?? e) }); }
    }
    if (source === "dyk" || source === "both" || source === "all") {
      try { results.push(await postDidYouKnow(botId, recentTitles)); }
      catch (e) { results.push({ source: "dyk", error: String((e as Error).message ?? e) }); }
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
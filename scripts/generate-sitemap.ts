// Generates a sitemap index plus per-section sitemap files.
// Runs via predev/prebuild npm hooks; output goes to public/.
//
// Layout:
//   public/sitemap.xml             — <sitemapindex> pointing to the files below
//   public/sitemap-static.xml      — core marketing + app routes
//   public/sitemap-solutions.xml   — /solutions/* vertical landing pages
//   public/sitemap-portfolios.xml  — dynamic: published pilot portfolios (/u/:username)
//   public/sitemap-pilots.xml      — dynamic: pilot public profiles (/pilots/:id)
//   public/sitemap-marketplace.xml — dynamic: open service requests (/marketplace/:id)

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://dronieapp.com";
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://dcqjxdxjonvfalncywfd.supabase.co";
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "";

type Freq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
interface Entry {
  path: string;
  lastmod?: string;
  changefreq?: Freq;
  priority?: string;
}

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function renderUrlset(entries: Entry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${xmlEscape(BASE_URL + e.path)}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ].filter(Boolean).join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    ``,
  ].join("\n");
}

function renderIndex(files: { name: string; lastmod: string }[]) {
  const items = files.map((f) =>
    [
      `  <sitemap>`,
      `    <loc>${BASE_URL}/${f.name}</loc>`,
      `    <lastmod>${f.lastmod}</lastmod>`,
      `  </sitemap>`,
    ].join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...items,
    `</sitemapindex>`,
    ``,
  ].join("\n");
}

async function fetchRows<T = any>(path: string): Promise<T[]> {
  if (!SUPABASE_ANON) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    if (!res.ok) {
      console.warn(`[sitemap] ${path} → ${res.status}`);
      return [];
    }
    return (await res.json()) as T[];
  } catch (e) {
    console.warn(`[sitemap] ${path} failed:`, (e as Error).message);
    return [];
  }
}

function writeFile(name: string, body: string) {
  writeFileSync(resolve("public", name), body);
}

const today = new Date().toISOString().slice(0, 10);

// --- Static sitemaps -------------------------------------------------------

const staticEntries: Entry[] = [
  { path: "/", lastmod: today, changefreq: "weekly", priority: "1.0" },
  { path: "/auth", changefreq: "monthly" },
  { path: "/subscription", changefreq: "monthly" },
  { path: "/install", changefreq: "monthly" },
  { path: "/privacy", changefreq: "yearly" },
  { path: "/terms", changefreq: "yearly" },
  { path: "/marketplace", changefreq: "daily", priority: "0.9" },
  { path: "/pilots", changefreq: "daily", priority: "0.9" },
  { path: "/pilots/join", changefreq: "monthly", priority: "0.8" },
  { path: "/plan", changefreq: "monthly", priority: "0.7" },
  { path: "/map", changefreq: "monthly", priority: "0.7" },
  { path: "/splats", changefreq: "monthly", priority: "0.7" },
  { path: "/portfolio", changefreq: "monthly", priority: "0.7" },
  { path: "/workflow", changefreq: "monthly", priority: "0.6" },
  { path: "/swarm", changefreq: "monthly", priority: "0.6" },
  { path: "/reality", changefreq: "monthly", priority: "0.6" },
  { path: "/rtk", changefreq: "monthly", priority: "0.6" },
  { path: "/insights", changefreq: "monthly", priority: "0.6" },
  { path: "/compliance", changefreq: "monthly", priority: "0.6" },
  { path: "/fleet", changefreq: "monthly", priority: "0.6" },
  { path: "/jobs", changefreq: "weekly", priority: "0.5" },
];

const solutionEntries: Entry[] = [
  "construction",
  "real_estate",
  "agriculture",
  "energy",
  "mining",
  "insurance",
  "government",
].map((v) => ({ path: `/solutions/${v}`, changefreq: "monthly", priority: "0.7" }));

// --- Dynamic sitemaps ------------------------------------------------------

async function main() {
  const [portfolios, pilots, marketplace] = await Promise.all([
    fetchRows<{ username: string; updated_at?: string }>(
      "profiles?select=username,updated_at&portfolio_published=eq.true&username=not.is.null&order=updated_at.desc&limit=10000",
    ),
    fetchRows<{ id: string; updated_at?: string }>(
      "pilot_profiles?select=id,updated_at&available=eq.true&show_on_map=eq.true&order=updated_at.desc&limit=10000",
    ),
    fetchRows<{ id: string; updated_at?: string }>(
      "service_requests?select=id,updated_at&status=eq.open&order=updated_at.desc&limit=10000",
    ),
  ]);

  const portfolioEntries: Entry[] = portfolios.flatMap((p) => {
    const lm = (p.updated_at || "").slice(0, 10) || today;
    return [
      { path: `/u/${p.username}`, lastmod: lm, changefreq: "weekly", priority: "0.7" },
      { path: `/u/${p.username}/photos`, lastmod: lm, changefreq: "weekly", priority: "0.5" },
      { path: `/u/${p.username}/videos`, lastmod: lm, changefreq: "weekly", priority: "0.5" },
    ];
  });

  const pilotEntries: Entry[] = pilots.map((p) => ({
    path: `/pilots/${p.id}`,
    lastmod: (p.updated_at || "").slice(0, 10) || today,
    changefreq: "weekly",
    priority: "0.5",
  }));

  const marketplaceEntries: Entry[] = marketplace.map((r) => ({
    path: `/marketplace/${r.id}`,
    lastmod: (r.updated_at || "").slice(0, 10) || today,
    changefreq: "daily",
    priority: "0.5",
  }));

  writeFile("sitemap-static.xml", renderUrlset(staticEntries));
  writeFile("sitemap-solutions.xml", renderUrlset(solutionEntries));
  writeFile("sitemap-portfolios.xml", renderUrlset(portfolioEntries));
  writeFile("sitemap-pilots.xml", renderUrlset(pilotEntries));
  writeFile("sitemap-marketplace.xml", renderUrlset(marketplaceEntries));

  const index = renderIndex([
    { name: "sitemap-static.xml", lastmod: today },
    { name: "sitemap-solutions.xml", lastmod: today },
    { name: "sitemap-portfolios.xml", lastmod: today },
    { name: "sitemap-pilots.xml", lastmod: today },
    { name: "sitemap-marketplace.xml", lastmod: today },
  ]);
  writeFile("sitemap.xml", index);

  console.log(
    `[sitemap] static=${staticEntries.length} solutions=${solutionEntries.length} ` +
      `portfolios=${portfolioEntries.length} pilots=${pilotEntries.length} ` +
      `marketplace=${marketplaceEntries.length}`,
  );
}

main().catch((e) => {
  console.error("[sitemap] generation failed:", e);
  process.exit(0); // don't break dev/build if Supabase is unreachable
});
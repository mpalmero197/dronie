// Portfolio appearance customization presets and helpers.
// Stored as JSON in profiles.theme and applied at render time on
// the public portfolio page.

export type PortfolioLayout = "cinematic" | "editorial" | "grid";
export type PortfolioFontPair = "modern" | "editorial" | "mono" | "humanist";
export type PortfolioColorSwatch =
  | "forest" | "midnight" | "sunset" | "ocean" | "rose" | "mono" | "noir" | "bone";

export type PortfolioHeroKind = "none" | "image" | "video" | "slideshow";
export type PortfolioHeroAlign = "left" | "center";
export type PortfolioHeroSlideMode = "kenburns" | "fade";

export interface PortfolioHero {
  /** What the immersive hero shows. `none` = fall back to the legacy banner hero. */
  kind: PortfolioHeroKind;
  /** Direct .mp4/.webm URL when kind === "video". */
  videoUrl?: string | null;
  /** Optional poster frame for the video (also used as LCP image). */
  posterUrl?: string | null;
  /** Portfolio item IDs to cycle through when kind === "slideshow". */
  slideshowItemIds?: string[];
  /** Animation style for slideshow images. */
  slideshowMode?: PortfolioHeroSlideMode;
  /** ms per slide for the slideshow. */
  slideshowIntervalMs?: number;
  /** 0–1 darkness over the media so headline copy stays legible. */
  overlayOpacity?: number;
  /** Headline alignment over the hero. */
  align?: PortfolioHeroAlign;
  /** Show the animated scroll cue at the bottom. */
  showScrollCue?: boolean;
  /** Enable the Apple-style pinned/scroll-driven sections below the hero. */
  scrollyActs?: boolean;
}

export const DEFAULT_HERO: PortfolioHero = {
  kind: "none",
  videoUrl: null,
  posterUrl: null,
  slideshowItemIds: [],
  slideshowMode: "kenburns",
  slideshowIntervalMs: 4500,
  overlayOpacity: 0.35,
  align: "left",
  showScrollCue: true,
  scrollyActs: true,
};

export interface PortfolioTheme {
  layout: PortfolioLayout;
  font: PortfolioFontPair;
  swatch: PortfolioColorSwatch;
  /** Optional custom accent override; when set, takes precedence over swatch accent. */
  accent?: string | null;
  /** Hide the auto-generated blurred backdrop in the hero. */
  hideBackdrop?: boolean;
  /** Cinematic hero reel/video/slideshow configuration. */
  hero?: PortfolioHero;
}

export const DEFAULT_THEME: PortfolioTheme = {
  layout: "cinematic",
  font: "modern",
  swatch: "forest",
  accent: null,
  hideBackdrop: false,
  hero: { ...DEFAULT_HERO },
};

export const LAYOUTS: { id: PortfolioLayout; label: string; description: string }[] = [
  { id: "cinematic", label: "Cinematic", description: "Big hero with blurred backdrop. Best for moody aerial work." },
  { id: "editorial", label: "Editorial", description: "Magazine-style left-aligned hero. Tall display type, lots of breathing room." },
  { id: "grid", label: "Grid-first", description: "Compact hero, media grid front and center." },
];

export const FONT_PAIRS: {
  id: PortfolioFontPair;
  label: string;
  display: string;
  body: string;
  preview: string;
}[] = [
  { id: "modern",    label: "Modern",    display: "'Space Grotesk', system-ui, sans-serif", body: "'Inter', system-ui, sans-serif",        preview: "Aa" },
  { id: "editorial", label: "Editorial", display: "'Playfair Display', Georgia, serif",     body: "'Inter', system-ui, sans-serif",        preview: "Aa" },
  { id: "humanist",  label: "Humanist",  display: "'Fraunces', Georgia, serif",             body: "'Manrope', system-ui, sans-serif",      preview: "Aa" },
  { id: "mono",      label: "Technical", display: "'JetBrains Mono', ui-monospace, monospace", body: "'Inter', system-ui, sans-serif",     preview: "Aa" },
];

/**
 * Color swatches use HSL strings (no `hsl(...)` wrapper) so they
 * can be assigned directly to CSS custom properties consumed via
 * `hsl(var(--foo))` elsewhere.
 */
export const SWATCHES: {
  id: PortfolioColorSwatch;
  label: string;
  accent: string;     // hsl values
  bg: string;
  surface: string;
  text: string;
  muted: string;
}[] = [
  { id: "forest",   label: "Forest",   accent: "152 60% 38%", bg: "150 30% 6%",  surface: "152 25% 10%", text: "150 20% 96%", muted: "150 12% 65%" },
  { id: "midnight", label: "Midnight", accent: "210 95% 60%", bg: "222 47% 6%",  surface: "222 35% 10%", text: "210 30% 96%", muted: "215 18% 65%" },
  { id: "sunset",   label: "Sunset",   accent: "22 95% 58%",  bg: "20 25% 7%",   surface: "20 22% 11%",  text: "30 30% 96%",  muted: "25 14% 65%" },
  { id: "ocean",    label: "Ocean",    accent: "188 90% 48%", bg: "200 50% 6%",  surface: "200 38% 10%", text: "190 30% 96%", muted: "200 16% 66%" },
  { id: "rose",     label: "Rose",     accent: "340 85% 62%", bg: "340 25% 7%",  surface: "340 22% 11%", text: "340 25% 97%", muted: "340 10% 66%" },
  { id: "mono",     label: "Mono",     accent: "0 0% 92%",    bg: "0 0% 6%",     surface: "0 0% 10%",    text: "0 0% 96%",    muted: "0 0% 62%" },
  { id: "noir",     label: "Noir",     accent: "38 95% 60%",  bg: "0 0% 4%",     surface: "0 0% 8%",     text: "40 12% 95%",  muted: "40 8% 60%" },
  { id: "bone",     label: "Bone",     accent: "20 25% 18%",  bg: "36 28% 94%",  surface: "36 22% 88%",  text: "20 18% 12%",  muted: "20 8% 38%" },
];

export function normalizeTheme(raw: any): PortfolioTheme {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_THEME };
  const t = raw as Partial<PortfolioTheme>;
  return {
    layout: (LAYOUTS.find((l) => l.id === t.layout)?.id) ?? DEFAULT_THEME.layout,
    font:   (FONT_PAIRS.find((f) => f.id === t.font)?.id) ?? DEFAULT_THEME.font,
    swatch: (SWATCHES.find((s) => s.id === t.swatch)?.id) ?? DEFAULT_THEME.swatch,
    accent: typeof t.accent === "string" && t.accent.trim() ? t.accent : null,
    hideBackdrop: !!t.hideBackdrop,
    hero: normalizeHero((t as any).hero),
  };
}

export function normalizeHero(raw: any): PortfolioHero {
  const base = { ...DEFAULT_HERO };
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PortfolioHero>;
  const kind: PortfolioHeroKind =
    r.kind === "image" || r.kind === "video" || r.kind === "slideshow" ? r.kind : "none";
  return {
    kind,
    videoUrl: typeof r.videoUrl === "string" ? r.videoUrl : null,
    posterUrl: typeof r.posterUrl === "string" ? r.posterUrl : null,
    slideshowItemIds: Array.isArray(r.slideshowItemIds)
      ? (r.slideshowItemIds.filter((x) => typeof x === "string") as string[]).slice(0, 12)
      : [],
    slideshowMode: r.slideshowMode === "fade" ? "fade" : "kenburns",
    slideshowIntervalMs: typeof r.slideshowIntervalMs === "number"
      ? Math.min(12000, Math.max(2000, r.slideshowIntervalMs))
      : base.slideshowIntervalMs,
    overlayOpacity: typeof r.overlayOpacity === "number"
      ? Math.min(0.85, Math.max(0, r.overlayOpacity))
      : base.overlayOpacity,
    align: r.align === "center" ? "center" : "left",
    showScrollCue: r.showScrollCue !== false,
    scrollyActs: r.scrollyActs !== false,
  };
}

/** Build inline `style` props (CSS vars + font families) for a themed scope. */
export function themeStyle(theme: PortfolioTheme): React.CSSProperties {
  const swatch = SWATCHES.find((s) => s.id === theme.swatch) ?? SWATCHES[0];
  const fonts = FONT_PAIRS.find((f) => f.id === theme.font) ?? FONT_PAIRS[0];
  const accent = theme.accent ?? swatch.accent;
  return {
    // Scoped overrides — these consume the same tokens used in components.
    ["--background" as any]: swatch.bg,
    ["--foreground" as any]: swatch.text,
    ["--card" as any]: swatch.surface,
    ["--card-foreground" as any]: swatch.text,
    ["--muted" as any]: swatch.surface,
    ["--muted-foreground" as any]: swatch.muted,
    ["--secondary" as any]: swatch.surface,
    ["--secondary-foreground" as any]: swatch.text,
    ["--border" as any]: `${swatch.text.split(" ")[0]} 12% 18%`,
    ["--primary" as any]: accent,
    ["--primary-foreground" as any]: "0 0% 100%",
    ["--ring" as any]: accent,
    ["--portfolio-accent" as any]: accent,
    ["--portfolio-display-font" as any]: fonts.display,
    ["--portfolio-body-font" as any]: fonts.body,
    fontFamily: fonts.body,
  };
}

/** Inject Google Fonts <link> tags for the chosen font pair (idempotent). */
export function ensureFontLoaded(font: PortfolioFontPair) {
  if (typeof document === "undefined") return;
  const map: Record<PortfolioFontPair, string> = {
    modern: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap",
    editorial: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@600;700;900&display=swap",
    humanist: "https://fonts.googleapis.com/css2?family=Fraunces:wght@500;700;900&family=Manrope:wght@400;500;600&display=swap",
    mono: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap",
  };
  const href = map[font];
  const id = `portfolio-font-${font}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.id = id;
  document.head.appendChild(link);
}
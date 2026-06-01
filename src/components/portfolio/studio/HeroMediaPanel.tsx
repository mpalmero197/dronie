import { useRef, useState } from "react";
import {
  Film, Image as ImageIcon, Sparkles, Upload, Loader2, Trash2, X,
  AlignLeft, AlignCenter, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import HeroReel from "@/components/portfolio/HeroReel";
import type { PortfolioHero } from "@/lib/portfolioTheme";
import { DEFAULT_HERO } from "@/lib/portfolioTheme";
import type { PortfolioItem } from "@/lib/portfolio";

type HeroKind = PortfolioHero["kind"];

const KIND_OPTIONS: { id: HeroKind; label: string; help: string; icon: React.ComponentType<any> }[] = [
  { id: "video",     label: "Video / Reel", help: "Autoplay a muted loop. Best for cinematic reels.", icon: Film },
  { id: "slideshow", label: "Slideshow",    help: "Cycle 3–8 shots with a Ken Burns drift.",          icon: Sparkles },
  { id: "image",     label: "Image",        help: "Single hero still. Loads instantly.",              icon: ImageIcon },
  { id: "none",      label: "Off",          help: "Use the legacy banner hero only.",                 icon: EyeOff },
];

export default function HeroMediaPanel({
  hero,
  items,
  displayName,
  headline,
  fallbackImage,
  onPatchHero,
  uploadBlob,
  saving,
}: {
  hero: PortfolioHero;
  items: PortfolioItem[];
  displayName: string;
  headline?: string | null;
  fallbackImage: string | null;
  onPatchHero: (patch: Partial<PortfolioHero>) => void;
  uploadBlob: (blob: Blob, suffix: string, contentType: string) => Promise<{ url: string }>;
  saving?: boolean;
}) {
  const [busy, setBusy] = useState<"video" | "poster" | null>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const posterInput = useRef<HTMLInputElement>(null);

  async function onVideoFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("video/")) return;
    if (file.size > 200 * 1024 * 1024) return;
    try {
      setBusy("video");
      const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? ".mp4").toLowerCase();
      const { url } = await uploadBlob(file, `hero${ext}`, file.type);
      onPatchHero({ kind: "video", videoUrl: url });
    } finally {
      setBusy(null);
    }
  }

  async function onPosterFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 8 * 1024 * 1024) return;
    try {
      setBusy("poster");
      const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? ".jpg").toLowerCase();
      const { url } = await uploadBlob(file, `hero-poster${ext}`, file.type);
      onPatchHero({ posterUrl: url });
    } finally {
      setBusy(null);
    }
  }

  const slideIds = hero.slideshowItemIds ?? [];
  const usableItems = items.filter((i) => (i.thumb_url || i.media_url));

  function toggleSlide(id: string) {
    const next = slideIds.includes(id)
      ? slideIds.filter((x) => x !== id)
      : [...slideIds, id].slice(0, 12);
    onPatchHero({ slideshowItemIds: next });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="font-display font-700 text-lg flex items-center gap-2">
            <Film className="w-4 h-4 text-primary" /> Cinematic hero
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            The huge first impression on your public portfolio. Upload a reel, build a slideshow, or pick a single image.
          </p>
        </div>
      </div>

      {/* Kind picker */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {KIND_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = (hero.kind ?? "none") === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPatchHero({ kind: opt.id })}
              className={`text-left rounded-xl border p-3 transition-all ${
                active ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                       : "border-border hover:border-primary/40 bg-secondary/40"
              }`}
            >
              <Icon className="w-4 h-4 text-primary mb-1.5" />
              <p className="font-display font-700 text-sm">{opt.label}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{opt.help}</p>
            </button>
          );
        })}
      </div>

      {/* Per-kind controls */}
      {hero.kind === "video" && (
        <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reel</p>
              <p className="text-xs text-muted-foreground truncate max-w-md">
                {hero.videoUrl ?? "No video uploaded yet. .mp4 or .webm, up to 200 MB."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={videoInput}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => onVideoFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={busy === "video"}
                onClick={() => videoInput.current?.click()}
              >
                {busy === "video" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {hero.videoUrl ? "Replace video" : "Upload video"}
              </Button>
              {hero.videoUrl && (
                <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => onPatchHero({ videoUrl: null })}>
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Or paste a direct URL</Label>
            <Input
              type="url"
              placeholder="https://… .mp4 or .webm"
              value={hero.videoUrl ?? ""}
              onChange={(e) => onPatchHero({ videoUrl: e.target.value || null })}
            />
            <p className="text-[10px] text-muted-foreground">YouTube/Vimeo embed URLs aren't supported — use a direct file URL.</p>
          </div>
          <PosterPicker hero={hero} busy={busy === "poster"} onPick={() => posterInput.current?.click()} onClear={() => onPatchHero({ posterUrl: null })} />
          <input
            ref={posterInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPosterFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      {hero.kind === "slideshow" && (
        <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Slides ({slideIds.length}/12)
            </p>
            <div className="flex items-center gap-3">
              <label className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                Style
                <select
                  value={hero.slideshowMode ?? "kenburns"}
                  onChange={(e) => onPatchHero({ slideshowMode: e.target.value as any })}
                  className="bg-background border border-border rounded px-1.5 py-1 text-xs"
                >
                  <option value="kenburns">Ken Burns</option>
                  <option value="fade">Cross-fade</option>
                </select>
              </label>
              <label className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                {(Math.round((hero.slideshowIntervalMs ?? 4500) / 100) / 10).toFixed(1)}s
                <input
                  type="range" min={2} max={10} step={0.5}
                  value={(hero.slideshowIntervalMs ?? 4500) / 1000}
                  onChange={(e) => onPatchHero({ slideshowIntervalMs: Math.round(parseFloat(e.target.value) * 1000) })}
                />
              </label>
            </div>
          </div>
          {usableItems.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Upload portfolio photos below first, then come back here to pick which ones appear in the hero.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
              {usableItems.map((it) => {
                const order = slideIds.indexOf(it.id);
                const active = order !== -1;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggleSlide(it.id)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <img
                      src={it.thumb_url || it.media_url || ""}
                      alt={it.title ?? ""}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    {active && (
                      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {order + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {hero.kind === "image" && (
        <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
          <PosterPicker
            hero={hero}
            busy={busy === "poster"}
            onPick={() => posterInput.current?.click()}
            onClear={() => onPatchHero({ posterUrl: null })}
            label="Hero image"
          />
          <input
            ref={posterInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPosterFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-[11px] text-muted-foreground">
            Tip: 1920×1080 or larger reads best as a full-bleed hero.
          </p>
        </div>
      )}

      {/* Shared presentation controls */}
      {hero.kind !== "none" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Overlay darkness · {Math.round((hero.overlayOpacity ?? 0.35) * 100)}%
            </Label>
            <input
              type="range" min={0} max={0.85} step={0.05}
              value={hero.overlayOpacity ?? 0.35}
              onChange={(e) => onPatchHero({ overlayOpacity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Headline alignment</Label>
            <div className="flex gap-1.5">
              <Button type="button" size="sm" variant={hero.align === "left" || !hero.align ? "default" : "outline"}
                      onClick={() => onPatchHero({ align: "left" })} className="gap-1 flex-1">
                <AlignLeft className="w-3.5 h-3.5" /> Left
              </Button>
              <Button type="button" size="sm" variant={hero.align === "center" ? "default" : "outline"}
                      onClick={() => onPatchHero({ align: "center" })} className="gap-1 flex-1">
                <AlignCenter className="w-3.5 h-3.5" /> Center
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Behaviour</Label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={hero.showScrollCue !== false} onCheckedChange={(v) => onPatchHero({ showScrollCue: v })} />
              Show scroll cue
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={hero.scrollyActs !== false} onCheckedChange={(v) => onPatchHero({ scrollyActs: v })} />
              Apple-style scroll reveals
            </label>
          </div>
        </div>
      )}

      {/* Live preview */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <Eye className="w-3.5 h-3.5" /> Live preview
        </div>
        <div className="rounded-2xl overflow-hidden border border-border" style={{ height: 360 }}>
          {hero.kind === "none" ? (
            <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground bg-secondary/40">
              Cinematic hero is off — your portfolio will use the classic banner.
            </div>
          ) : (
            <div className="w-full h-full relative">
              <HeroReel
                hero={hero}
                items={items}
                fallbackImage={fallbackImage}
                displayName={displayName}
                headline={headline ?? null}
                kicker="Cinematic preview"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PosterPicker({
  hero, busy, onPick, onClear, label = "Poster frame (LCP)",
}: {
  hero: PortfolioHero;
  busy?: boolean;
  onPick: () => void;
  onClear: () => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div
        className="w-24 h-14 rounded-md border border-border bg-secondary overflow-hidden flex-shrink-0"
        style={hero.posterUrl ? { backgroundImage: `url(${hero.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        {!hero.posterUrl && <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">No poster</div>}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">Shown while video buffers, on slow connections, and as social preview.</p>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onPick} className="gap-1.5">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {hero.posterUrl ? "Replace" : "Upload"}
        </Button>
        {hero.posterUrl && (
          <Button type="button" size="sm" variant="ghost" onClick={onClear} className="gap-1.5">
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
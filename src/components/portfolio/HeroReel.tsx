import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Volume2, VolumeX, Play } from "lucide-react";
import type { PortfolioHero } from "@/lib/portfolioTheme";
import type { PortfolioItem } from "@/lib/portfolio";

/**
 * Full-bleed cinematic hero — autoplays the pilot's reel, slideshow, or
 * hero image. Scroll-bound parallax + fade keeps the hero feeling "alive"
 * as the viewer scrolls into the rest of the page (Apple-style).
 */
export default function HeroReel({
  hero,
  fallbackImage,
  items,
  displayName,
  headline,
  kicker,
  children,
}: {
  hero: PortfolioHero;
  fallbackImage: string | null;
  items: PortfolioItem[];
  displayName: string;
  headline?: string | null;
  kicker?: string | null;
  children?: React.ReactNode;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0..1 across the hero's height
  const [muted, setMuted] = useState(true);
  const [showPlayHint, setShowPlayHint] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Scroll-bound progress for parallax + fade.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = sectionRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const total = r.height;
        const scrolled = Math.min(Math.max(-r.top, 0), total);
        setProgress(total > 0 ? scrolled / total : 0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Pause the video when off-screen (battery + bandwidth friendly).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) v.play().catch(() => setShowPlayHint(true));
          else v.pause();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [hero.videoUrl, hero.kind]);

  const overlay = Math.max(0, Math.min(0.85, hero.overlayOpacity ?? 0.35));
  const align = hero.align === "center" ? "items-center text-center" : "items-start text-left";
  // Parallax + cinematic fade
  const mediaStyle: React.CSSProperties = {
    transform: `translate3d(0, ${progress * 80}px, 0) scale(${1 + progress * 0.08})`,
    opacity: 1 - progress * 0.4,
  };
  const copyStyle: React.CSSProperties = {
    transform: `translate3d(0, ${progress * -40}px, 0)`,
    opacity: 1 - progress * 1.4,
  };

  return (
    <section
      ref={sectionRef}
      className="relative w-full h-[100svh] min-h-[560px] overflow-hidden bg-black"
    >
      <div className="absolute inset-0" style={mediaStyle}>
        {hero.kind === "video" && hero.videoUrl ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            src={hero.videoUrl}
            poster={hero.posterUrl ?? fallbackImage ?? undefined}
            autoPlay
            muted={muted}
            loop
            playsInline
            preload="metadata"
          />
        ) : hero.kind === "slideshow" ? (
          <HeroSlideshow hero={hero} items={items} fallback={fallbackImage} />
        ) : hero.kind === "image" && (hero.posterUrl || fallbackImage) ? (
          <img
            src={hero.posterUrl || fallbackImage || ""}
            alt=""
            aria-hidden
            className="w-full h-full object-cover portfolio-kenburns"
          />
        ) : fallbackImage ? (
          <img
            src={fallbackImage}
            alt=""
            aria-hidden
            className="w-full h-full object-cover portfolio-kenburns"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/40 via-background to-background" />
        )}
      </div>

      {/* Scrims — top vignette for header legibility, bottom blend into page */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `rgba(0,0,0,${overlay})` }}
        aria-hidden
      />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background via-background/70 to-transparent pointer-events-none" aria-hidden />

      {/* Copy */}
      <div
        className={`absolute inset-0 flex flex-col justify-end ${align} px-6 sm:px-10 pb-24 sm:pb-32 max-w-7xl mx-auto`}
        style={copyStyle}
      >
        <div className={`max-w-3xl ${hero.align === "center" ? "mx-auto" : ""}`}>
          {kicker && (
            <p className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.3em] text-white/80 mb-3 sm:mb-5">
              {kicker}
            </p>
          )}
          <h1
            className="font-700 text-white text-5xl sm:text-7xl xl:text-8xl leading-[0.92] tracking-tight drop-shadow-[0_6px_30px_rgba(0,0,0,0.6)]"
            style={{ fontFamily: "var(--portfolio-display-font)" }}
          >
            {displayName}
          </h1>
          {headline && (
            <p className="mt-5 sm:mt-7 text-base sm:text-xl text-white/90 max-w-2xl leading-snug drop-shadow-md">
              {headline}
            </p>
          )}
          {children && <div className="mt-7 sm:mt-9">{children}</div>}
        </div>
      </div>

      {/* Hero controls */}
      {hero.kind === "video" && hero.videoUrl && (
        <div className="absolute top-5 right-5 sm:top-7 sm:right-7 flex items-center gap-2 z-10">
          {showPlayHint && (
            <button
              type="button"
              onClick={() => videoRef.current?.play().then(() => setShowPlayHint(false)).catch(() => {})}
              className="rounded-full bg-white/15 hover:bg-white/25 backdrop-blur text-white p-2.5 transition"
              aria-label="Play hero reel"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="rounded-full bg-white/15 hover:bg-white/25 backdrop-blur text-white p-2.5 transition"
            aria-label={muted ? "Unmute hero reel" : "Mute hero reel"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Scroll cue */}
      {hero.showScrollCue !== false && (
        <div
          className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-1 text-white/70 pointer-events-none"
          style={{ opacity: Math.max(0, 1 - progress * 4) }}
          aria-hidden
        >
          <span className="text-[10px] font-mono uppercase tracking-[0.3em]">Scroll</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </div>
      )}
    </section>
  );
}

function HeroSlideshow({
  hero,
  items,
  fallback,
}: {
  hero: PortfolioHero;
  items: PortfolioItem[];
  fallback: string | null;
}) {
  const sources = useMemo(() => {
    const ids = hero.slideshowItemIds ?? [];
    const byId = new Map(items.map((i) => [i.id, i]));
    const urls = ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((it) => it!.thumb_url || it!.media_url)
      .filter((u): u is string => !!u);
    if (urls.length) return urls;
    // Fallback: first 5 viable items, then the banner image.
    const auto = items
      .filter((i) => i.kind !== "video" && (i.thumb_url || i.media_url))
      .slice(0, 5)
      .map((i) => (i.thumb_url || i.media_url) as string);
    return auto.length ? auto : fallback ? [fallback] : [];
  }, [hero.slideshowItemIds, items, fallback]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (sources.length < 2) return;
    const t = window.setInterval(
      () => setIdx((i) => (i + 1) % sources.length),
      Math.max(2000, hero.slideshowIntervalMs ?? 4500),
    );
    return () => window.clearInterval(t);
  }, [sources.length, hero.slideshowIntervalMs]);

  if (sources.length === 0) {
    return <div className="w-full h-full bg-gradient-to-br from-primary/30 via-background to-background" />;
  }

  const mode = hero.slideshowMode === "fade" ? "fade" : "kenburns";

  return (
    <div className="absolute inset-0">
      {sources.map((src, i) => {
        const active = i === idx;
        return (
          <img
            key={src + i}
            src={src}
            alt=""
            aria-hidden
            loading={i === 0 ? "eager" : "lazy"}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms] ${
              active ? "opacity-100" : "opacity-0"
            } ${mode === "kenburns" && active ? "portfolio-kenburns" : ""}`}
          />
        );
      })}
    </div>
  );
}
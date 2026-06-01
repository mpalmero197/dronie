
## Goal
Turn the public portfolio (`/u/:username`) into a cinematic, Apple-style first impression: a full-bleed hero where the pilot's own video / reel / slideshow plays, followed by scroll-driven sections where featured work pins, scales, fades, and parallaxes into view as the user scrolls.

## What the pilot sees (Portfolio Studio)
Add a new **Hero Media** block in `PortfolioStudio.tsx`, right above the existing "Hero banner" control:

- Choose hero type: **Video / Reel** · **Slideshow** · **Image** (existing banner is the fallback).
- Video / Reel: upload an .mp4/.webm (or paste a Vimeo/YouTube/MUX URL). Stored in `portfolio-media` bucket. Autoplays muted, loops, with a poster frame.
- Slideshow: pick 3–8 existing portfolio items; choose Ken Burns (slow pan/zoom) or Cross-fade, plus interval (3–7s).
- Controls: mute toggle default, "Show scroll cue", overlay darkness slider, headline alignment (left/center).
- Live preview pane on the right shows the current selection at the chosen aspect.

New profile fields (single migration on `profiles`):
`hero_kind` (`video|slideshow|image|none`), `hero_video_url`, `hero_poster_url`, `hero_slideshow_item_ids uuid[]`, `hero_slideshow_mode` (`kenburns|fade`), `hero_slideshow_interval_ms`, `hero_overlay_opacity`, `hero_align`, `hero_show_scroll_cue`.

## What the visitor sees (PublicPortfolio)
Rebuild the top of `PublicPortfolio.tsx` into a sequence of scroll-pinned "acts". All three existing layouts (cinematic / editorial / grid) get the new hero; the scrollytelling acts only render on `cinematic` and `editorial` to keep `grid` snappy.

```text
┌─────────────────────────────────────┐
│ ACT 1  HERO REEL (100vh, full-bleed)│  video/slideshow/image
│   • Pilot name fades in, then out   │
│   • Scroll cue pulses                │
├─────────────────────────────────────┤
│ ACT 2  IDENTITY CARD (pins ~80vh)   │  current glass card, now
│   • Headline scales 0.9 → 1         │  pinned with parallax bg
│   • Avatar + bio + Hire CTA         │
├─────────────────────────────────────┤
│ ACT 3  FEATURED MOSAIC (pins)       │  3–5 featured items reveal
│   • Each item slides + scales in    │  one at a time on scroll
│   • Active item title pinned left   │
├─────────────────────────────────────┤
│ ACT 4  STATS / NUMBERS (sticky)     │  shots, flight hrs, regions
│   • Counters tick up on enter        │
├─────────────────────────────────────┤
│ ACT 5  ALBUMS RAIL (horizontal)     │  horizontal scroll bound to
│   • Translate X with vertical scroll│  vertical scroll (Apple-style)
├─────────────────────────────────────┤
│ ACT 6  FULL GRID (existing)         │  current photos/videos grid
└─────────────────────────────────────┘
```

Built with `framer-motion` (already in deps) using `useScroll` + `useTransform` and a `<MotionConfig reducedMotion="user">` so users with reduced-motion settings get a static stacked layout. Each act is a self-contained component to keep `PublicPortfolio.tsx` from growing further.

## Components to add
- `src/components/portfolio/hero/HeroReel.tsx` — renders video, slideshow, or image based on `hero_kind`; handles autoplay/mute/IntersectionObserver pause.
- `src/components/portfolio/hero/HeroSlideshow.tsx` — Ken Burns + cross-fade engine.
- `src/components/portfolio/scroll/PinnedIdentity.tsx` — Act 2.
- `src/components/portfolio/scroll/FeaturedMosaic.tsx` — Act 3, pinned section with sequential reveals.
- `src/components/portfolio/scroll/StatsTicker.tsx` — Act 4.
- `src/components/portfolio/scroll/HorizontalAlbums.tsx` — Act 5.
- `src/components/portfolio/studio/HeroMediaPanel.tsx` — new Studio editor block.

## Files to edit
- `supabase/migrations/<new>.sql` — add hero_* columns to `profiles`.
- `src/pages/PortfolioStudio.tsx` — mount `HeroMediaPanel`, save new fields, extend preview.
- `src/pages/PublicPortfolio.tsx` — replace current hero block with the act sequence; keep all existing modes/CTAs/SEO intact.
- `src/components/portfolio/PortfolioPolish.tsx` — keep `FilmHud` for cinematic layout, reuse inside Act 1.

## Performance & polish
- Mobile (≤640px): drop pinning, swap to fade-in sections, keep hero video but force `playsInline` + poster-first paint.
- Preload only the hero poster + first featured item; lazy-load the rest.
- Respect `prefers-reduced-motion`.
- Cap hero video to 1080p; show poster while loading.
- Keep current SEO `<title>`, JSON-LD, OG tags untouched.

## Out of scope (this pass)
- Transcoding / Mux integration (just direct file or paste-URL).
- Editing the reel inside the studio (use existing Video Editor for that).
- Audio tracks behind slideshows.

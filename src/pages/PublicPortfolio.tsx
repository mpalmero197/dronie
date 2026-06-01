import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, MapPin, Globe, Instagram, ImageIcon, Film, Sparkles,
  Loader2, Lock, ExternalLink, Camera, Eye, EyeOff, Link2,
  Linkedin, Twitter, Youtube, Music2, FileText, Mail,
  AlertTriangle, RefreshCw, LifeBuoy, User as UserIcon,
  Phone, BadgeCheck, Send, CircleDot, ChevronLeft, ChevronRight,
  Play, Zap, Clock, Award, X as XIcon,
} from "lucide-react";
import {
  fetchPortfolioByUsername, fetchPublicAlbumsByUser, fetchPublicItemsByUser,
  fetchAlbumBySlug, fetchItemsForAlbum,
  normalizePrefs,
  type PortfolioProfile, type PortfolioAlbum, type PortfolioItem,
} from "@/lib/portfolio";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_THEME, ensureFontLoaded, normalizeTheme, themeStyle,
} from "@/lib/portfolioTheme";
import {
  ScrollProgressBar,
  MarqueeTape,
  FilmHud,
  MagneticHireButton,
  SectionDots,
  ProcessStrip,
  EditorialHeading,
} from "@/components/portfolio/PortfolioPolish";
import HireInquiryDialog from "@/components/portfolio/HireInquiryDialog";
import PortfolioSeo from "@/components/seo/PortfolioSeo";
import HeroReel from "@/components/portfolio/HeroReel";
import ScrollReveal from "@/components/portfolio/ScrollReveal";

type Mode = "home" | "photos" | "videos" | "album";

interface Props { mode: Mode }

function PortfolioSkeleton({ mode }: { mode: Mode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20 hidden sm:block" />
          </div>
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-6 sm:pb-10">
        <div className="flex flex-col sm:flex-row sm:items-end gap-5 sm:gap-6">
          <Skeleton className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-3">
            <Skeleton className="h-8 sm:h-10 w-2/3 max-w-xs" />
            <Skeleton className="h-4 w-1/2 max-w-[200px]" />
            <div className="flex flex-wrap gap-2 pt-1">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
          </div>
        </div>
        <div className="mt-5 space-y-2 max-w-2xl">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </section>

      {/* Albums grid (only on home) */}
      {mode === "home" && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
          <Skeleton className="h-5 w-24 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border overflow-hidden">
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Media grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <Skeleton className="h-5 w-28 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      </section>
    </div>
  );
}

export default function PublicPortfolio({ mode }: Props) {
  const { username, slug } = useParams<{ username: string; slug?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState<PortfolioProfile | null>(null);
  const [albums, setAlbums] = useState<PortfolioAlbum[]>([]);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [allItems, setAllItems] = useState<PortfolioItem[]>([]);
  const [album, setAlbum] = useState<PortfolioAlbum | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);

  const theme = useMemo(() => normalizeTheme(profile?.theme ?? null), [profile?.theme]);
  useEffect(() => { ensureFontLoaded(theme.font); }, [theme.font]);

  // Show floating Hire CTA after the user scrolls past the hero.
  useEffect(() => {
    const onScroll = () => setShowStickyCta(window.scrollY > 480);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!username) return;
      setLoading(true); setNotFound(false); setLoadError(null);
      try {
        const p = await fetchPortfolioByUsername(username);
        if (cancelled) return;
        if (!p) { setNotFound(true); setLoading(false); return; }
        setProfile(p);
        const isOwner = !!user && user.id === p.id;

        if (mode === "home") {
          const [a, i] = await Promise.all([
            fetchPublicAlbumsByUser(p.id, isOwner),
            fetchPublicItemsByUser(p.id, undefined, isOwner),
          ]);
          if (!cancelled) { setAlbums(a); setAllItems(i); setItems(i.slice(0, 12)); }
        } else if (mode === "photos") {
          const i = await fetchPublicItemsByUser(p.id, "photo", isOwner);
          if (!cancelled) setItems(i);
        } else if (mode === "videos") {
          const i = await fetchPublicItemsByUser(p.id, "video", isOwner);
          if (!cancelled) setItems(i);
        } else if (mode === "album" && slug) {
          const al = await fetchAlbumBySlug(p.id, slug);
          if (!al) { setNotFound(true); setLoading(false); return; }
          setAlbum(al);
          const i = await fetchItemsForAlbum(al.id);
          if (!cancelled) setItems(i);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Something went wrong while loading this portfolio.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [username, slug, mode, user?.id, retryCount]);

  // Per-route head (title, description, OG, JSON-LD) is rendered below
  // via <PortfolioSeo /> once the profile has loaded.

  if (loading) {
    return <PortfolioSkeleton mode={mode} />;
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-destructive" />
        </div>
        <h1 className="font-display font-700 text-2xl mb-1">We couldn't load this portfolio</h1>
        <p className="text-sm text-muted-foreground mb-1 max-w-md">
          Something went wrong on our end. This is usually temporary — please try again in a moment.
        </p>
        <p className="text-[11px] font-mono text-muted-foreground/70 mb-5 max-w-md break-words">
          {loadError}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => setRetryCount((n) => n + 1)} className="gap-1.5">
            <RefreshCw className="w-4 h-4" /> Try again
          </Button>
          {user ? (
            <Link to="/portfolio">
              <Button variant="outline" className="gap-1.5">
                <UserIcon className="w-4 h-4" /> Back to my profile
              </Button>
            </Link>
          ) : (
            <Link to="/auth">
              <Button variant="outline" className="gap-1.5">
                <UserIcon className="w-4 h-4" /> Sign in
              </Button>
            </Link>
          )}
          <a href="mailto:mpalmero@dronieapp.com?subject=Portfolio%20failed%20to%20load">
            <Button variant="ghost" className="gap-1.5">
              <LifeBuoy className="w-4 h-4" /> Contact support
            </Button>
          </a>
        </div>
        <Link to="/" className="mt-6 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Back home
        </Link>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <Lock className="w-10 h-10 text-muted-foreground mb-3" />
        <h1 className="font-display font-700 text-2xl mb-1">Portfolio not found</h1>
        <p className="text-sm text-muted-foreground mb-5">
          This portfolio is private, doesn't exist yet, or the link is wrong.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => navigate("/")} variant="outline" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Go home
          </Button>
          {user && (
            <Link to="/portfolio">
              <Button variant="outline" className="gap-1.5">
                <UserIcon className="w-4 h-4" /> My profile
              </Button>
            </Link>
          )}
          <a href="mailto:mpalmero@dronieapp.com?subject=Portfolio%20not%20found">
            <Button variant="ghost" className="gap-1.5">
              <LifeBuoy className="w-4 h-4" /> Contact support
            </Button>
          </a>
        </div>
      </div>
    );
  }

  const displayName = profile.full_name || profile.username || "Pilot";
  const isOwner = !!user && user.id === profile.id;
  const isUnpublished = !profile.portfolio_published;
  const banner = profile.banner_url ?? null;
  const layout = theme.layout;
  const prefs = normalizePrefs(profile.visibility_prefs);

  const hasAnySocial =
    !!profile.instagram || !!profile.linkedin || !!profile.twitter ||
    !!profile.youtube || !!profile.vimeo || !!profile.tiktok;

  const hireEmail = profile.contact_email || null;
  const formattedRate =
    typeof profile.hourly_rate_cents === "number" && profile.hourly_rate_cents > 0
      ? `$${Math.round(profile.hourly_rate_cents / 100).toLocaleString()}/hr`
      : null;

  // Build the kinetic-typography marquee from real profile data so it
  // never feels like filler. Falls back gracefully when fields are empty.
  const marqueeItems: string[] = (() => {
    const out: string[] = [];
    (profile.services ?? []).filter(Boolean).slice(0, 6).forEach((s) => out.push(s));
    if (prefs.show_location && profile.location) out.push(profile.location);
    if (profile.available_for_hire && prefs.show_availability) out.push("Available for hire");
    out.push("Aerial cinematography");
    out.push("Drone photogrammetry");
    return Array.from(new Set(out)).slice(0, 10);
  })();

  // Sections used by the right-side dot rail. Only included when present.
  const dotSections: { id: string; label: string }[] = [];
  if (mode === "home") {
    dotSections.push({ id: "intro", label: "Intro" });
    if (allItems.length > 0) dotSections.push({ id: "featured", label: "Featured" });
    if (allItems.length > 0) dotSections.push({ id: "process", label: "Process" });
    if (albums.length > 0) dotSections.push({ id: "albums", label: "Albums" });
    dotSections.push({ id: "work", label: "Work" });
  }

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={themeStyle(theme)}
    >
      <PortfolioSeo
        profile={profile}
        mode={mode}
        album={album}
        items={items}
        published={!!profile.portfolio_published}
      />
      <ScrollProgressBar />
      {mode === "home" && <SectionDots sections={dotSections} />}
      {isOwner && isUnpublished && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <EyeOff className="w-4 h-4" />
              Preview mode — your portfolio is unpublished. Only you can see this page.
            </span>
            <Link to="/portfolio?publish=1#publish-toggle">
              <Button size="sm" className="h-7 gap-1.5 bg-amber-500 hover:bg-amber-400 text-amber-950">
                <Eye className="w-3.5 h-3.5" /> Publish now
              </Button>
            </Link>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link to={`/u/${profile.username}`} className="flex items-center gap-2 min-w-0">
            <Camera className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-display font-700 truncate">{displayName}</span>
            <span className="text-muted-foreground text-sm truncate">@{profile.username}</span>
          </Link>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            Powered by <span className="font-display font-700 text-foreground">Dronie</span>
          </Link>
        </div>
      </header>

      {/* Hero / about */}
      {mode === "home" && (
        <div id="intro">
          {theme.hero && theme.hero.kind !== "none" && (
            <HeroReel
              hero={theme.hero}
              fallbackImage={banner || profile.avatar_url}
              items={allItems}
              displayName={displayName}
              headline={profile.headline}
              kicker={`Aerial portfolio · @${profile.username}`}
            >
              {prefs.show_hire_cta && hireEmail && (
                <Button
                  size="lg"
                  className="gap-1.5 shadow-2xl shadow-primary/30"
                  onClick={() => setHireOpen(true)}
                >
                  Hire {profile.full_name?.split(" ")[0] || displayName}
                </Button>
              )}
            </HeroReel>
          )}
          <PortfolioHero
            profile={profile}
            prefs={prefs}
            layout={layout}
            theme={theme}
            banner={banner}
            items={items}
            albums={albums}
            displayName={displayName}
            formattedRate={formattedRate}
            hireEmail={hireEmail}
            hasAnySocial={hasAnySocial}
            allItemsCount={allItems.length}
            onHireClick={() => setHireOpen(true)}
          />
        </div>
      )}

      {/* Kinetic typography ribbon — sits flush against the hero. */}
      {mode === "home" && marqueeItems.length > 0 && (
        <MarqueeTape items={marqueeItems} />
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {(mode === "photos" || mode === "videos" || mode === "album") && (
          <div>
            <Link to={`/u/${profile.username}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
              <ArrowLeft className="w-4 h-4" /> Back to portfolio
            </Link>
            <h2 className="font-display font-700 text-2xl">
              {mode === "photos" && "Photos"}
              {mode === "videos" && "Videos"}
              {mode === "album" && album?.title}
            </h2>
            {mode === "album" && album?.description && (
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl whitespace-pre-line">{album.description}</p>
            )}
          </div>
        )}

        {/* Stats strip — only on home, only when there's something to brag about */}
        {mode === "home" && allItems.length > 0 && (
          <StatsStrip
            photos={allItems.filter((i) => i.kind === "photo").length}
            videos={allItems.filter((i) => i.kind === "video").length}
            albums={albums.length}
            available={!!profile.available_for_hire && prefs.show_availability}
          />
        )}

        {/* Featured reel — one large hero piece on top of the grid */}
        {mode === "home" && items.length > 0 && (
          <div id="featured" className="scroll-mt-24">
            <FeaturedReel item={items[0]} onOpen={setLightbox} />
          </div>
        )}

        {/* Process strip — subtle social proof of professionalism. */}
        {mode === "home" && allItems.length > 0 && (
          <section id="process" className="space-y-5 scroll-mt-24">
            <EditorialHeading
              index="01"
              eyebrow="How I work"
              title="From brief to broadcast-ready"
              subtitle="A repeatable, FAA-compliant process so every shoot lands on time and on spec."
            />
            <ProcessStrip />
          </section>
        )}

        {/* Albums grid (home only) */}
        {mode === "home" && albums.length > 0 && (
          <section id="albums" className="space-y-4 scroll-mt-24">
            <SectionHeading
              eyebrow="Collections"
              title="Albums"
              subtitle="Curated bodies of work"
              right={`${albums.length} ${albums.length === 1 ? "album" : "albums"}`}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {albums.map((a) => {
                const cover = a.cover_url || autoCover(a.id, allItems);
                const count = allItems.filter((i) => i.album_id === a.id).length;
                return (
                <Link
                  key={a.id}
                  to={`/u/${profile.username}/album/${a.slug}`}
                  className="group rounded-2xl border border-border overflow-hidden bg-card hover:border-primary/60 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300"
                >
                  <div className="aspect-[4/3] bg-secondary relative overflow-hidden">
                    {cover ? (
                      <img src={cover} alt={a.title} className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-[1200ms]" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    {count > 0 && (
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur text-white text-[10px] font-medium border border-white/15">
                        <ImageIcon className="w-3 h-3" /> {count}
                      </span>
                    )}
                    {a.visibility !== "public" && (
                      <div className="absolute top-2 right-2">
                        <VisibilityPill visibility={a.visibility} kind="album" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="font-display font-700 text-base text-white drop-shadow-lg">{a.title}</p>
                      {a.description && (
                        <p className="text-xs text-white/75 line-clamp-1 mt-0.5">{a.description}</p>
                      )}
                    </div>
                    <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Featured / item grid */}
        <div id="work" className="scroll-mt-24">
        <MediaGrid
          items={mode === "home" ? items.slice(1) : items}
          emptyLabel={
            mode === "home"
              ? (isOwner ? "Add photos and videos in your Portfolio Studio to bring this page to life." : "No public work yet")
              :
            mode === "photos" ? "No public photos yet" :
            mode === "videos" ? "No public videos yet" :
            "This album is empty"
          }
          ownerCta={isOwner && items.length === 0}
          onOpen={setLightbox}
          heading={mode === "home" && items.length > 1 ? "Selected work" : undefined}
          eyebrow={mode === "home" && items.length > 1 ? "Portfolio" : undefined}
          subtitle={mode === "home" && items.length > 1 ? "A taste of recent shoots" : undefined}
          showVisibility={isOwner}
          username={profile.username}
          showSeeAll={mode === "home" && allItems.length > items.length}
        />
        </div>
      </main>

      {prefs.show_powered_by && (
        <footer className="border-t border-border mt-12 py-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Build your own drone portfolio with <span className="font-display font-700 text-foreground">Dronie</span>
          </Link>
        </footer>
      )}

      {lightbox && (
        <Lightbox
          items={items.filter((i) => i.kind !== "project_link" && (i.thumb_url || i.media_url))}
          current={lightbox}
          onClose={() => setLightbox(null)}
          onNavigate={(it) => setLightbox(it)}
        />
      )}

      {/* Floating sticky Hire CTA — appears once user scrolls past hero */}
      {prefs.show_hire_cta && hireEmail && mode === "home" && (
        <div
          className={`fixed bottom-4 right-4 z-40 transition-all duration-300 ${
            showStickyCta ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <MagneticHireButton
            email={hireEmail}
            label={profile.full_name?.split(" ")[0] || displayName}
            onClick={() => setHireOpen(true)}
          />
        </div>
      )}

      {prefs.show_hire_cta && (
        <HireInquiryDialog
          open={hireOpen}
          onOpenChange={setHireOpen}
          ownerId={profile.id}
          ownerDisplayName={profile.full_name?.split(" ")[0] || displayName}
          projectRef={mode === "album" ? album?.title ?? null : null}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Hero — three visually distinct layouts
 * ─────────────────────────────────────────────────────────────── */

type PrefsT = ReturnType<typeof normalizePrefs>;

function PortfolioHero({
  profile, prefs, layout, theme, banner, items, albums, displayName,
  formattedRate, hireEmail, hasAnySocial, allItemsCount, onHireClick,
}: {
  profile: PortfolioProfile;
  prefs: PrefsT;
  layout: "cinematic" | "editorial" | "grid";
  theme: { hideBackdrop?: boolean };
  banner: string | null;
  items: PortfolioItem[];
  albums: PortfolioAlbum[];
  displayName: string;
  formattedRate: string | null;
  hireEmail: string | null;
  hasAnySocial: boolean;
  allItemsCount: number;
  onHireClick?: () => void;
}) {
  const firstItem = items.find((i) => i.thumb_url || i.media_url);
  const firstAlbumCover = albums.find((a) => a.cover_url)?.cover_url;
  const fallbackBackdrop =
    !theme.hideBackdrop
      ? (firstItem?.thumb_url || firstItem?.media_url || firstAlbumCover || profile.avatar_url || null)
      : null;

  const services = (profile.services ?? []).filter(Boolean).slice(0, 8);

  const ctas = (
    <div className="flex flex-wrap gap-2">
      {prefs.show_hire_cta && hireEmail && (
        <Button
          size="lg"
          className="gap-1.5 shadow-lg shadow-primary/20"
          onClick={onHireClick}
        >
          <Send className="w-4 h-4" /> Hire {profile.full_name?.split(" ")[0] || "me"}
        </Button>
      )}
      <Link to={`/u/${profile.username}/photos`}>
        <Button size="lg" variant="outline" className="gap-1.5">
          <ImageIcon className="w-4 h-4" /> Photos
        </Button>
      </Link>
      <Link to={`/u/${profile.username}/videos`}>
        <Button size="lg" variant="outline" className="gap-1.5">
          <Film className="w-4 h-4" /> Videos
        </Button>
      </Link>
      {prefs.show_resume && profile.resume_url && (
        <a href={profile.resume_url} target="_blank" rel="noreferrer">
          <Button size="lg" variant="ghost" className="gap-1.5">
            <FileText className="w-4 h-4" /> Résumé
          </Button>
        </a>
      )}
    </div>
  );

  const meta = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      {prefs.show_availability && (
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${
          profile.available_for_hire
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            : "border-border bg-muted text-muted-foreground"
        }`}>
          <CircleDot className={`w-3 h-3 ${profile.available_for_hire ? "animate-pulse" : ""}`} />
          {profile.available_for_hire ? "Available for hire" : "Currently booked"}
        </span>
      )}
      {prefs.show_location && profile.location && (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" /> {profile.location}
        </span>
      )}
      {prefs.show_rate && formattedRate && (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary font-medium">
          <BadgeCheck className="w-3.5 h-3.5" /> {formattedRate}
        </span>
      )}
    </div>
  );

  // ───── CINEMATIC ──────────────────────────────────────────────
  // Full-bleed banner / backdrop image, with a contained editorial card
  // anchoring the identity. Award-grade composition: image breathes,
  // content sits in a tight, high-contrast glass panel that scales
  // gracefully from short laptops to ultra-wide monitors.
  if (layout === "cinematic") {
    return (
      <section className="relative border-b border-border overflow-hidden">
        <div className="relative w-full">
          {/* Backdrop */}
          <div className="absolute inset-0 -z-0">
            {(banner || fallbackBackdrop) ? (
              <img
                src={banner || fallbackBackdrop || ""}
                alt=""
                aria-hidden
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                className="w-full h-full object-cover portfolio-kenburns"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/30 via-background to-background" />
            )}
            {/* Vertical scrim — keeps copy legible on any banner */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/30" />
            {/* Left-side scrim — anchors the editorial card */}
            <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/40 to-transparent" />
            {/* Subtle color wash from primary */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_hsl(var(--primary)/0.22),_transparent_55%)]" />
          </div>

          {/* Cinematic HUD overlay */}
          <FilmHud count={allItemsCount} location={prefs.show_location ? profile.location : null} />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-12 sm:pb-20 grid lg:grid-cols-12 gap-8 items-end min-h-[600px] sm:min-h-[640px]">
            {/* Editorial identity card — left column, glassmorphic */}
            <div className="lg:col-span-7 xl:col-span-6">
              <div className="relative rounded-3xl border border-white/10 bg-background/55 backdrop-blur-xl p-6 sm:p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
                {/* Editorial corner ticks */}
                <span aria-hidden className="absolute top-3 left-3 w-3 h-3 border-l border-t border-primary/70" />
                <span aria-hidden className="absolute top-3 right-3 w-3 h-3 border-r border-t border-primary/70" />
                <span aria-hidden className="absolute bottom-3 left-3 w-3 h-3 border-l border-b border-primary/70" />
                <span aria-hidden className="absolute bottom-3 right-3 w-3 h-3 border-r border-b border-primary/70" />

                <div className="flex items-center gap-4 sm:gap-5">
                  <Avatar profile={profile} displayName={displayName} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-primary mb-1.5">
                      Aerial portfolio · @{profile.username}
                    </p>
                    <h1
                      className="font-700 text-4xl sm:text-5xl xl:text-6xl tracking-tight leading-[0.95]"
                      style={{ fontFamily: "var(--portfolio-display-font)" }}
                    >
                      {displayName}
                    </h1>
                  </div>
                </div>

                {profile.headline && (
                  <p className="text-base sm:text-lg text-foreground/90 leading-snug mt-5 border-l-2 border-primary/60 pl-3">
                    {profile.headline}
                  </p>
                )}

                <div className="mt-5 space-y-4">
                  {meta}
                  {prefs.show_services && services.length > 0 && (
                    <ServiceChips services={services} />
                  )}
                  {profile.bio && (
                    <p className="text-sm text-foreground/75 whitespace-pre-line leading-relaxed line-clamp-4">
                      {profile.bio}
                    </p>
                  )}
                  {ctas}
                </div>
              </div>
            </div>

            {/* Right column — keeps the banner breathing on wide screens.
                On mobile/tablet it collapses; the backdrop alone carries the visual. */}
            <div className="hidden lg:flex lg:col-span-5 xl:col-span-6 self-stretch items-end justify-end">
              <div className="text-right text-white/80 max-w-xs space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-white/60">
                  Reel · {new Date().getFullYear()}
                </p>
                {typeof allItemsCount === "number" && allItemsCount > 0 && (
                  <p
                    className="font-700 text-5xl xl:text-6xl tabular-nums leading-none drop-shadow-[0_4px_18px_rgba(0,0,0,0.5)]"
                    style={{ fontFamily: "var(--portfolio-display-font)" }}
                  >
                    {String(allItemsCount).padStart(2, "0")}
                  </p>
                )}
                <p className="text-xs uppercase tracking-[0.22em] text-white/70">
                  Shots in this portfolio
                </p>
              </div>
            </div>
          </div>
        </div>
        <ContactRail profile={profile} prefs={prefs} hasAnySocial={hasAnySocial} />
      </section>
    );
  }

  // ───── EDITORIAL ──────────────────────────────────────────────
  // Magazine-style: huge serif headline left, vertical stripe + portrait right.
  if (layout === "editorial") {
    return (
      <section className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--primary)/0.18),_transparent_60%)]" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-16 items-center">
          <div className="space-y-6 order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-medium uppercase tracking-[0.2em]">
              <Camera className="w-3 h-3" /> Aerial portfolio
            </div>
            <h1
              className="font-700 text-6xl sm:text-8xl tracking-tight leading-[0.92]"
              style={{ fontFamily: "var(--portfolio-display-font)" }}
            >
              {displayName}
            </h1>
            {profile.headline && (
              <p className="text-xl sm:text-2xl text-foreground/85 leading-snug max-w-xl border-l-2 border-primary pl-4 italic">
                {profile.headline}
              </p>
            )}
            {meta}
            {prefs.show_services && services.length > 0 && (
              <ServiceChips services={services} />
            )}
            {profile.bio && (
              <p className="text-base text-muted-foreground max-w-xl whitespace-pre-line leading-relaxed">
                {profile.bio}
              </p>
            )}
            {ctas}
          </div>

          <div className="relative order-1 lg:order-2">
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-border shadow-2xl shadow-primary/10">
              {(banner || fallbackBackdrop) ? (
                <img
                  src={banner || fallbackBackdrop || ""}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/40 to-primary/5" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
            </div>
            <div className="absolute -bottom-6 -left-6 sm:-left-10">
              <Avatar profile={profile} displayName={displayName} size="md" />
            </div>
          </div>
        </div>
        <ContactRail profile={profile} prefs={prefs} hasAnySocial={hasAnySocial} />
      </section>
    );
  }

  // ───── GRID-FIRST ─────────────────────────────────────────────
  // Tight, card-style hero. Compact identity panel + 2x2 work preview.
  return (
    <section className="relative border-b border-border overflow-hidden">
      {(banner || fallbackBackdrop) && !theme.hideBackdrop && (
        <div className="absolute inset-0 -z-10">
          <img
            src={banner || fallbackBackdrop || ""}
            alt=""
            aria-hidden
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            className="w-full h-full object-cover opacity-25 scale-110 blur-md"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/90 to-background" />
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 grid lg:grid-cols-[1fr_1.1fr] gap-6 lg:gap-10 items-stretch">
        <div className="rounded-2xl bg-card/70 backdrop-blur-sm border border-border p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar profile={profile} displayName={displayName} size="sm" />
            <div className="min-w-0">
              <h1
                className="font-700 text-2xl sm:text-3xl tracking-tight leading-[1.05] truncate"
                style={{ fontFamily: "var(--portfolio-display-font)" }}
              >
                {displayName}
              </h1>
              <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
            </div>
          </div>
          {profile.headline && (
            <p className="text-base text-foreground/85 leading-relaxed">{profile.headline}</p>
          )}
          {meta}
          {prefs.show_services && services.length > 0 && (
            <ServiceChips services={services} />
          )}
          {profile.bio && (
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed line-clamp-5">
              {profile.bio}
            </p>
          )}
          {ctas}
        </div>

        {/* Mosaic preview */}
        <div className="grid grid-cols-2 grid-rows-2 gap-2 sm:gap-3 min-h-[280px] sm:min-h-[360px]">
          {(() => {
            const previews = items.filter((i) => i.thumb_url || i.media_url).slice(0, 4);
            const fillers = 4 - previews.length;
            return [
              ...previews.map((it, idx) => (
                <div key={it.id} className={`relative rounded-xl overflow-hidden bg-secondary border border-border ${idx === 0 ? "row-span-2" : ""}`}>
                  <img
                    src={it.thumb_url || it.media_url || ""}
                    alt={it.title ?? ""}
                    loading="lazy"
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )),
              ...Array.from({ length: Math.max(0, fillers) }).map((_, i) => (
                <div key={`f${i}`} className={`rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-border ${i === 0 && previews.length === 0 ? "row-span-2" : ""}`} />
              )),
            ];
          })()}
        </div>
      </div>
      <ContactRail profile={profile} prefs={prefs} hasAnySocial={hasAnySocial} />
    </section>
  );
}

function Avatar({ profile, displayName, size }: { profile: PortfolioProfile; displayName: string; size: "sm" | "md" | "lg" }) {
  const cls =
    size === "lg"
      ? "w-24 h-24 sm:w-28 sm:h-28 rounded-2xl text-3xl"
      : size === "md"
        ? "w-20 h-20 sm:w-24 sm:h-24 rounded-2xl text-2xl"
        : "w-14 h-14 rounded-xl text-xl";
  return (
    <div
      className={`relative ${cls} bg-primary/15 flex items-center justify-center font-700 text-primary overflow-hidden ring-2 ring-primary/40 shadow-2xl shadow-primary/20 flex-shrink-0`}
      style={{ fontFamily: "var(--portfolio-display-font)" }}
    >
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
      ) : (
        displayName[0]?.toUpperCase()
      )}
    </div>
  );
}

function ServiceChips({ services }: { services: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {services.map((s, i) => (
        <span
          key={`${s}-${i}`}
          className="inline-flex items-center px-2.5 py-1 rounded-full bg-secondary/80 border border-border text-xs font-medium"
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function ContactRail({ profile, prefs, hasAnySocial }: { profile: PortfolioProfile; prefs: PrefsT; hasAnySocial: boolean }) {
  const showEmail = prefs.show_email && !!profile.contact_email;
  const showPhone = prefs.show_phone && !!profile.phone;
  const showWebsite = prefs.show_website && !!profile.website;
  const showSocials = prefs.show_socials && hasAnySocial;
  if (!showEmail && !showPhone && !showWebsite && !showSocials) return null;

  return (
    <div className="border-t border-border bg-card/40 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        {showEmail && (
          <a href={`mailto:${profile.contact_email}`} className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
            <Mail className="w-3.5 h-3.5" /> {profile.contact_email}
          </a>
        )}
        {showPhone && (
          <a href={`tel:${profile.phone}`} className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
            <Phone className="w-3.5 h-3.5" /> {profile.phone}
          </a>
        )}
        {showWebsite && (
          <a href={profile.website!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
            <Globe className="w-3.5 h-3.5" /> {profile.website!.replace(/^https?:\/\//, "")}
          </a>
        )}
        {showSocials && (
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {profile.instagram && (
              <SocialIcon href={`https://instagram.com/${profile.instagram.replace(/^@/, "")}`} icon={Instagram} label="Instagram" />
            )}
            {profile.linkedin && (
              <SocialIcon href={profile.linkedin.startsWith("http") ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin.replace(/^@/, "")}`} icon={Linkedin} label="LinkedIn" />
            )}
            {profile.twitter && (
              <SocialIcon href={`https://x.com/${profile.twitter.replace(/^@/, "")}`} icon={Twitter} label="X" />
            )}
            {profile.youtube && (
              <SocialIcon href={profile.youtube.startsWith("http") ? profile.youtube : `https://youtube.com/${profile.youtube.startsWith("@") ? profile.youtube : "@" + profile.youtube}`} icon={Youtube} label="YouTube" />
            )}
            {profile.vimeo && (
              <SocialIcon href={profile.vimeo.startsWith("http") ? profile.vimeo : `https://vimeo.com/${profile.vimeo.replace(/^@/, "")}`} icon={Film} label="Vimeo" />
            )}
            {profile.tiktok && (
              <SocialIcon href={`https://tiktok.com/@${profile.tiktok.replace(/^@/, "")}`} icon={Music2} label="TikTok" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SocialIcon({ href, icon: Icon, label }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
    >
      <Icon className="w-4 h-4" />
    </a>
  );
}

function MediaGrid({
  items, emptyLabel, onOpen, heading, eyebrow, subtitle, ownerCta, showVisibility, username, showSeeAll,
}: {
  items: PortfolioItem[];
  emptyLabel: string;
  onOpen: (i: PortfolioItem) => void;
  heading?: string;
  eyebrow?: string;
  subtitle?: string;
  ownerCta?: boolean;
  showVisibility?: boolean;
  username?: string;
  showSeeAll?: boolean;
}) {
  const hasItems = items.length > 0;
  return (
    <section className="space-y-4">
      {heading && hasItems && (
        <SectionHeading
          eyebrow={eyebrow}
          title={heading}
          subtitle={subtitle}
          right={showSeeAll && username ? (
            <Link to={`/u/${username}/photos`} className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80">
              See everything <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          ) : undefined}
        />
      )}
      {!hasItems ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground space-y-3">
          <p>{emptyLabel}</p>
          {ownerCta && (
            <Link to="/portfolio">
              <Button size="sm" variant="outline" className="gap-1.5 mt-1">
                <Sparkles className="w-3.5 h-3.5" /> Open Portfolio Studio
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 sm:gap-3 [column-fill:_balance]">
          {items.map((it) => (
            <div key={it.id} className="mb-2 sm:mb-3 break-inside-avoid">
              <MediaCard item={it} onOpen={onOpen} showVisibility={showVisibility} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MediaCard({ item, onOpen, showVisibility }: { item: PortfolioItem; onOpen: (i: PortfolioItem) => void; showVisibility?: boolean }) {
  if (item.kind === "project_link") {
    return (
      <Link
        to={item.project_id ? `/viewer/${item.project_id}` : "#"}
        className="block aspect-square rounded-xl border border-border bg-card relative overflow-hidden group hover:border-primary/50 transition-colors"
      >
        {item.thumb_url ? (
          <img src={item.thumb_url} alt={item.title ?? ""} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
          <p className="text-xs font-semibold text-white truncate flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> {item.title || "View 3D project"}
          </p>
        </div>
        {showVisibility && item.visibility !== "public" && (
          <div className="absolute top-1.5 right-1.5">
            <VisibilityPill visibility={item.visibility} kind="item" />
          </div>
        )}
      </Link>
    );
  }
  return (
    <button
      onClick={() => onOpen(item)}
      className="block w-full rounded-xl border border-border bg-secondary relative overflow-hidden group hover:border-primary/50 transition-all"
    >
      {item.kind === "video" && !item.thumb_url ? (
        <video
          src={item.media_url ?? ""}
          className="w-full h-auto object-cover group-hover:scale-[1.04] transition-transform duration-700"
          muted
          playsInline
          preload="metadata"
        />
      ) : item.thumb_url ? (
        <img
          src={item.thumb_url}
          alt={item.title ?? item.caption ?? ""}
          className="w-full h-auto object-cover group-hover:scale-[1.04] transition-transform duration-700"
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : item.media_url ? (
        <img
          src={item.media_url}
          alt={item.title ?? item.caption ?? ""}
          className="w-full h-auto object-cover group-hover:scale-[1.04] transition-transform duration-700"
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className="w-full aspect-square bg-gradient-to-br from-primary/10 to-accent/5" />
      )}
      {/* Title overlay on hover */}
      {(item.title || item.caption) && (
        <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 via-black/30 to-transparent translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          {item.title && <p className="text-xs font-semibold text-white truncate">{item.title}</p>}
          {item.caption && <p className="text-[10px] text-white/70 truncate">{item.caption}</p>}
        </div>
      )}
      {item.kind === "video" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 text-foreground fill-foreground ml-0.5" />
          </div>
        </div>
      )}
      {showVisibility && item.visibility !== "public" && (
        <div className="absolute top-1.5 right-1.5">
          <VisibilityPill visibility={item.visibility} kind="item" />
        </div>
      )}
    </button>
  );
}

function Lightbox({
  items, current, onClose, onNavigate,
}: {
  items: PortfolioItem[];
  current: PortfolioItem;
  onClose: () => void;
  onNavigate: (it: PortfolioItem) => void;
}) {
  const idx = Math.max(0, items.findIndex((i) => i.id === current.id));
  const total = items.length;
  const item = current;
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartX = useRef<number | null>(null);

  const go = (delta: number) => {
    if (total <= 1) return;
    const next = (idx + delta + total) % total;
    onNavigate(items[next]);
  };

  // Preload neighbours for snappier nav.
  const prevItem = total > 1 ? items[(idx - 1 + total) % total] : null;
  const nextItem = total > 1 ? items[(idx + 1) % total] : null;

  // Lock body scroll + restore focus on close.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevActive = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    // Initial focus inside dialog.
    requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => {
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); return; }
      if (e.key === "Home" && total > 1) { e.preventDefault(); onNavigate(items[0]); return; }
      if (e.key === "End" && total > 1) { e.preventDefault(); onNavigate(items[total - 1]); return; }
      if (item.kind === "video" && videoRef.current) {
        if (e.key === " " || e.code === "Space") {
          e.preventDefault();
          const v = videoRef.current;
          if (v.paused) v.play(); else v.pause();
        } else if (e.key.toLowerCase() === "m") {
          e.preventDefault();
          videoRef.current.muted = !videoRef.current.muted;
        }
      }
      // Focus trap: keep Tab inside dialog.
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], video, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, idx, total, item.kind, items, onNavigate]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  };

  const captionId = `lightbox-caption-${item.id}`;
  const titleId = `lightbox-title-${item.id}`;
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={item.title ? titleId : undefined}
      aria-describedby={item.caption ? captionId : undefined}
      aria-label={!item.title ? (item.kind === "video" ? "Video viewer" : "Image viewer") : undefined}
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        ref={closeBtnRef}
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        aria-label="Close"
      >
        <XIcon className="w-5 h-5" />
      </button>
      {total > 1 && (
        <span aria-live="polite" className="absolute top-5 left-1/2 -translate-x-1/2 text-xs text-white/70 font-mono tabular-nums">
          {idx + 1} / {total}
        </span>
      )}
      {total > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}
      <div className="max-w-6xl w-full max-h-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {item.kind === "video" ? (
          <video
            key={item.id}
            ref={videoRef}
            src={item.media_url ?? ""}
            poster={item.thumb_url ?? undefined}
            controls
            autoPlay
            playsInline
            preload="metadata"
            aria-label={item.title ?? "Portfolio video"}
            className="w-full max-h-[80vh] rounded-lg shadow-2xl bg-black"
          />
        ) : (
          <img
            key={item.id}
            src={item.media_url ?? ""}
            alt={item.title ?? item.caption ?? "Portfolio image"}
            className="w-full max-h-[80vh] object-contain rounded-lg"
          />
        )}
        {(item.title || item.caption) && (
          <div className="text-center mt-3 text-white/90">
            {item.title && <p id={titleId} className="font-display font-700">{item.title}</p>}
            {item.caption && <p id={captionId} className="text-sm text-white/70">{item.caption}</p>}
          </div>
        )}
        {/* Preload neighbours (hidden) */}
        {prevItem && prevItem.kind === "photo" && prevItem.media_url && (
          <img src={prevItem.media_url} alt="" aria-hidden className="hidden" />
        )}
        {nextItem && nextItem.kind === "photo" && nextItem.media_url && (
          <img src={nextItem.media_url} alt="" aria-hidden className="hidden" />
        )}
      </div>
    </div>
  );
}

function autoCover(albumId: string, items: PortfolioItem[]): string | null {
  const inAlbum = items.filter((i) => i.album_id === albumId && (i.thumb_url || i.media_url));
  const first = inAlbum[0];
  return first ? first.thumb_url || first.media_url : null;
}

/* ─────────────────────────────────────────────────────────────────
 * Polish components: section headings, stats strip, featured reel
 * ─────────────────────────────────────────────────────────────── */

function SectionHeading({
  eyebrow, title, subtitle, right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        {eyebrow && (
          <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary mb-1.5">
            <span className="w-5 h-px bg-primary/60" /> {eyebrow}
          </div>
        )}
        <h2
          className="font-700 text-3xl sm:text-4xl tracking-tight leading-[1.05]"
          style={{ fontFamily: "var(--portfolio-display-font)" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>
        )}
      </div>
      {right && <div className="text-xs text-muted-foreground">{right}</div>}
    </div>
  );
}

function StatsStrip({
  photos, videos, albums, available,
}: {
  photos: number;
  videos: number;
  albums: number;
  available: boolean;
}) {
  const stats = [
    { icon: ImageIcon, label: "Photos", value: photos },
    { icon: Film, label: "Videos", value: videos },
    { icon: Award, label: "Collections", value: albums },
  ].filter((s) => s.value > 0);

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:p-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p
                className="font-700 text-xl tabular-nums leading-none"
                style={{ fontFamily: "var(--portfolio-display-font)" }}
              >
                {value}
              </p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
            available
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-muted border-border text-muted-foreground"
          }`}>
            {available ? <Zap className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <p
              className="font-700 text-sm leading-tight"
              style={{ fontFamily: "var(--portfolio-display-font)" }}
            >
              {available ? "Booking now" : "Reach out"}
            </p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">Status</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturedReel({
  item, onOpen,
}: {
  item: PortfolioItem;
  onOpen: (i: PortfolioItem) => void;
}) {
  if (!item || (!item.thumb_url && !item.media_url) || item.kind === "project_link") return null;
  const isVideo = item.kind === "video";
  return (
    <section className="space-y-3">
      <SectionHeading eyebrow="Featured" title="Latest work" subtitle="The shot worth opening with" />
      <button
        onClick={() => onOpen(item)}
        className="group relative block w-full rounded-2xl overflow-hidden border border-border bg-secondary aspect-[16/9] sm:aspect-[21/9] hover:border-primary/50 transition-colors"
      >
        {isVideo && !item.thumb_url ? (
          <video
            src={item.media_url ?? ""}
            muted
            playsInline
            preload="metadata"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-[1500ms]"
          />
        ) : (
          <img
            src={item.thumb_url || item.media_url || ""}
            alt={item.title ?? ""}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-[1500ms]"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/95 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
              <Play className="w-7 h-7 sm:w-8 sm:h-8 text-foreground fill-foreground ml-1" />
            </div>
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 p-5 sm:p-7 flex items-end justify-between gap-4">
          <div className="min-w-0">
            {item.title && (
              <p
                className="font-700 text-2xl sm:text-3xl text-white drop-shadow-lg leading-tight"
                style={{ fontFamily: "var(--portfolio-display-font)" }}
              >
                {item.title}
              </p>
            )}
            {item.caption && (
              <p className="text-sm text-white/80 mt-1 line-clamp-1 max-w-2xl">{item.caption}</p>
            )}
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-xs font-medium text-white whitespace-nowrap">
            {isVideo ? <Film className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
            {isVideo ? "Watch" : "View"} <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </button>
    </section>
  );
}

function VisibilityPill({
  visibility,
  kind,
}: {
  visibility: "public" | "unlisted" | "private";
  kind: "album" | "item";
}) {
  if (visibility === "public") return null;
  const isUnlisted = visibility === "unlisted";
  const Icon = isUnlisted ? Link2 : Lock;
  const label = isUnlisted ? "Unlisted" : "Private";
  const tip = isUnlisted
    ? `This ${kind} is unlisted — only people with the direct link can see it. It won't appear in public listings.`
    : `This ${kind} is private — only you can see it while signed in. Visitors won't see it at all.`;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider backdrop-blur border cursor-help ${
              isUnlisted
                ? "bg-amber-500/15 text-amber-200 border-amber-500/40"
                : "bg-rose-500/15 text-rose-200 border-rose-500/40"
            }`}
          >
            <Icon className="w-3 h-3" /> {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

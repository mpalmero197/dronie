import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, MapPin, Globe, Instagram, ImageIcon, Film, Sparkles,
  Loader2, Lock, ExternalLink, Camera, Eye, EyeOff, Link2,
  Linkedin, Twitter, Youtube, Music2, FileText, Mail,
  AlertTriangle, RefreshCw, LifeBuoy, User as UserIcon,
} from "lucide-react";
import {
  fetchPortfolioByUsername, fetchPublicAlbumsByUser, fetchPublicItemsByUser,
  fetchAlbumBySlug, fetchItemsForAlbum,
  type PortfolioProfile, type PortfolioAlbum, type PortfolioItem,
} from "@/lib/portfolio";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_THEME, ensureFontLoaded, normalizeTheme, themeStyle,
} from "@/lib/portfolioTheme";

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

  const theme = useMemo(() => normalizeTheme(profile?.theme ?? null), [profile?.theme]);
  useEffect(() => { ensureFontLoaded(theme.font); }, [theme.font]);

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

  // Document title for SEO
  useEffect(() => {
    if (!profile) return;
    const name = profile.full_name || profile.username;
    let suffix = "Drone photography portfolio";
    if (mode === "photos") suffix = "Photos";
    else if (mode === "videos") suffix = "Videos";
    else if (mode === "album" && album) suffix = album.title;
    document.title = `${name} · ${suffix} · Dronie`;
  }, [profile, album, mode]);

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
          <a href="mailto:support@dronieapp.com?subject=Portfolio%20failed%20to%20load">
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
          <a href="mailto:support@dronieapp.com?subject=Portfolio%20not%20found">
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

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={themeStyle(theme)}
    >
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
        <section className={`relative border-b border-border overflow-hidden ${layout === "grid" ? "pb-0" : ""}`}>
          {/* Cinematic backdrop */}
          <div className="absolute inset-0 -z-10">
            {(() => {
              if (banner) {
                return (
                  <img
                    src={banner}
                    alt=""
                    aria-hidden
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    className="w-full h-full object-cover opacity-70"
                  />
                );
              }
              if (theme.hideBackdrop) return null;
              const firstItem = items.find((i) => i.thumb_url || i.media_url);
              const firstAlbumCover = albums.find((a) => a.cover_url)?.cover_url;
              const backdrop =
                firstItem?.thumb_url ||
                firstItem?.media_url ||
                firstAlbumCover ||
                profile.avatar_url ||
                null;
              return backdrop ? (
                <img
                  src={backdrop}
                  alt=""
                  aria-hidden
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                  className="w-full h-full object-cover opacity-30 scale-110 blur-sm"
                />
              ) : null;
            })()}
            <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--primary)/0.18),_transparent_60%)]" />
          </div>

          <div className={`max-w-6xl mx-auto px-4 sm:px-6 ${layout === "grid" ? "pt-10 pb-6 sm:pt-12 sm:pb-8" : "pt-14 pb-16 sm:pt-20 sm:pb-24"}`}>
            <div className={
              layout === "editorial"
                ? "max-w-3xl space-y-4"
                : layout === "grid"
                  ? "grid sm:grid-cols-[auto_1fr] gap-5 items-center"
                  : "grid sm:grid-cols-[auto_1fr] gap-8 items-center"
            }>
              <div
                className={
                  layout === "grid"
                    ? "relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/15 flex items-center justify-center text-2xl font-display font-700 text-primary overflow-hidden ring-1 ring-primary/30"
                    : "relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-primary/15 flex items-center justify-center text-4xl font-display font-700 text-primary overflow-hidden ring-1 ring-primary/30 shadow-2xl shadow-primary/10"
                }
                style={{ fontFamily: "var(--portfolio-display-font)" }}
              >
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  displayName[0]?.toUpperCase()
                )}
              </div>
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-medium uppercase tracking-wider">
                  <Camera className="w-3 h-3" /> Drone photographer
                </div>
                <h1
                  className={
                    layout === "grid"
                      ? "font-700 text-2xl sm:text-3xl tracking-tight leading-[1.1]"
                      : layout === "editorial"
                        ? "font-700 text-5xl sm:text-7xl tracking-tight leading-[1.02]"
                        : "font-700 text-4xl sm:text-6xl tracking-tight leading-[1.05]"
                  }
                  style={{ fontFamily: "var(--portfolio-display-font)" }}
                >
                  {displayName}
                </h1>
                {profile.headline && (
                  <p className="text-lg sm:text-xl text-foreground/85 max-w-2xl leading-relaxed">
                    {profile.headline}
                  </p>
                )}
                {profile.bio && (
                  <p className="text-sm text-muted-foreground max-w-2xl whitespace-pre-line leading-relaxed">
                    {profile.bio}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground pt-1">
                  {profile.location && (
                    <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {profile.location}</span>
                  )}
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                      <Globe className="w-3.5 h-3.5" /> {profile.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                  {profile.instagram && (
                    <a href={`https://instagram.com/${profile.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                      <Instagram className="w-3.5 h-3.5" /> @{profile.instagram.replace(/^@/, "")}
                    </a>
                  )}
                  {profile.linkedin && (
                    <a href={profile.linkedin.startsWith("http") ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                      <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                    </a>
                  )}
                  {profile.twitter && (
                    <a href={`https://x.com/${profile.twitter.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                      <Twitter className="w-3.5 h-3.5" /> @{profile.twitter.replace(/^@/, "")}
                    </a>
                  )}
                  {profile.youtube && (
                    <a href={profile.youtube.startsWith("http") ? profile.youtube : `https://youtube.com/${profile.youtube.startsWith("@") ? profile.youtube : "@" + profile.youtube}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                      <Youtube className="w-3.5 h-3.5" /> YouTube
                    </a>
                  )}
                  {profile.vimeo && (
                    <a href={profile.vimeo.startsWith("http") ? profile.vimeo : `https://vimeo.com/${profile.vimeo.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                      <Film className="w-3.5 h-3.5" /> Vimeo
                    </a>
                  )}
                  {profile.tiktok && (
                    <a href={`https://tiktok.com/@${profile.tiktok.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                      <Music2 className="w-3.5 h-3.5" /> @{profile.tiktok.replace(/^@/, "")}
                    </a>
                  )}
                  {profile.contact_email && (
                    <a href={`mailto:${profile.contact_email}`} className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                      <Mail className="w-3.5 h-3.5" /> {profile.contact_email}
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-4">
                  <Link to={`/u/${profile.username}/photos`}>
                    <Button size="sm" className="gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" /> All photos
                    </Button>
                  </Link>
                  <Link to={`/u/${profile.username}/videos`}>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Film className="w-3.5 h-3.5" /> All videos
                    </Button>
                  </Link>
                  {profile.resume_url && (
                    <a href={profile.resume_url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Résumé
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
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

        {/* Albums grid (home only) */}
        {mode === "home" && albums.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-end justify-between">
              <h2 className="font-display font-700 text-2xl tracking-tight">Albums</h2>
              <span className="text-xs text-muted-foreground">{albums.length} {albums.length === 1 ? "album" : "albums"}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {albums.map((a) => {
                const cover = a.cover_url || autoCover(a.id, allItems);
                return (
                <Link
                  key={a.id}
                  to={`/u/${profile.username}/album/${a.slug}`}
                  className="group rounded-2xl border border-border overflow-hidden bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all"
                >
                  <div className="aspect-[4/3] bg-secondary relative overflow-hidden">
                    {cover ? (
                      <img src={cover} alt={a.title} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    {a.visibility !== "public" && (
                      <div className="absolute top-2 right-2">
                        <VisibilityPill visibility={a.visibility} kind="album" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-display font-700 text-sm">{a.title}</p>
                    {a.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.description}</p>
                    )}
                  </div>
                </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Featured / item grid */}
        <MediaGrid
          items={items}
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
          heading={mode === "home" && items.length > 0 ? "Featured" : undefined}
          showVisibility={isOwner}
        />
      </main>

      <footer className="border-t border-border mt-12 py-6 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Build your own drone portfolio with <span className="font-display font-700 text-foreground">Dronie</span>
        </Link>
      </footer>

      {lightbox && (
        <Lightbox item={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

function MediaGrid({
  items, emptyLabel, onOpen, heading, ownerCta, showVisibility,
}: {
  items: PortfolioItem[];
  emptyLabel: string;
  onOpen: (i: PortfolioItem) => void;
  heading?: string;
  ownerCta?: boolean;
  showVisibility?: boolean;
}) {
  const hasItems = items.length > 0;
  return (
    <section className="space-y-3">
      {heading && hasItems && <h2 className="font-display font-700 text-2xl tracking-tight">{heading}</h2>}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {items.map((it) => (
            <MediaCard key={it.id} item={it} onOpen={onOpen} showVisibility={showVisibility} />
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
        className="aspect-square rounded-xl border border-border bg-card relative overflow-hidden group"
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
      className="aspect-square rounded-xl border border-border bg-secondary relative overflow-hidden group"
    >
      {item.kind === "video" && !item.thumb_url ? (
        <video
          src={item.media_url ?? ""}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          muted
          playsInline
          preload="metadata"
        />
      ) : item.thumb_url ? (
        <img
          src={item.thumb_url}
          alt={item.title ?? item.caption ?? ""}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : item.media_url ? (
        <img
          src={item.media_url}
          alt={item.title ?? item.caption ?? ""}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/5" />
      )}
      {item.kind === "video" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
            <Film className="w-5 h-5 text-foreground" />
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

function Lightbox({ item, onClose }: { item: PortfolioItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-6xl w-full max-h-full" onClick={(e) => e.stopPropagation()}>
        {item.kind === "video" ? (
          <video src={item.media_url ?? ""} controls autoPlay className="w-full max-h-[80vh] rounded-lg" />
        ) : (
          <img src={item.media_url ?? ""} alt={item.title ?? ""} className="w-full max-h-[80vh] object-contain rounded-lg" />
        )}
        {(item.title || item.caption) && (
          <div className="text-center mt-3 text-white/90">
            {item.title && <p className="font-display font-700">{item.title}</p>}
            {item.caption && <p className="text-sm text-white/70">{item.caption}</p>}
          </div>
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

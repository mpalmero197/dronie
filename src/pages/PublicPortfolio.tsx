import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, MapPin, Globe, Instagram, ImageIcon, Film, Sparkles,
  Loader2, Lock, ExternalLink, Camera, Eye, EyeOff,
} from "lucide-react";
import {
  fetchPortfolioByUsername, fetchPublicAlbumsByUser, fetchPublicItemsByUser,
  fetchAlbumBySlug, fetchItemsForAlbum,
  type PortfolioProfile, type PortfolioAlbum, type PortfolioItem,
} from "@/lib/portfolio";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

type Mode = "home" | "photos" | "videos" | "album";

interface Props { mode: Mode }

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
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!username) return;
      setLoading(true); setNotFound(false);
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
        setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [username, slug, mode, user?.id]);

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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading portfolio…
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
        <Button onClick={() => navigate("/")} variant="outline">Go home</Button>
      </div>
    );
  }

  const displayName = profile.full_name || profile.username || "Pilot";
  const isOwner = !!user && user.id === profile.id;
  const isUnpublished = !profile.portfolio_published;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {isOwner && isUnpublished && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <EyeOff className="w-4 h-4" />
              Preview mode — your portfolio is unpublished. Only you can see this page.
            </span>
            <Link to="/portfolio">
              <Button size="sm" variant="outline" className="h-7 gap-1.5 border-amber-400/40 text-amber-100 hover:bg-amber-500/20">
                <Eye className="w-3.5 h-3.5" /> Publish in Studio
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
        <section className="relative border-b border-border overflow-hidden">
          {/* Cinematic backdrop */}
          <div className="absolute inset-0 -z-10">
            {items[0]?.media_url || items[0]?.thumb_url ? (
              <img
                src={items[0].thumb_url || items[0].media_url || ""}
                alt=""
                aria-hidden
                className="w-full h-full object-cover opacity-30 scale-110 blur-sm"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--primary)/0.18),_transparent_60%)]" />
          </div>

          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-24">
            <div className="grid sm:grid-cols-[auto_1fr] gap-8 items-center">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-primary/15 flex items-center justify-center text-4xl font-display font-700 text-primary overflow-hidden ring-1 ring-primary/30 shadow-2xl shadow-primary/10">
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
                <h1 className="font-display font-700 text-4xl sm:text-6xl tracking-tight leading-[1.05]">
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
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-background/80 backdrop-blur text-[10px] font-medium uppercase tracking-wider border border-border">
                        {a.visibility}
                      </span>
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
  items, emptyLabel, onOpen, heading, ownerCta,
}: {
  items: PortfolioItem[];
  emptyLabel: string;
  onOpen: (i: PortfolioItem) => void;
  heading?: string;
  ownerCta?: boolean;
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
            <MediaCard key={it.id} item={it} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

function MediaCard({ item, onOpen }: { item: PortfolioItem; onOpen: (i: PortfolioItem) => void }) {
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
      </Link>
    );
  }
  return (
    <button
      onClick={() => onOpen(item)}
      className="aspect-square rounded-xl border border-border bg-secondary relative overflow-hidden group"
    >
      <img
        src={item.thumb_url || item.media_url || ""}
        alt={item.title ?? item.caption ?? ""}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
      />
      {item.kind === "video" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
            <Film className="w-5 h-5 text-foreground" />
          </div>
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

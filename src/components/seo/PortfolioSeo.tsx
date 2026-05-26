import { Helmet } from "react-helmet-async";
import type {
  PortfolioProfile,
  PortfolioAlbum,
  PortfolioItem,
} from "@/lib/portfolio";

const SITE = "https://dronieapp.com";

function truncate(s: string, n = 155) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}

type Mode = "home" | "photos" | "videos" | "album";

interface Props {
  profile: PortfolioProfile;
  mode: Mode;
  album?: PortfolioAlbum | null;
  items?: PortfolioItem[];
  published: boolean;
}

export default function PortfolioSeo({
  profile,
  mode,
  album,
  items = [],
  published,
}: Props) {
  const name = profile.full_name || profile.username || "Aerial pilot";
  const username = profile.username || "";
  const base = `${SITE}/u/${username}`;
  let path = base;
  let pageLabel = "Drone photography portfolio";
  let description =
    profile.bio ||
    profile.headline ||
    `Aerial photography, cinematography and drone mapping by ${name}.`;
  let ogImage: string | null = profile.banner_url || profile.avatar_url || null;

  if (mode === "photos") {
    path = `${base}/photos`;
    pageLabel = "Photos";
    description = `Aerial photography by ${name}. Browse drone photos${
      profile.location ? ` from ${profile.location}` : ""
    }.`;
  } else if (mode === "videos") {
    path = `${base}/videos`;
    pageLabel = "Videos";
    description = `Aerial video reel by ${name}. Cinematic drone footage${
      profile.location ? ` from ${profile.location}` : ""
    }.`;
  } else if (mode === "album" && album) {
    path = `${base}/album/${album.slug}`;
    pageLabel = album.title;
    description =
      album.description ||
      `${album.title} — drone photography album by ${name}.`;
    ogImage = album.cover_url || items[0]?.thumb_url || items[0]?.media_url || ogImage;
  }

  const title = `${name} · ${pageLabel} · Dronie`;
  const desc = truncate(description);

  // Structured data
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    alternateName: username ? `@${username}` : undefined,
    url: base,
    image: profile.avatar_url || undefined,
    description: profile.headline || profile.bio || undefined,
    address: profile.location
      ? { "@type": "PostalPlace", name: profile.location }
      : undefined,
    sameAs: [
      profile.website,
      profile.instagram,
      profile.linkedin,
      profile.twitter,
      profile.youtube,
      profile.vimeo,
      profile.tiktok,
    ].filter(Boolean),
    jobTitle: "Drone pilot",
    knowsAbout: profile.services?.length
      ? profile.services
      : ["Aerial photography", "Drone cinematography", "Photogrammetry"],
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Dronie", item: SITE },
      { "@type": "ListItem", position: 2, name, item: base },
      ...(mode !== "home"
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: pageLabel,
              item: path,
            },
          ]
        : []),
    ],
  };

  const photoItems = items.filter((i) => i.kind === "photo");
  const videoItems = items.filter((i) => i.kind === "video");

  const collection =
    mode === "album" && album
      ? {
          "@context": "https://schema.org",
          "@type": "ImageGallery",
          name: album.title,
          description: album.description || undefined,
          url: path,
          author: { "@type": "Person", name, url: base },
          dateCreated: album.created_at,
          dateModified: album.updated_at,
          image: photoItems
            .slice(0, 24)
            .map((p) => p.media_url || p.thumb_url)
            .filter(Boolean),
          numberOfItems: items.length,
        }
      : null;

  const videoLd =
    mode === "album" && album && videoItems.length > 0
      ? videoItems.slice(0, 6).map((v) => ({
          "@context": "https://schema.org",
          "@type": "VideoObject",
          name: v.title || album.title,
          description: v.caption || album.description || album.title,
          thumbnailUrl: v.thumb_url || undefined,
          contentUrl: v.media_url || undefined,
          uploadDate: v.created_at,
          duration: v.duration_s ? `PT${Math.round(v.duration_s)}S` : undefined,
          author: { "@type": "Person", name, url: base },
        }))
      : [];

  const robots = published ? "index, follow" : "noindex, nofollow";

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={desc} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={path} />

      <meta property="og:type" content={mode === "album" ? "article" : "profile"} />
      <meta property="og:site_name" content="Dronie" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={path} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      {username && <meta property="profile:username" content={username} />}

      <meta name="twitter:card" content={ogImage ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={desc} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}
      {profile.twitter && (
        <meta
          name="twitter:creator"
          content={`@${profile.twitter.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0]}`}
        />
      )}

      <script type="application/ld+json">{JSON.stringify(person)}</script>
      <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
      {collection && (
        <script type="application/ld+json">{JSON.stringify(collection)}</script>
      )}
      {videoLd.map((v, idx) => (
        <script key={idx} type="application/ld+json">
          {JSON.stringify(v)}
        </script>
      ))}
    </Helmet>
  );
}
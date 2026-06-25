import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Map } from "lucide-react";

interface Props {
  title: string;
  description: string;
  path: string;
  h1: string;
  kicker?: string;
  children: ReactNode;
  updated?: string;
}

export default function GuideLayout({ title, description, path, h1, kicker, children, updated = "2026-06-25" }: Props) {
  const url = `https://dronieapp.com${path}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: h1,
    description,
    author: { "@type": "Organization", name: "Dronie" },
    publisher: {
      "@type": "Organization",
      name: "Dronie",
      url: "https://dronieapp.com",
    },
    datePublished: updated,
    dateModified: updated,
    mainEntityOfPage: url,
  };
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={h1} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={h1} />
        <meta name="twitter:description" content={description} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-6 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Map className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-display font-700 text-foreground">Dronie</span>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <Link to="/guides" className="text-sm text-muted-foreground hover:text-foreground">Guides</Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-3xl">
        <Link to="/guides" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-3.5 h-3.5" /> All guides
        </Link>
        {kicker && <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-3">{kicker}</p>}
        <h1 className="font-display font-700 text-4xl text-foreground mb-4 leading-tight">{h1}</h1>
        <p className="text-sm text-muted-foreground mb-10">Updated {updated} · By the Dronie team</p>
        <article className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-muted-foreground prose-headings:text-foreground prose-headings:font-display prose-strong:text-foreground prose-a:text-primary">
          {children}
        </article>

        <div className="mt-16 pt-8 border-t border-border">
          <h2 className="text-lg font-display font-700 text-foreground mb-4">Keep reading</h2>
          <ul className="space-y-2 text-sm">
            <li><Link className="text-primary hover:underline" to="/guides/drone-photogrammetry">The complete guide to drone photogrammetry</Link></li>
            <li><Link className="text-primary hover:underline" to="/guides/orthomosaic-dsm-dtm">Orthomosaic vs DSM vs DTM vs point cloud</Link></li>
            <li><Link className="text-primary hover:underline" to="/guides/gaussian-splatting">Gaussian splatting for drone capture</Link></li>
            <li><Link className="text-primary hover:underline" to="/guides/gsd-ground-sample-distance">Ground sample distance (GSD) explained</Link></li>
            <li><Link className="text-primary hover:underline" to="/guides/part-107-laanc">Part 107 &amp; LAANC: a working pilot's checklist</Link></li>
          </ul>
        </div>
      </main>
    </div>
  );
}
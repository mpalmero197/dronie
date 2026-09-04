import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Map, BookOpen } from "lucide-react";

const guides = [
  {
    path: "/guides/drone-photogrammetry",
    title: "The complete guide to drone photogrammetry",
    description: "How drone photogrammetry works end to end — from flight plan to orthomosaic, DSM, point cloud, and 3D model — for working pilots and surveyors.",
    tag: "Foundation",
  },
  {
    path: "/guides/orthomosaic-dsm-dtm",
    title: "Orthomosaic vs DSM vs DTM vs point cloud",
    description: "What each photogrammetry deliverable actually is, how it's derived, and which one to send the client for mapping, volumes, design, or inspection.",
    tag: "Deliverables",
  },
  {
    path: "/guides/gaussian-splatting",
    title: "Gaussian splatting for drone capture",
    description: "What 3D Gaussian Splatting is, how it differs from photogrammetry and NeRF, what capture pattern works, and where splats win for real estate, marketing, and inspection.",
    tag: "3D / splats",
  },
  {
    path: "/guides/gsd-ground-sample-distance",
    title: "Ground sample distance (GSD) explained",
    description: "How to calculate GSD from sensor size, focal length, and altitude — and how GSD drives accuracy, overlap, flight time, and deliverable quality.",
    tag: "Mission math",
  },
  {
    path: "/guides/part-107-laanc",
    title: "Part 107 & LAANC: a working pilot's checklist",
    description: "The U.S. commercial drone rules in plain English — Part 107 limits, waivers, airspace classes, and how to file LAANC authorizations before you fly.",
    tag: "Regulations",
  },
  {
    path: "/guides/part-146-automated-data-service-provider",
    title: "Automated Data Service Providers under Part 146",
    description: "What an ADSP is, how strategic deconfliction and conformance monitoring work, and the records providers and BVLOS operators must keep.",
    tag: "Regulations",
  },
];

export default function GuidesIndex() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Drone photogrammetry guides",
    url: "https://dronieapp.com/guides",
    description:
      "Long-form, vendor-neutral guides to drone photogrammetry, orthomosaics, DSM/DTM, Gaussian splatting, GSD math, and Part 107 / LAANC compliance.",
    hasPart: guides.map((g) => ({
      "@type": "Article",
      headline: g.title,
      url: `https://dronieapp.com${g.path}`,
      description: g.description,
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Drone Photogrammetry Guides | Dronie</title>
        <meta
          name="description"
          content="Long-form, vendor-neutral guides for working drone pilots: photogrammetry, orthomosaics, DSM/DTM, point clouds, Gaussian splatting, GSD math, and Part 107 / LAANC."
        />
        <link rel="canonical" href="https://dronieapp.com/guides" />
        <meta property="og:title" content="Drone Photogrammetry Guides" />
        <meta property="og:description" content="Long-form guides to drone photogrammetry, splats, GSD, and Part 107 / LAANC." />
        <meta property="og:url" content="https://dronieapp.com/guides" />
        <meta property="og:type" content="website" />
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
          <span className="text-sm text-muted-foreground">Guides</span>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>
        <div className="flex items-center gap-2 text-primary mb-3">
          <BookOpen className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider font-semibold">Field reference</span>
        </div>
        <h1 className="font-display font-700 text-4xl text-foreground mb-3">Drone photogrammetry guides</h1>
        <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
          Long-form, vendor-neutral references for working pilots and mapping teams. Written by the Dronie crew —
          remote pilots and mapping engineers who fly the same jobs you do.
        </p>

        <div className="space-y-4">
          {guides.map((g) => (
            <Link
              key={g.path}
              to={g.path}
              className="block rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-wider text-primary font-semibold px-2 py-0.5 rounded-full bg-primary/10">
                  {g.tag}
                </span>
              </div>
              <h2 className="font-display font-700 text-foreground text-xl mb-1.5">{g.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{g.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
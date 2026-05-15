import { useParams, Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, Check, Briefcase } from "lucide-react";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import { VERTICALS, VERTICAL_LIST } from "./verticals.config";
import VerticalPilotsSection from "@/components/solutions/VerticalPilotsSection";

export default function VerticalLanding() {
  const { vertical } = useParams<{ vertical: string }>();
  const config = vertical ? VERTICALS[vertical] : null;

  if (!config) return <Navigate to="/" replace />;

  const Icon = config.icon;
  const url = `https://dronieapp.com/solutions/${config.slug}`;
  const title = `Drone services for ${config.name} | Dronieapp`;
  const description = config.intro.length > 160 ? config.intro.slice(0, 157) + "..." : config.intro;
  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Dronieapp drone services for ${config.name}`,
    serviceType: config.name,
    description: config.intro,
    provider: { "@type": "Organization", name: "Dronieapp", url: "https://dronieapp.com" },
    areaServed: "Worldwide",
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `${config.name} deliverables`,
      itemListElement: config.deliverables.map((d) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: d },
      })),
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:url" content={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <script type="application/ld+json">{JSON.stringify(serviceLd)}</script>
      </Helmet>
      <Navbar />

      {/* Hero */}
      <section className={`relative pt-28 pb-20 bg-gradient-to-br ${config.accent}`}>
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-card border border-border mb-6">
              <Icon className="w-3.5 h-3.5 text-primary" />
              <span className="text-foreground">For {config.name}</span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-display font-700 text-foreground leading-[1.05] mb-5">
              {config.headline}
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mb-8 leading-relaxed">
              {config.intro}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to={`/marketplace/new?vertical=${config.slug}`}>
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 font-semibold">
                  <Briefcase className="w-4 h-4" />
                  Request a pilot
                </Button>
              </Link>
              <Link to="/marketplace">
                <Button size="lg" variant="outline" className="gap-2 font-semibold">
                  Browse marketplace
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Trusted by:</span> {config.exampleClients}
            </p>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              {config.tagline}
            </span>
            <h2 className="mt-3 text-3xl font-display font-700 text-foreground">
              Built for {config.name.toLowerCase()} workflows
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {config.valueProps.map((vp) => (
              <div key={vp.title} className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Check className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display font-600 text-lg text-foreground mb-2">{vp.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{vp.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deliverables */}
      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-6">
          <h3 className="text-2xl font-display font-700 text-foreground mb-6">What you get</h3>
          <div className="flex flex-wrap gap-2">
            {config.deliverables.map((d) => (
              <span key={d} className="px-4 py-2 rounded-full bg-card border border-border text-sm font-medium text-foreground">
                {d}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pilots in this vertical */}
      <VerticalPilotsSection vertical={config.slug} verticalName={config.name} />

      {/* CTA */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="rounded-3xl bg-primary text-primary-foreground p-12 text-center">
            <h2 className="text-3xl font-display font-700 mb-3">Ready to fly?</h2>
            <p className="text-primary-foreground/80 mb-6 max-w-xl mx-auto">
              Post a request in under two minutes. Get matched with vetted pilots in your area.
            </p>
            <Link to={`/marketplace/new?vertical=${config.slug}`}>
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                Request a pilot for {config.name}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Other verticals */}
      <section className="py-16 bg-background border-t border-border">
        <div className="container mx-auto px-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            Explore other industries
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {VERTICAL_LIST.filter((v) => v.slug !== config.slug).map((v) => {
              const VIcon = v.icon;
              return (
                <Link
                  key={v.slug}
                  to={`/solutions/${v.slug}`}
                  className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all flex flex-col items-center text-center"
                >
                  <VIcon className="w-5 h-5 text-primary mb-2" />
                  <span className="text-xs font-semibold text-foreground">{v.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
import { useParams, Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, Check, Briefcase, Sparkles, MapPin, Clock, ShieldCheck } from "lucide-react";
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

      {/* Hero — asymmetric split */}
      <section className={`relative pt-28 pb-24 overflow-hidden bg-gradient-to-br ${config.accent}`}>
        {/* decorative grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)/0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)/0.4) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at top right, black, transparent 70%)",
          }}
        />
        <div className="container mx-auto px-6 relative">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-card border border-border mb-6">
                <Icon className="w-3.5 h-3.5 text-primary" />
                <span className="text-foreground">Solutions · {config.name}</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-display font-700 text-foreground leading-[1.03] mb-5 tracking-tight">
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

            {/* Icon feature card */}
            <div className="lg:col-span-5">
              <div className="relative">
                <div className="absolute -inset-4 rounded-3xl bg-primary/10 blur-2xl" aria-hidden />
                <div className="relative rounded-3xl border border-border bg-card/80 backdrop-blur p-8 shadow-xl">
                  <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${config.accent} border border-border flex items-center justify-center mb-6`}>
                    <Icon className="w-10 h-10 text-primary" />
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                    {config.tagline}
                  </div>
                  <div className="text-xl font-display font-600 text-foreground mb-6 leading-snug">
                    Purpose-built for {config.name.toLowerCase()} teams.
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-6 border-t border-border">
                    <div>
                      <div className="text-xl font-display font-700 text-foreground">{config.deliverables.length}+</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Deliverables</div>
                    </div>
                    <div>
                      <div className="text-xl font-display font-700 text-foreground">48h</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Avg turnaround</div>
                    </div>
                    <div>
                      <div className="text-xl font-display font-700 text-foreground">Part 107</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Certified</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-border bg-secondary/40">
        <div className="container mx-auto px-6 py-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Insured pilots</span>
          <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> LAANC-cleared airspace</span>
          <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> 48-hour deliveries</span>
          <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI-assisted QA</span>
        </div>
      </section>

      {/* Value props + sticky deliverables sidebar */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8">
              <div className="max-w-2xl mb-10">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Why {config.name}
                </span>
                <h2 className="mt-3 text-3xl lg:text-4xl font-display font-700 text-foreground tracking-tight">
                  Built for {config.name.toLowerCase()} workflows
                </h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {config.valueProps.map((vp, i) => (
                  <div
                    key={vp.title}
                    className="group relative p-6 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <div className="absolute top-6 right-6 text-xs font-mono font-semibold text-muted-foreground/40">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Check className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-display font-600 text-lg text-foreground mb-2">{vp.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{vp.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="lg:col-span-4">
              <div className="lg:sticky lg:top-24 p-6 rounded-2xl border border-border bg-secondary/50">
                <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                  What you get
                </div>
                <h3 className="text-xl font-display font-700 text-foreground mb-5">
                  Every deliverable, ready to hand off
                </h3>
                <ul className="space-y-2.5">
                  {config.deliverables.map((d) => (
                    <li key={d} className="flex items-start gap-3 text-sm text-foreground">
                      <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary" />
                      </span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={`/marketplace/new?vertical=${config.slug}`}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80"
                >
                  Scope your project <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* How it works — 3 steps */}
      <section className="py-16 bg-secondary/40 border-y border-border">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "01", t: "Post your job", d: `Describe the ${config.name.toLowerCase()} scope, drop a pin, pick deliverables.` },
              { n: "02", t: "Match with a pilot", d: "Vetted Part 107 pilots in your area quote within hours." },
              { n: "03", t: "Get delivered work", d: "Processed outputs, share links, and audit-ready reports." },
            ].map((s) => (
              <div key={s.n} className="relative p-6 rounded-2xl bg-background border border-border">
                <div className="text-4xl font-display font-700 text-primary/30 mb-3">{s.n}</div>
                <h4 className="font-display font-600 text-lg text-foreground mb-1.5">{s.t}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pilots in this vertical */}
      <VerticalPilotsSection vertical={config.slug} verticalName={config.name} />

      {/* CTA */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-12 text-center">
            <div
              aria-hidden
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 20%, hsl(var(--accent)) 0, transparent 40%), radial-gradient(circle at 80% 80%, hsl(var(--primary-foreground)) 0, transparent 40%)",
              }}
            />
            <div className="relative">
              <h2 className="text-3xl lg:text-4xl font-display font-700 mb-3">Ready to fly?</h2>
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
        </div>
      </section>

      {/* Other verticals */}
      <section className="py-16 bg-background border-t border-border">
        <div className="container mx-auto px-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            Explore other industries
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {VERTICAL_LIST.filter((v) => v.slug !== config.slug).map((v) => {
              const VIcon = v.icon;
              return (
                <Link
                  key={v.slug}
                  to={`/solutions/${v.slug}`}
                  className="group p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all flex flex-col items-center text-center"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <VIcon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-foreground leading-tight">{v.name}</span>
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
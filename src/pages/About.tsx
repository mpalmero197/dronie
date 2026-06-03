import { ArrowLeft, Map, Compass, Shield, Rocket, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>About Dronie | Drone Photogrammetry, Built for the Field</title>
        <meta
          name="description"
          content="Dronie is the cloud photogrammetry, flight planning, and pilot-marketplace platform built by Halcyon Systems Group for working drone professionals."
        />
        <link rel="canonical" href="https://dronieapp.com/about" />
        <meta property="og:title" content="About Dronie" />
        <meta property="og:description" content="Cloud photogrammetry, terrain-aware flight planning, and a verified pilot marketplace — built by drone pilots, for drone pilots." />
        <meta property="og:url" content="https://dronieapp.com/about" />
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
          <span className="text-sm text-muted-foreground">About</span>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>

        <h1 className="font-display font-700 text-4xl text-foreground mb-3">Built by pilots, for pilots.</h1>
        <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
          Dronie is a product of <strong className="text-foreground">Halcyon Systems Group</strong> — a small
          team of remote pilots, mapping engineers, and software builders who got tired of duct-taping together
          five different tools to fly one job.
        </p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">Our mission</h2>
            <p>
              Make professional drone work — planning, flying, processing, delivering, and getting paid —
              feel like one fluid workflow instead of a stack of half-integrated apps. We believe the field
              should run the software, not the other way around.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">What we build</h2>
            <div className="grid sm:grid-cols-2 gap-4 not-prose mt-4">
              {[
                { icon: Compass, t: "Terrain-aware flight planning", d: "Waypoint missions that hug the ground, with built-in LAANC checks and exports for DJI, Autel, Parrot, and Litchi." },
                { icon: Rocket, t: "Cloud photogrammetry", d: "Orthomosaics, point clouds, DSM/DTM, contour maps, and Gaussian splats processed in the cloud — no desktop required." },
                { icon: Users, t: "Pilot marketplace", d: "A verified, FAA-Airmen-Registry-checked roster of Part 107 pilots clients can hire directly, with Stripe Connect payouts." },
                { icon: Shield, t: "Compliance, baked in", d: "Track Part 107 currency, recurrent training, drone registrations, and Remote ID — so audits never catch you sideways." },
              ].map((it) => (
                <div key={it.t} className="rounded-lg border border-border bg-card p-4">
                  <it.icon className="w-5 h-5 text-primary mb-2" />
                  <div className="font-semibold text-foreground text-sm">{it.t}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{it.d}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Who it's for</h2>
            <p>
              Construction GCs flying weekly progress maps. Real-estate shooters delivering same-day
              cinematic edits. Ag pilots tracking crop health across seasons. Energy and utilities
              inspecting linear assets. Surveyors who need RTK-grade accuracy without the desktop tax.
              Independent Part 107 pilots stitching together a real business.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Where we're based</h2>
            <p>
              Halcyon Systems Group is a US-incorporated software company. Our cloud infrastructure runs
              in SOC 2-aligned, EU- and US-region datacenters. We support pilots and operators globally
              and align with FAA Part 107, EASA, UK CAA, Transport Canada, and CASA frameworks.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Talk to us</h2>
            <p>
              We answer every email. For partnerships, press, support, or enterprise procurement, head
              to the <Link to="/contact" className="text-primary hover:underline">Contact</Link> page.
              Pilots looking to join the marketplace can <Link to="/pilots/join" className="text-primary hover:underline">sign up here</Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

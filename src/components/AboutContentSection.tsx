import { Plane, Layers3, Cpu, Globe2 } from "lucide-react";

export default function AboutContentSection() {
  return (
    <section id="about" className="py-24 bg-secondary/20 border-y border-border">
      <div className="container mx-auto px-6 max-w-5xl">
        <div className="grid lg:grid-cols-3 gap-10 items-start">
          <div className="lg:col-span-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              The platform
            </span>
            <h2 className="mt-3 text-4xl font-display font-700 text-foreground leading-tight">
              The fastest way to turn drone imagery into actionable maps
            </h2>
          </div>

          <div className="lg:col-span-2 space-y-5 text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Dronie</strong> is a
              browser-based drone photogrammetry platform built for surveyors,
              construction managers, agronomists, real-estate developers, and
              emergency-response teams who need accurate orthomosaics and 3D
              models without a $4,000 desktop license. Upload imagery from any
              UAV — DJI Mavic, Phantom, Matrice, Autel EVO, Parrot Anafi,
              senseFly eBee — and the cloud pipeline produces georeferenced
              GeoTIFF orthomosaics, LAS/LAZ point clouds, DSM/DTM rasters,
              SHP contour lines, and photorealistic Gaussian splats in a
              single pass.
            </p>
            <p>
              Behind the scenes, Dronie runs an open Structure-from-Motion
              (SfM) and Multi-View Stereo (MVS) pipeline based on WebODM with
              a custom Gaussian splat trainer layered on top. Every project
              gets a sharable interactive map viewer, a one-page flight
              report PDF, and an embeddable widget you can drop on any
              client site. There is nothing to install — projects start
              processing the moment your upload finishes.
            </p>
            <p>
              Dronie also operates a verified pilot marketplace and public
              portfolio network at <strong className="text-foreground">dronieapp.com/u/your-name</strong>.
              Clients can browse a live map of Part 107-certified pilots,
              request quotes, and pay through Stripe Connect with a flat
              1% connection fee — pilots always receive their full asking
              price.
            </p>

            <div className="grid sm:grid-cols-2 gap-3 pt-4">
              {[
                { icon: Cpu, t: "Cloud SfM + MVS pipeline", d: "WebODM-powered, no install" },
                { icon: Layers3, t: "Open output formats", d: "GeoTIFF · LAS · SHP · DXF · KMZ" },
                { icon: Plane, t: "Any UAV supported", d: "DJI · Autel · Parrot · senseFly" },
                { icon: Globe2, t: "Built-in marketplace", d: "Hire verified Part 107 pilots" },
              ].map(({ icon: Icon, t, d }) => (
                <div key={t} className="flex gap-3 p-3 rounded-xl bg-card border border-border">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t}</p>
                    <p className="text-xs text-muted-foreground">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

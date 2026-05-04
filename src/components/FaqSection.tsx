import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "What is Dronie?",
    a: "Dronie is a cloud-based drone photogrammetry platform that turns aerial imagery into georeferenced orthomosaics, 3D point clouds, digital surface models (DSM), digital terrain models (DTM), contour maps, and Gaussian splats. It also includes terrain-aware flight planning, fleet management with live telemetry, a pilot marketplace with Stripe Connect payouts, and a public portfolio site for every operator at dronieapp.com/u/your-name.",
  },
  {
    q: "How does drone photogrammetry work on Dronie?",
    a: "You plan a survey on the in-app map with terrain-following waypoints, fly the mission with any DJI, Autel, Parrot, or senseFly drone, then drag-and-drop the JPEGs or TIFFs into a project. Our pipeline runs Structure-from-Motion (SfM) and Multi-View Stereo (MVS) on the imagery to align cameras, build a dense point cloud, and stitch a georeferenced orthomosaic. Outputs are exported as GeoTIFF, LAS/LAZ, SHP, DXF, and KMZ — compatible with ArcGIS, QGIS, AutoCAD, and CloudCompare.",
  },
  {
    q: "How is Dronie different from DroneDeploy or Maps Made Easy?",
    a: "Dronie is faster and significantly cheaper than DroneDeploy and Maps Made Easy for the same outputs. There is no desktop install, no per-image surcharge on the free tier, and Gaussian splat training is included on paid plans — most competitors charge separately or do not support splats at all. Dronie also bundles a public pilot marketplace, portfolio sites, and fleet telemetry that traditional photogrammetry tools do not offer.",
  },
  {
    q: "How much does Dronie cost?",
    a: "The Free plan includes 3 projects per month with up to 500 images per project — no credit card required. The Professional plan is $49/month and unlocks unlimited projects, priority processing, 50 GB of storage, and Gaussian splat training. The Enterprise plan is $149/month and adds unlimited images per project, API access, a white-label embeddable viewer, and an SLA guarantee. Marketplace clients pay a flat 1% platform fee on top of the pilot's quoted price.",
  },
  {
    q: "What file formats and drones are supported?",
    a: "Dronie accepts JPEG, TIFF, and DNG imagery from any consumer or enterprise UAV, including the full DJI lineup (Mavic, Air, Mini, Phantom, Matrice), Autel EVO series, Parrot Anafi, and senseFly eBee. Outputs include GeoTIFF orthomosaics, LAS/LAZ point clouds, GeoTIFF DSM and DTM rasters, SHP/DXF/KMZ contour lines, .ply / .splat / .ksplat Gaussian splats, and a one-page flight report PDF.",
  },
  {
    q: "Is Dronie compliant with FAA Part 107 and LAANC?",
    a: "Yes. Dronie's compliance dashboard tracks Part 107 certifications, biennial recurrent training dates, drone registration numbers, and maintenance cycles. Flight planning includes built-in LAANC airspace classification overlays so you can confirm controlled-airspace authorization before launch. Pilot data is stored encrypted and is GDPR-friendly.",
  },
  {
    q: "Can I hire a drone pilot through Dronie?",
    a: "Yes. The Dronie Marketplace connects clients with verified Part 107 pilots worldwide. Browse the live pilot map, view public portfolios, request a quote, and pay securely through Stripe Connect — pilots receive their full asking price and the client pays a 1% connection fee. Higher subscription tiers get first access to new client requests.",
  },
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-24 bg-background">
      <div className="container mx-auto px-6 max-w-4xl">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Frequently asked questions
          </span>
          <h2 className="mt-3 text-4xl font-display font-700 text-foreground">
            Drone photogrammetry, answered
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Everything surveyors, agronomists, real-estate teams, and
            construction managers ask before switching their mapping workflow
            to Dronie.
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <article
                key={f.q}
                className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-colors"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left"
                  aria-expanded={isOpen}
                >
                  <h3 className="font-display font-600 text-foreground text-lg">
                    {f.q}
                  </h3>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 -mt-1">
                    <p className="text-muted-foreground leading-relaxed">
                      {f.a}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

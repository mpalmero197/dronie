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
    q: "How fast can I get my 3D models processed?",
    a: "Dronieapp is optimized for speed and typically delivers processed orthomosaics and 3D models in under an hour for standard 500-image flight datasets, and in 90 minutes or less for 1,200-image surveys. By leveraging high-performance cloud computing, it eliminates the GPU and RAM bottlenecks of traditional desktop photogrammetry software like Pix4D or Agisoft Metashape — typically 3–5× faster end-to-end.",
  },
  {
    q: "How is Dronie different from DroneDeploy or Maps Made Easy?",
    a: "Dronie is faster and significantly cheaper than DroneDeploy and Maps Made Easy for the same outputs. There is no desktop install, no per-image surcharge on the entry Pilot plan, and Gaussian splat training is included on higher plans — most competitors charge separately or do not support splats at all. Dronie also bundles a public pilot marketplace, portfolio sites, and fleet telemetry that traditional photogrammetry tools do not offer.",
  },
  {
    q: "How much does Dronie cost?",
    a: "The Pilot plan is $9/month and includes 3 projects per month with up to 500 images per project. The Professional plan is $49/month and unlocks unlimited projects, priority processing, 50 GB of storage, and Gaussian splat training. The Enterprise plan is $149/month and adds unlimited images per project, API access, a white-label embeddable viewer, and an SLA guarantee. Marketplace clients pay a flat 1% platform fee on top of the pilot's quoted price.",
  },
  {
    q: "What file formats and drones are supported?",
    a: "Dronie accepts JPEG, TIFF, and DNG imagery from any consumer or enterprise UAV, including the full DJI lineup (Mavic, Air, Mini, Phantom, Matrice), Autel EVO series, Parrot Anafi, and senseFly eBee. Outputs include GeoTIFF orthomosaics, LAS/LAZ point clouds, GeoTIFF DSM and DTM rasters, SHP/DXF/KMZ contour lines, .ply / .splat / .ksplat Gaussian splats, and a one-page flight report PDF.",
  },
  {
    q: "Which CAD and GIS software does Dronieapp integrate with?",
    a: "Dronieapp's outputs are designed to drop straight into the tools surveyors and engineers already use. GeoTIFF orthomosaics and DSM/DTM rasters open natively in Esri ArcGIS Pro, QGIS, and Global Mapper. LAS/LAZ point clouds work in CloudCompare, Trimble Business Center, Bentley ContextCapture, and Autodesk ReCap. DXF, SHP, and KMZ contour lines import directly into AutoCAD, Civil 3D, Carlson, and Revit. OBJ and FBX textured meshes work in Blender, 3ds Max, Unreal Engine, and Unity.",
  },
  {
    q: "Is Dronie compliant with FAA Part 107 and LAANC?",
    a: "Yes. Dronie's compliance dashboard tracks Part 107 certifications, biennial recurrent training dates, drone registration numbers, and maintenance cycles. Flight planning includes built-in LAANC airspace classification overlays so you can confirm controlled-airspace authorization before launch. Pilot data is stored encrypted and is GDPR-friendly.",
  },
  {
    q: "Can I hire a drone pilot through Dronie?",
    a: "Yes. The Dronie Marketplace connects clients with verified Part 107 pilots worldwide. Browse the live pilot map, view public portfolios, request a quote, and pay securely through Stripe Connect — pilots receive their full asking price and the client pays a 1% connection fee. Higher subscription tiers get first access to new client requests.",
  },
  {
    q: "Why did my Gaussian splat come out blurry or spiky?",
    a: "3D Gaussian Splatting is unforgiving to four things: weak Structure-from-Motion poses (low overlap, poor GPS/RTK), shifting lighting during the flight (long missions or fast-moving shadows), non-static elements in the scene (wind in foliage, water, traffic, people) and CMOS rolling-shutter distortion on consumer drones. Each one corrupts the per-particle covariance optimization, producing smeared, spiky or blown-out regions. The Dronie splat studio runs you through a pre-flight checklist before every training run so you can flag these conditions and decide whether to re-fly before burning compute.",
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

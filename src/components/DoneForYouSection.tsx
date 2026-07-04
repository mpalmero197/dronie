import { useNavigate } from "react-router-dom";
import { Building2, ShieldCheck, Home, Mountain, Layers, Repeat, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const packages = [
  {
    icon: Building2,
    name: "Construction Progress Map",
    price: "from $299",
    unit: "per site visit",
    desc: "Orthomosaic + contour lines + monthly cut/fill comparison. Ideal for GCs tracking site development.",
    bullets: ["Georeferenced GeoTIFF", "Contours (SHP/DXF)", "Progress vs prior visit"],
  },
  {
    icon: ShieldCheck,
    name: "Roof / Insurance Inspection",
    price: "from $199",
    unit: "per property",
    desc: "High-res damage detection map with DSM overlays. Delivered as a claim-ready PDF.",
    bullets: ["4K annotated imagery", "Damage heatmap", "Adjuster-ready PDF"],
  },
  {
    icon: Home,
    name: "Real Estate Aerial & 3D Tour",
    price: "from $349",
    unit: "per listing",
    desc: "Marketing stills, cinematic aerial video, and a shareable 3D point cloud for high-end properties.",
    bullets: ["12+ retouched photos", "60s cinematic reel", "Embeddable 3D tour"],
  },
  {
    icon: Mountain,
    name: "Land Survey Prep Pack",
    price: "from $399",
    unit: "per parcel",
    desc: "GCP-controlled orthomosaic and DTM sized for surveyor handoff. Sub-centimeter with RTK.",
    bullets: ["RTK/PPK ready", "DTM + contours", "LandXML export"],
  },
  {
    icon: Layers,
    name: "Stockpile Volume Report",
    price: "from $249",
    unit: "per site",
    desc: "Fast volumetric measurements of earth or material stockpiles. Signed PDF report in 48h.",
    bullets: ["Cubic yard totals", "Per-pile breakdown", "Change vs last scan"],
  },
  {
    icon: Repeat,
    name: "Recurring Site Retainer",
    price: "$300 – $1,500",
    unit: "per month",
    desc: "Scheduled repeat capture with delta reports. Common for construction, energy, mining, and ag.",
    bullets: ["Weekly or monthly flights", "Timeline dashboard", "Priority pilot dispatch"],
  },
];

export default function DoneForYouSection() {
  const navigate = useNavigate();

  return (
    <section id="services" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Done-For-You
          </span>
          <h2 className="mt-3 text-4xl font-display font-700 text-foreground">
            Skip the software. Get the deliverable.
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Fixed-price packages processed by our verified pilot network. You get a finished business decision — not a folder of raw files.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {packages.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.name}
                className="group rounded-2xl bg-card border border-border p-6 flex flex-col transition-all hover:border-primary/40 hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-right">
                    <div className="font-display font-700 text-foreground">{p.price}</div>
                    <div className="text-[11px] text-muted-foreground">{p.unit}</div>
                  </div>
                </div>
                <h3 className="font-display font-700 text-lg text-foreground mb-2">
                  {p.name}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                  {p.desc}
                </p>
                <ul className="space-y-1.5 mb-5">
                  {p.bullets.map((b) => (
                    <li key={b} className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-primary" />
                      {b}
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  className="group/btn w-full justify-between"
                  onClick={() => navigate("/marketplace/new")}
                >
                  <span>Request quote</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center text-xs text-muted-foreground">
          Per-project processing runs <span className="font-semibold text-foreground">$99–$499</span> depending on acreage &amp; complexity ·
          {" "}Platform fee 1% · Pilots keep 99% of quoted price
        </div>
      </div>
    </section>
  );
}
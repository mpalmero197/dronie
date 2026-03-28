import { useEffect, useRef } from "react";
import {
  Map,
  Box,
  Waves,
  FileDown,
  Zap,
  Globe,
  Share2,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    icon: Map,
    title: "Orthomosaic Maps",
    desc: "Georeferenced, stitched top-down imagery corrected for camera tilt and terrain distortion. Export as GeoTIFF.",
    color: "text-primary",
    bg: "bg-secondary",
  },
  {
    icon: Box,
    title: "3D Point Clouds",
    desc: "Dense photogrammetric point clouds in LAS/LAZ format. Compatible with CloudCompare, ArcGIS, and AutoCAD.",
    color: "text-highlight",
    bg: "bg-highlight/10",
  },
  {
    icon: Waves,
    title: "DSM & DTM",
    desc: "Digital surface and terrain models with sub-metre vertical accuracy for volume calculations and hydrology.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: FileDown,
    title: "Contour Lines",
    desc: "Auto-generated contour lines with configurable intervals. Export to SHP, DXF, or KMZ for any GIS workflow.",
    color: "text-primary",
    bg: "bg-secondary",
  },
  {
    icon: Zap,
    title: "Cloud Processing",
    desc: "No local compute required. Upload your images and track processing progress in real time from any browser.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: Globe,
    title: "Map Viewer",
    desc: "Share interactive maps with clients via a link. Zoom, measure, and annotate directly in the browser.",
    color: "text-highlight",
    bg: "bg-highlight/10",
  },
  {
    icon: Share2,
    title: "Share & Embed",
    desc: "Share interactive map links with clients. Embed your maps on any website with a single code snippet.",
    color: "text-primary",
    bg: "bg-secondary",
  },
  {
    icon: ShieldCheck,
    title: "GDPR Compliant",
    desc: "Your data is encrypted at rest and in transit. Hosted on ISO 27001-certified infrastructure with daily backups.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
];

export default function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cards = section.querySelectorAll(".feature-card");
            cards.forEach((card, i) => {
              setTimeout(() => {
                (card as HTMLElement).style.opacity = "1";
                (card as HTMLElement).style.transform = "translateY(0)";
                (card as HTMLElement).style.filter = "blur(0)";
              }, i * 75);
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" ref={sectionRef} className="py-24 bg-background">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            What you get
          </span>
          <h2 className="mt-3 text-4xl font-display font-700 text-foreground">
            Every output your project needs
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            One upload generates a full suite of deliverables. Download them
            individually or as a complete project archive.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="feature-card group p-6 bg-card rounded-2xl border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 cursor-default"
                style={{
                  opacity: 0,
                  transform: "translateY(16px)",
                  filter: "blur(4px)",
                  transition:
                    "opacity 0.55s cubic-bezier(0.16,1,0.3,1), transform 0.55s cubic-bezier(0.16,1,0.3,1), filter 0.55s cubic-bezier(0.16,1,0.3,1), border-color 0.2s, box-shadow 0.2s",
                }}
              >
                <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="font-display font-600 text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

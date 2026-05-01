import { useEffect, useRef } from "react";
import { Upload, Cpu, MapPin, Download, Camera } from "lucide-react";

const steps = [
  {
    icon: Upload,
    step: "01",
    title: "Fly & Upload",
    desc: "Complete your drone survey using any UAV. Upload your JPEG or TIFF images — we accept DJI, Autel, Parrot, senseFly, and more. No special formats required.",
    detail: "Drag & drop or folder upload · JPEG, TIFF, DNG",
    color: "text-primary",
    accent: "bg-primary",
  },
  {
    icon: Cpu,
    step: "02",
    title: "Cloud Processing",
    desc: "Our photogrammetry engine runs SfM (Structure from Motion) and MVS (Multi-View Stereo) algorithms on your imagery. Track progress in real time.",
    detail: "Automated pipeline · Real-time progress tracking",
    color: "text-accent",
    accent: "bg-accent",
  },
  {
    icon: MapPin,
    step: "03",
    title: "Review & Annotate",
    desc: "Inspect your orthomosaic and 3D model in the interactive browser viewer. Add measurements, annotations, and share with clients via link.",
    detail: "Measure area · Add GCPs · Embed in any website",
    color: "text-highlight",
    accent: "bg-highlight",
  },
  {
    icon: Download,
    step: "04",
    title: "Export & Deliver",
    desc: "Download your full output package: GeoTIFF orthomosaic, LAS point cloud, DSM/DTM rasters, contour SHP, and flight report PDF.",
    detail: "GeoTIFF · LAS/LAZ · SHP · KMZ · DXF",
    color: "text-primary",
    accent: "bg-primary",
  },
  {
    icon: Camera,
    step: "05",
    title: "Publish Your Portfolio",
    desc: "Showcase finished projects, photos, and videos on your own public page at dronieapp.com/u/your-name. Curate albums, control per-item visibility, and win the next gig.",
    detail: "Custom URL · Albums · Per-item privacy",
    color: "text-accent",
    accent: "bg-accent",
  },
];

export default function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const items = section.querySelectorAll(".step-item");
            items.forEach((item, i) => {
              setTimeout(() => {
                (item as HTMLElement).style.opacity = "1";
                (item as HTMLElement).style.transform = "translateY(0)";
                (item as HTMLElement).style.filter = "blur(0)";
              }, i * 120);
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
    <section id="how-it-works" ref={sectionRef} className="py-24 bg-secondary/40">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="max-w-2xl mb-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Workflow
          </span>
          <h2 className="mt-3 text-4xl font-display font-700 text-foreground">
            From raw flight to<br />finished deliverables
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            A streamlined four-step process designed for surveyors, agronomists, engineers, and real estate developers.
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Connecting line (desktop) */}
          <div className="hidden lg:block absolute top-9 left-[10%] right-[10%] h-0.5 bg-border" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <article
                  key={s.step}
                  className="step-item relative"
                  style={{
                    opacity: 0,
                    transform: "translateY(20px)",
                    filter: "blur(4px)",
                    transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s, filter 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s`,
                  }}
                >
                  {/* Icon circle */}
                  <div className="flex lg:justify-start items-start mb-6">
                    <div className={`relative w-[72px] h-[72px] rounded-2xl ${s.accent} flex items-center justify-center shadow-lg flex-shrink-0`}>
                      <Icon className="w-7 h-7 text-white" />
                      <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-card border-2 border-border text-xs font-display font-700 text-muted-foreground flex items-center justify-center">
                        {i + 1}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-display font-700 text-xl text-foreground mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">{s.desc}</p>
                  <p className="text-xs font-medium text-primary border-t border-border pt-3">{s.detail}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

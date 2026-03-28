import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Layers, Download } from "lucide-react";
import heroMap from "@/assets/hero-map.jpg";
import droneHero from "@/assets/drone-hero.jpg";
import { useAuth } from "@/contexts/AuthContext";

const stats = [
  { value: "GeoTIFF", label: "Ortho export" },
  { value: "LAS/LAZ", label: "Point clouds" },
  { value: "SHP/DXF", label: "Contour lines" },
  { value: "Browser", label: "Map viewer" },
];

export default function HeroSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = [
      { el: headlineRef.current, delay: 0 },
      { el: subRef.current, delay: 120 },
      { el: ctaRef.current, delay: 240 },
      { el: statsRef.current, delay: 380 },
      { el: imageRef.current, delay: 180 },
    ];

    els.forEach(({ el, delay }) => {
      if (!el) return;
      setTimeout(() => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0) translateX(0)";
        el.style.filter = "blur(0)";
      }, delay + 100);
    });
  }, []);

  function handleUploadCTA() {
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/auth");
    }
  }

  return (
    <section className="relative min-h-screen flex flex-col pt-16 overflow-hidden bg-foreground">
      {/* Background map image */}
      <div className="absolute inset-0">
        <img
          src={heroMap}
          alt="Aerial orthomosaic map"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-foreground/90 via-foreground/70 to-primary/80" />
      </div>

      <div className="relative container mx-auto px-6 flex-1 flex items-center">
        <div className="grid lg:grid-cols-2 gap-12 items-center py-20 w-full">
          {/* Left: Text */}
          <div className="space-y-8">
            {/* Badge */}
            <div
              ref={headlineRef as any}
              style={{
                opacity: 0,
                transform: "translateY(16px)",
                filter: "blur(4px)",
                transition: "opacity 0.65s cubic-bezier(0.16,1,0.3,1), transform 0.65s cubic-bezier(0.16,1,0.3,1), filter 0.65s cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-accent/20 text-accent border border-accent/30 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
                Drone Photogrammetry Processing
              </span>
              <h1 className="text-5xl lg:text-6xl font-display font-700 text-primary-foreground leading-[1.05]">
                Turn Drone Flights<br />
                Into{" "}
                <span className="text-accent">Precise Maps</span>
              </h1>
            </div>

            <p
              ref={subRef}
              style={{
                opacity: 0,
                transform: "translateY(16px)",
                filter: "blur(4px)",
                transition: "opacity 0.65s cubic-bezier(0.16,1,0.3,1) 0.12s, transform 0.65s cubic-bezier(0.16,1,0.3,1) 0.12s, filter 0.65s cubic-bezier(0.16,1,0.3,1) 0.12s",
              }}
              className="text-lg text-primary-foreground/70 leading-relaxed max-w-lg"
            >
              Upload your drone imagery and receive georeferenced orthomosaics,
              3D point clouds, DSMs, and contour maps — processed automatically
              in the cloud.
            </p>

            <div
              ref={ctaRef}
              style={{
                opacity: 0,
                transform: "translateY(16px)",
                filter: "blur(4px)",
                transition: "opacity 0.65s cubic-bezier(0.16,1,0.3,1) 0.24s, transform 0.65s cubic-bezier(0.16,1,0.3,1) 0.24s, filter 0.65s cubic-bezier(0.16,1,0.3,1) 0.24s",
              }}
              className="flex flex-wrap gap-3"
            >
              <Button
                size="lg"
                onClick={handleUploadCTA}
                className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg hover:shadow-xl transition-all active:scale-[0.97] font-semibold gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload Images Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/viewer/demo")}
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 gap-2 transition-all active:scale-[0.97]"
              >
                See Example Maps
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Stats */}
            <div
              ref={statsRef}
              style={{
                opacity: 0,
                transform: "translateY(16px)",
                filter: "blur(4px)",
                transition: "opacity 0.65s cubic-bezier(0.16,1,0.3,1) 0.38s, transform 0.65s cubic-bezier(0.16,1,0.3,1) 0.38s, filter 0.65s cubic-bezier(0.16,1,0.3,1) 0.38s",
              }}
              className="grid grid-cols-4 gap-6 pt-4 border-t border-primary-foreground/10"
            >
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-display font-700 text-accent">{s.value}</div>
                  <div className="text-xs text-primary-foreground/50 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Drone image + processing card */}
          <div
            ref={imageRef}
            style={{
              opacity: 0,
              transform: "translateX(16px)",
              filter: "blur(4px)",
              transition: "opacity 0.8s cubic-bezier(0.16,1,0.3,1) 0.18s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.18s, filter 0.8s cubic-bezier(0.16,1,0.3,1) 0.18s",
            }}
            className="relative hidden lg:block"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-primary-foreground/10">
              <img
                src={droneHero}
                alt="Drone in flight over landscape"
                className="w-full h-[420px] object-cover"
              />
              {/* Processing overlay card */}
              <div className="absolute bottom-4 left-4 right-4 bg-card/95 backdrop-blur-sm rounded-xl p-4 border border-border shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Processing</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">Site_Survey_March23.zip</p>
                  </div>
                  <span className="text-xs font-semibold text-highlight bg-highlight/10 px-2 py-1 rounded-full">
                    In Progress
                  </span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Image alignment", pct: 100, done: true },
                    { label: "Dense point cloud", pct: 78, done: false },
                    { label: "Orthomosaic", pct: 0, done: false },
                  ].map((step) => (
                    <div key={step.label} className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          step.done ? "bg-primary" : step.pct > 0 ? "bg-accent animate-pulse-slow" : "bg-border"
                        }`}
                      />
                      <span className="text-xs text-muted-foreground flex-1">{step.label}</span>
                      <span className="text-xs font-semibold text-foreground">{step.pct}%</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full transition-all duration-1000" style={{ width: "59%" }} />
                </div>
              </div>
            </div>

            {/* Floating output badges */}
            <div className="absolute -top-3 -right-3 bg-card rounded-xl px-3 py-2 shadow-xl border border-border flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">3D Model Ready</span>
            </div>
            <div className="absolute top-1/3 -left-4 bg-card rounded-xl px-3 py-2 shadow-xl border border-border flex items-center gap-2">
              <Download className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold text-foreground">GeoTIFF Export</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}

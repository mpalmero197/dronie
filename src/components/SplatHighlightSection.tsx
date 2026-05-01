import { Link } from "react-router-dom";
import { ArrowRight, Box, Camera, Globe2, Pencil, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Cloud training",
    body: "Submit drone images and we train a Gaussian Splat in the cloud — Draft, Balanced, or Cinematic preset.",
    inspired: "Inspired by Luma AI & DJI Terra",
  },
  {
    icon: Pencil,
    title: "In-browser editing",
    body: "Crop, clean and re-export splats without installing anything. Save edits as new scenes.",
    inspired: "Inspired by SuperSplat",
  },
  {
    icon: Camera,
    title: "Cinematic flythroughs",
    body: "Set keyframes, scrub the timeline and export an MP4 directly from your browser.",
    inspired: "Inspired by Luma & SplatForge",
  },
  {
    icon: Globe2,
    title: "Georeferenced output",
    body: "RTK / EXIF coordinates carry through so your splat lives in the real world.",
    inspired: "Inspired by DJI Terra",
  },
  {
    icon: Box,
    title: "Multi-format export",
    body: ".ply, .splat and .ksplat — pick the right one for the web, Blender or your DCC of choice.",
    inspired: "Inspired by Polycam & PostShot",
  },
  {
    icon: Share2,
    title: "One-link sharing",
    body: "Public viewer URLs and an iframe snippet you can drop into any site.",
    inspired: "Inspired by Luma & SuperSplat",
  },
];

export default function SplatHighlightSection() {
  return (
    <section id="gaussian-splatting" className="relative py-20 sm:py-24 px-4 sm:px-6 bg-gradient-to-b from-background via-background to-secondary/20">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-mono uppercase tracking-wider text-primary">Photoreal 3D</span>
          </div>
          <h2 className="font-display font-700 text-3xl sm:text-4xl lg:text-5xl leading-tight">
            Gaussian Splatting, built for drones.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            Every great GS tool in one workflow — train like Luma, edit like SuperSplat, georeference like DJI Terra,
            export anywhere, share with one link.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="group rounded-2xl border border-border bg-card/60 p-5 hover:border-primary/40 hover:bg-card transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-700 text-base mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-mono">
                {f.inspired}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="gap-2" onClick={() => track("landing_splats_cta_click", { cta: "open_splats" })}>
            <Link to="/splats">
              Open splat studio <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" onClick={() => track("landing_splats_cta_click", { cta: "see_pricing" })}>
            <a href="#pricing">See pricing</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

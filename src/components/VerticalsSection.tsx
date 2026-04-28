import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { VERTICAL_LIST } from "@/pages/solutions/verticals.config";

export default function VerticalsSection() {
  return (
    <section id="solutions" className="py-24 bg-secondary/30 border-y border-border">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Built for your industry
          </span>
          <h2 className="mt-3 text-4xl font-display font-700 text-foreground">
            Solutions for every vertical
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            From construction progress tracking to emergency response — Dronie ships the right deliverables for your workflow.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {VERTICAL_LIST.map((v) => {
            const Icon = v.icon;
            return (
              <Link
                key={v.slug}
                to={`/solutions/${v.slug}`}
                className="group p-5 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display font-600 text-foreground mb-1">{v.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">{v.tagline}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Explore <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80">
            Or post a job in the marketplace <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
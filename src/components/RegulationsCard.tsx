import { BookOpen, ExternalLink, ShieldCheck } from "lucide-react";
import {
  REGULATION_CATEGORIES,
  REGULATION_LINKS,
  type RegulationCategory,
} from "@/lib/regulations";

interface RegulationsCardProps {
  /** Restrict to specific categories. Defaults to all. */
  categories?: RegulationCategory[];
  /** Compact variant uses tighter spacing — good for sidebars. */
  compact?: boolean;
}

export default function RegulationsCard({ categories, compact }: RegulationsCardProps) {
  const visibleCategories = REGULATION_CATEGORIES.filter(
    (c) => !categories || categories.includes(c.id),
  );

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Rules, regulations & resources
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Curated</span>
      </div>

      <div className={compact ? "p-3 space-y-4" : "p-4 sm:p-5 space-y-6"}>
        {visibleCategories.map((cat) => {
          const links = REGULATION_LINKS.filter((l) => l.category === cat.id);
          if (links.length === 0) return null;
          return (
            <div key={cat.id}>
              <div className="mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {cat.label}
                </h3>
                <p className="text-[11px] text-muted-foreground">{cat.blurb}</p>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {links.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-2 rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-secondary/40 transition-colors p-2.5"
                    >
                      {cat.id === "books" ? (
                        <BookOpen className="w-3.5 h-3.5 text-accent-foreground mt-0.5 shrink-0" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                            {l.label}
                          </span>
                          {l.region && (
                            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {l.region}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                          {l.description}
                        </p>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <p className="text-[10px] text-muted-foreground/80 leading-relaxed border-t border-border/60 pt-3">
          Links are provided for convenience and may change. Always verify current
          requirements with your civil aviation authority before each flight.
        </p>
      </div>
    </section>
  );
}
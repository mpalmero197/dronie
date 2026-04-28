import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MapPin, ShieldCheck, BadgeCheck, ArrowRight, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { IndustryVertical } from "@/lib/marketplace";

interface PublicPilot {
  pilot_id: string;
  display_name: string;
  bio: string | null;
  service_area_label: string | null;
  verticals: IndustryVertical[];
  hourly_rate_cents: number | null;
  years_experience: number;
  part_107: boolean;
  insured: boolean;
  portfolio_url: string | null;
  avatar_url: string | null;
}

function formatRate(cents: number | null): string | null {
  if (!cents) return null;
  return `$${Math.round(cents / 100).toLocaleString()}/hr`;
}

interface Props {
  vertical: IndustryVertical;
  verticalName: string;
}

export default function VerticalPilotsSection({ vertical, verticalName }: Props) {
  const [pilots, setPilots] = useState<PublicPilot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .rpc("get_public_pilots")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setPilots([]);
        } else {
          const filtered = (data as PublicPilot[]).filter((p) =>
            (p.verticals ?? []).includes(vertical),
          );
          setPilots(filtered.slice(0, 8));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vertical]);

  return (
    <section className="py-20 bg-background border-t border-border">
      <div className="container mx-auto px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Verified pilots
            </span>
            <h2 className="mt-2 text-3xl font-display font-700 text-foreground">
              Pilots who fly {verticalName.toLowerCase()}
            </h2>
            <p className="mt-2 text-muted-foreground max-w-xl text-sm">
              Independent operators on Dronie who list {verticalName} as one of their specialties.
            </p>
          </div>
          <Link
            to="/pilots"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80"
          >
            See all pilots <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading pilots…
          </div>
        ) : pilots.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              No pilots have listed {verticalName} yet — be the first.
            </p>
            <Link to="/pilot/signup">
              <Button className="mt-4">Become a Dronie pilot</Button>
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pilots.map((p) => {
              const rate = formatRate(p.hourly_rate_cents);
              return (
                <div
                  key={p.pilot_id}
                  className="p-5 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all flex flex-col"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.avatar_url}
                          alt={p.display_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-display font-700 text-foreground">
                          {p.display_name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-600 text-foreground truncate">
                        {p.display_name}
                      </h3>
                      {p.service_area_label && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{p.service_area_label}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {p.bio && (
                    <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{p.bio}</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.part_107 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                        <BadgeCheck className="w-3 h-3" /> Part 107
                      </span>
                    )}
                    {p.insured && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-foreground text-[10px] font-semibold">
                        <ShieldCheck className="w-3 h-3" /> Insured
                      </span>
                    )}
                    {p.years_experience > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-secondary text-foreground text-[10px] font-semibold">
                        {p.years_experience}y experience
                      </span>
                    )}
                    {rate && (
                      <span className="px-2 py-0.5 rounded-full bg-accent/15 text-foreground text-[10px] font-semibold">
                        {rate}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-2">
                    {p.portfolio_url ? (
                      <a
                        href={p.portfolio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-primary hover:text-primary/80"
                      >
                        View portfolio
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">No portfolio yet</span>
                    )}
                    <Link to={`/marketplace/new?vertical=${vertical}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs">
                        Hire
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
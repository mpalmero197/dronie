import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  Award,
  MapPin,
  Loader2,
  Lock,
  ExternalLink,
  Briefcase,
  Mail,
  Phone,
  Globe,
  BadgeCheck,
  Languages as LanguagesIcon,
  Wrench,
  Sparkles,
  Clock,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { getPublicPilot, type PublicPilotProfile } from "@/lib/pilots";
import { VERTICAL_LABELS } from "@/lib/marketplace";

function Avatar({ src, name, size = 96 }: { src: string | null; name: string; size?: number }) {
  const initials = (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="rounded-2xl overflow-hidden bg-primary text-primary-foreground flex items-center justify-center font-display font-700 flex-shrink-0 border-2 border-border"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

function ChipList({ items, empty }: { items: string[]; empty?: string }) {
  if (!items?.length) {
    return empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <span
          key={s}
          className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-foreground"
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="font-display font-700 text-foreground text-sm uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function PilotPublicProfile() {
  const { pilotId } = useParams<{ pilotId: string }>();
  const navigate = useNavigate();
  const { isSubscribed, user } = useAuth();
  const isPaid = !!isSubscribed;

  const [pilot, setPilot] = useState<PublicPilotProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!pilotId) return;
    setLoading(true);
    setNotFound(false);
    getPublicPilot(pilotId, isPaid)
      .then((p) => {
        if (!p) setNotFound(true);
        else setPilot(p);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [pilotId, isPaid]);

  useEffect(() => {
    if (pilot) {
      document.title = `${pilot.display_name} · Drone pilot · Dronie`;
    }
  }, [pilot]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 sm:px-6 pt-28 pb-16 max-w-4xl">
          <Skeleton className="h-6 w-32 mb-6" />
          <div className="flex gap-5">
            <Skeleton className="w-24 h-24 rounded-2xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-7 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-8">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !pilot) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-6 pt-32 max-w-xl text-center">
          <h1 className="font-display font-700 text-2xl mb-2">Pilot not found</h1>
          <p className="text-sm text-muted-foreground mb-5">
            This pilot is unavailable, has paused their profile, or the link is wrong.
          </p>
          <Link to="/pilots">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to pilots map
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const verified = pilot.verification_status === "verified";
  const formattedRate =
    pilot.hourly_rate_cents != null
      ? `$${Math.round(pilot.hourly_rate_cents / 100).toLocaleString()}/hr`
      : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 sm:px-6 pt-24 pb-16 max-w-4xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {pilot.is_redacted && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">Limited preview</p>
              <p className="text-muted-foreground">
                You're seeing a redacted version of this pilot's profile. Names, contact info, exact location, skills, fleet, software and languages are hidden.{" "}
                <Link to="/#pricing" className="text-primary underline font-semibold">Upgrade</Link> to unlock full pilot profiles.
              </p>
            </div>
          </div>
        )}

        {/* Hero */}
        <header className="bg-card rounded-2xl border border-border p-5 sm:p-6 flex flex-col sm:flex-row gap-5">
          <Avatar src={pilot.avatar_url} name={pilot.display_name} size={96} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h1 className="font-display font-700 text-2xl sm:text-3xl text-foreground truncate flex items-center gap-2">
                  {pilot.display_name}
                  {verified && (
                    <BadgeCheck className="w-5 h-5 text-primary flex-shrink-0" aria-label="Verified" />
                  )}
                </h1>
                {pilot.service_area_label && (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {pilot.service_area_label} · {pilot.service_radius_km} km radius
                  </p>
                )}
              </div>
              {formattedRate && (
                <div className="text-right">
                  <div className="text-xs uppercase text-muted-foreground tracking-wide">From</div>
                  <div className="font-display font-700 text-xl text-foreground">{formattedRate}</div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 mt-3">
              {pilot.part_107 && (
                <Badge variant="outline" className="gap-1 text-[11px]">
                  <ShieldCheck className="w-3 h-3" /> Part 107
                </Badge>
              )}
              {pilot.insured && (
                <Badge variant="outline" className="gap-1 text-[11px]">
                  <Award className="w-3 h-3" /> Insured
                </Badge>
              )}
              {pilot.years_experience > 0 && (
                <Badge variant="outline" className="gap-1 text-[11px]">
                  <Clock className="w-3 h-3" /> {pilot.years_experience}y experience
                </Badge>
              )}
            </div>

            {pilot.bio && (
              <p className="text-sm text-foreground/90 mt-4 whitespace-pre-line">{pilot.bio}</p>
            )}

            <div className="flex flex-wrap gap-2 mt-5">
              <Link to={`/marketplace/new?pilot=${pilot.pilot_id}`}>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                  <Briefcase className="w-4 h-4" /> Hire this pilot
                </Button>
              </Link>
              {pilot.username && pilot.portfolio_published && (
                <Link to={`/u/${pilot.username}`}>
                  <Button variant="outline" className="gap-2">
                    <Sparkles className="w-4 h-4" /> View portfolio
                  </Button>
                </Link>
              )}
              {pilot.portfolio_url && (
                <a href={pilot.portfolio_url} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="gap-2">
                    <Globe className="w-4 h-4" /> External site <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Detail grid */}
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <Section icon={Briefcase} title="Industries">
            {pilot.verticals.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {pilot.verticals.map((v) => (
                  <span key={v} className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {VERTICAL_LABELS[v] ?? v}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No industries listed.</p>
            )}
          </Section>

          <Section icon={Sparkles} title="Skills">
            <ChipList items={pilot.skills} empty={pilot.is_redacted ? "Hidden — upgrade to view" : "No skills listed."} />
          </Section>

          <Section icon={Wrench} title="Drones & equipment">
            <ChipList items={pilot.equipment} empty={pilot.is_redacted ? "Hidden — upgrade to view" : "No equipment listed."} />
          </Section>

          <Section icon={Sparkles} title="Software">
            <ChipList items={pilot.software} empty={pilot.is_redacted ? "Hidden — upgrade to view" : "No software listed."} />
          </Section>

          <Section icon={LanguagesIcon} title="Languages">
            <ChipList items={pilot.languages} empty={pilot.is_redacted ? "Hidden — upgrade to view" : "Not specified."} />
          </Section>

          <Section icon={Mail} title="Contact">
            {pilot.is_redacted ? (
              <p className="text-sm text-muted-foreground">
                Contact info is hidden.{" "}
                <Link to="/#pricing" className="text-primary underline">Upgrade</Link> to unlock.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                {pilot.contact_email && (
                  <a href={`mailto:${pilot.contact_email}`} className="flex items-center gap-2 text-foreground hover:text-primary">
                    <Mail className="w-4 h-4 text-muted-foreground" /> {pilot.contact_email}
                  </a>
                )}
                {pilot.phone && (
                  <a href={`tel:${pilot.phone}`} className="flex items-center gap-2 text-foreground hover:text-primary">
                    <Phone className="w-4 h-4 text-muted-foreground" /> {pilot.phone}
                  </a>
                )}
                {!pilot.contact_email && !pilot.phone && (
                  <p className="text-muted-foreground">
                    No public contact info. Use the <span className="font-semibold">Hire this pilot</span> button to start a conversation.
                  </p>
                )}
              </div>
            )}
          </Section>
        </div>

        {!user && (
          <div className="mt-8 text-center text-xs text-muted-foreground">
            <Link to="/auth" className="underline">Sign in</Link> to message and book pilots.
          </div>
        )}
      </main>
    </div>
  );
}
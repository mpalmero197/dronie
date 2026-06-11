import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, Briefcase, CheckCircle2, Clock, ExternalLink,
  Loader2, MapPin, Plane, Shield, ShieldAlert, ShieldCheck, Sparkles, UserCog, Wallet,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import PilotVerificationBanner from "@/components/PilotVerificationBanner";
import Part107Prompt from "@/components/Part107Prompt";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getMyPilotProfile, type PilotProfile } from "@/lib/pilots";
import {
  formatBudget,
  listMyQuotes,
  VERTICAL_LABELS,
  type ServiceQuote,
  type ServiceRequest,
} from "@/lib/marketplace";
import {
  VERIFICATION_STATUS_LABELS,
  type VerificationStatus,
} from "@/lib/verification";

type QuoteWithRequest = ServiceQuote & { service_requests: ServiceRequest | null };

const STATUS_PILL: Record<VerificationStatus, { cls: string; Icon: typeof Shield }> = {
  unverified: { cls: "bg-muted text-muted-foreground border-border", Icon: Shield },
  pending: { cls: "bg-highlight/15 text-highlight border-highlight/30", Icon: Clock },
  verified: { cls: "bg-primary/15 text-primary border-primary/30", Icon: ShieldCheck },
  rejected: { cls: "bg-destructive/15 text-destructive border-destructive/30", Icon: ShieldAlert },
};

function VerificationPill({ status }: { status: VerificationStatus }) {
  const { cls, Icon } = STATUS_PILL[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      <Icon className="w-3 h-3" />
      {VERIFICATION_STATUS_LABELS[status]}
    </span>
  );
}

const QUOTE_BADGE: Record<string, string> = {
  pending: "bg-highlight/15 text-highlight border-highlight/30",
  accepted: "bg-primary/15 text-primary border-primary/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  withdrawn: "bg-muted text-muted-foreground border-border",
};

const REQ_BADGE: Record<string, string> = {
  open: "bg-accent/15 text-accent border-accent/30",
  quoted: "bg-highlight/15 text-highlight border-highlight/30",
  assigned: "bg-primary/15 text-primary border-primary/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  delivered: "bg-primary/15 text-primary border-primary/30",
  closed: "bg-muted text-muted-foreground border-border",
};

export default function PilotDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PilotProfile | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("unverified");
  const [assignedRequests, setAssignedRequests] = useState<ServiceRequest[]>([]);
  const [myQuotes, setMyQuotes] = useState<QuoteWithRequest[]>([]);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [savingMap, setSavingMap] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  async function loadAll() {
    if (!user) return;
    setLoading(true);
    try {
      const p = await getMyPilotProfile(user.id);
      setProfile(p);
      setVerificationStatus(((p as any)?.verification_status ?? "unverified") as VerificationStatus);

      const [{ data: assigned, error: aErr }, quotes] = await Promise.all([
        supabase
          .from("service_requests")
          .select("*")
          .eq("assigned_pilot_id", user.id)
          .order("created_at", { ascending: false }),
        listMyQuotes(user.id),
      ]);
      if (aErr) throw aErr;
      setAssignedRequests((assigned ?? []) as ServiceRequest[]);
      setMyQuotes(quotes as QuoteWithRequest[]);
    } catch (err: any) {
      toast({ title: "Could not load dashboard", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Live verification status — keep the header pill in sync without refresh.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`pilot-dashboard-verification:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pilot_verifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { status?: VerificationStatus } | undefined;
          if (row?.status) setVerificationStatus(row.status);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function toggleAvailability(next: boolean) {
    if (!profile || !user) return;
    setSavingAvailability(true);
    setProfile({ ...profile, available: next });
    try {
      const { error } = await supabase
        .from("pilot_profiles")
        .update({ available: next })
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: next ? "You're accepting jobs" : "Marked unavailable" });
    } catch (err: any) {
      setProfile({ ...profile, available: !next });
      toast({ title: "Could not update", description: err.message, variant: "destructive" });
    } finally {
      setSavingAvailability(false);
    }
  }

  async function toggleShowOnMap(next: boolean) {
    if (!profile || !user) return;
    setSavingMap(true);
    setProfile({ ...profile, show_on_map: next });
    try {
      const { error } = await supabase
        .from("pilot_profiles")
        .update({ show_on_map: next })
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: next ? "Visible on pilot map" : "Hidden from pilot map" });
    } catch (err: any) {
      setProfile({ ...profile, show_on_map: !next });
      toast({ title: "Could not update", description: err.message, variant: "destructive" });
    } finally {
      setSavingMap(false);
    }
  }

  const activeAssignments = useMemo(
    () => assignedRequests.filter((r) => ["assigned", "in_progress"].includes(r.status)),
    [assignedRequests],
  );
  const completedAssignments = useMemo(
    () => assignedRequests.filter((r) => ["delivered", "closed"].includes(r.status)),
    [assignedRequests],
  );
  const pendingQuotes = useMemo(() => myQuotes.filter((q) => q.status === "pending"), [myQuotes]);
  const wonQuotes = useMemo(() => myQuotes.filter((q) => q.status === "accepted"), [myQuotes]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-40 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading dashboard…
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 sm:px-6 pt-24 pb-16 max-w-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Plane className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-700 text-foreground">Set up your pilot profile</h1>
          <p className="text-muted-foreground mt-2">
            You don't have a pilot profile yet. Create one to start receiving jobs and appearing on the pilot map.
          </p>
          <Button asChild size="lg" className="mt-6 gap-2">
            <Link to="/pilots/join">
              <Plane className="w-4 h-4" /> Become a Dronie pilot
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 pt-24 pb-16 max-w-6xl">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Plane className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-display font-700 text-foreground truncate">
                  {profile.display_name}
                </h1>
                <VerificationPill status={verificationStatus} />
              </div>
              <p className="text-muted-foreground text-sm mt-1 inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {profile.service_area_label || "No service area set"}
                <span className="text-muted-foreground/50">·</span>
                {profile.service_radius_km} km radius
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/pilots/join">
                <UserCog className="w-3.5 h-3.5" /> Edit profile
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-2">
              <Link to="/marketplace">
                <Briefcase className="w-3.5 h-3.5" /> Browse marketplace
              </Link>
            </Button>
          </div>
        </div>

        {/* Verification CTA — live updates via Realtime */}
        <Part107Prompt className="mb-4" />
        <PilotVerificationBanner className="mb-6" />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[
            { label: "Active jobs", value: activeAssignments.length, Icon: Briefcase, bg: "bg-primary/10", color: "text-primary" },
            { label: "Quotes pending", value: pendingQuotes.length, Icon: Clock, bg: "bg-highlight/10", color: "text-highlight" },
            { label: "Quotes won", value: wonQuotes.length, Icon: CheckCircle2, bg: "bg-primary/10", color: "text-primary" },
            { label: "Completed", value: completedAssignments.length, Icon: Sparkles, bg: "bg-accent/10", color: "text-accent" },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-xl p-4 border border-border flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <s.Icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-display font-700 text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground truncate">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: requests + quotes */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="active">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="active">Active jobs ({activeAssignments.length})</TabsTrigger>
                <TabsTrigger value="quotes">My quotes ({myQuotes.length})</TabsTrigger>
                <TabsTrigger value="completed">Completed ({completedAssignments.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="mt-4 space-y-3">
                {activeAssignments.length === 0 ? (
                  <EmptyState
                    title="No active jobs yet"
                    body="Browse open requests and submit a quote to get started."
                    cta={{ label: "Find work", to: "/marketplace" }}
                  />
                ) : (
                  activeAssignments.map((r) => <RequestRow key={r.id} request={r} />)
                )}
              </TabsContent>

              <TabsContent value="quotes" className="mt-4 space-y-3">
                {myQuotes.length === 0 ? (
                  <EmptyState
                    title="No quotes submitted"
                    body="Find a request that fits your skills and submit a competitive quote."
                    cta={{ label: "Browse requests", to: "/marketplace" }}
                  />
                ) : (
                  myQuotes.map((q) => <QuoteRow key={q.id} quote={q} />)
                )}
              </TabsContent>

              <TabsContent value="completed" className="mt-4 space-y-3">
                {completedAssignments.length === 0 ? (
                  <EmptyState
                    title="No completed jobs yet"
                    body="Once you deliver a project it'll appear here."
                  />
                ) : (
                  completedAssignments.map((r) => <RequestRow key={r.id} request={r} />)
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: quick controls */}
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h3 className="font-display font-700 text-foreground">Availability</h3>
              <label className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Accepting jobs</p>
                  <p className="text-xs text-muted-foreground">Pause to stop new matches without hiding your profile.</p>
                </div>
                <Switch
                  checked={profile.available}
                  disabled={savingAvailability}
                  onCheckedChange={toggleAvailability}
                />
              </label>
              <div className="border-t border-border pt-4">
                <label className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Show on pilot map</p>
                    <p className="text-xs text-muted-foreground">Let clients discover you at /pilots.</p>
                  </div>
                  <Switch
                    checked={profile.show_on_map}
                    disabled={savingMap}
                    onCheckedChange={toggleShowOnMap}
                  />
                </label>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <h3 className="font-display font-700 text-foreground">Profile snapshot</h3>
              <div className="text-sm space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Hourly rate</span>
                  <span className="text-foreground font-semibold inline-flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                    {profile.hourly_rate_cents
                      ? `$${Math.round(profile.hourly_rate_cents / 100)}/hr`
                      : "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Experience</span>
                  <span className="text-foreground font-semibold">{profile.years_experience} yr</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Part 107</span>
                  <span className="text-foreground font-semibold inline-flex items-center gap-1">
                    {profile.part_107 ? (
                      <><BadgeCheck className="w-3.5 h-3.5 text-primary" /> Yes</>
                    ) : "No"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Insured</span>
                  <span className="text-foreground font-semibold">{profile.insured ? "Yes" : "No"}</span>
                </div>
              </div>
              {profile.verticals.length > 0 && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Industries</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.verticals.map((v) => (
                      <span key={v} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-foreground">
                        {VERTICAL_LABELS[v as keyof typeof VERTICAL_LABELS] ?? v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profile.equipment.length > 0 && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Equipment</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.equipment.slice(0, 6).map((e) => (
                      <span key={e} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-foreground">{e}</span>
                    ))}
                    {profile.equipment.length > 6 && (
                      <span className="text-xs text-muted-foreground">+{profile.equipment.length - 6} more</span>
                    )}
                  </div>
                </div>
              )}
              <Button asChild variant="outline" size="sm" className="w-full mt-2 gap-2">
                <Link to="/pilots/join">
                  <UserCog className="w-3.5 h-3.5" /> Edit full profile
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  title, body, cta,
}: { title: string; body: string; cta?: { label: string; to: string } }) {
  return (
    <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{body}</p>
      {cta && (
        <Button asChild size="sm" variant="outline" className="mt-4 gap-2">
          <Link to={cta.to}>{cta.label} <ArrowRight className="w-3.5 h-3.5" /></Link>
        </Button>
      )}
    </div>
  );
}

function RequestRow({ request }: { request: ServiceRequest }) {
  return (
    <Link
      to={`/marketplace/${request.id}`}
      className="block bg-card rounded-xl border border-border p-4 hover:border-primary/30 transition-colors"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground truncate">{request.title}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold capitalize ${REQ_BADGE[request.status] ?? REQ_BADGE.open}`}>
              {request.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5 flex-wrap">
            <MapPin className="w-3 h-3" />
            {request.location_label || "No location"}
            <span className="text-muted-foreground/50">·</span>
            {VERTICAL_LABELS[request.vertical] ?? request.vertical}
            {request.deadline && (
              <>
                <span className="text-muted-foreground/50">·</span>
                Deadline {new Date(request.deadline).toLocaleDateString()}
              </>
            )}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold text-foreground">{formatBudget(request.budget_cents)}</p>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            Open <ExternalLink className="w-3 h-3" />
          </p>
        </div>
      </div>
    </Link>
  );
}

function QuoteRow({ quote }: { quote: QuoteWithRequest }) {
  const r = quote.service_requests;
  return (
    <Link
      to={r ? `/marketplace/${r.id}` : "/marketplace"}
      className="block bg-card rounded-xl border border-border p-4 hover:border-primary/30 transition-colors"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground truncate">{r?.title ?? "Request"}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold capitalize ${QUOTE_BADGE[quote.status] ?? QUOTE_BADGE.pending}`}>
              {quote.status}
            </span>
          </div>
          {quote.message && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{quote.message}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Submitted {new Date(quote.created_at).toLocaleDateString()}
            {quote.eta_days != null && ` · ETA ${quote.eta_days} day${quote.eta_days === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold text-foreground">${(quote.price_cents / 100).toLocaleString()}</p>
        </div>
      </div>
    </Link>
  );
}
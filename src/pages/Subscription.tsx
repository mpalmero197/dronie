import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Zap, Check, CreditCard, Shield, Loader2,
  BarChart3, HardDrive, ImageIcon, FolderOpen, Calendar,
  Lock, Crown, Infinity as InfinityIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Project } from "@/lib/supabase";
import { getTierLimits, getProjectsRemaining } from "@/lib/subscription-limits";
import { SUBSCRIPTION_TIERS } from "@/lib/stripe-config";
import { useToast } from "@/hooks/use-toast";

export default function Subscription() {
  const {
    user, isAdmin, subscriptionTier, isSubscribed,
    subscriptionEnd, checkSubscription, loading: authLoading,
  } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const tierLimits = getTierLimits(subscriptionTier, isAdmin);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingProjects(true);
      const { data } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      setProjects((data as Project[]) || []);
      setLoadingProjects(false);
    })();
  }, [user]);

  const monthlyProjectCount = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return projects.filter((p) => new Date(p.created_at) >= start).length;
  }, [projects]);

  const totalImages = projects.reduce((s, p) => s + (p.image_count || 0), 0);
  const estimatedGB = parseFloat(((totalImages * 8) / 1024).toFixed(2));
  const storagePct = tierLimits.storageGB === Infinity ? 0 : Math.min((estimatedGB / tierLimits.storageGB) * 100, 100);
  const projectsRemaining = getProjectsRemaining(subscriptionTier, monthlyProjectCount, isAdmin);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch {
      toast({ title: "Unable to open subscription portal", variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleCheckout(tier: "pilot" | "professional" | "enterprise") {
    setCheckoutLoading(tier);
    try {
      const priceId = SUBSCRIPTION_TIERS[tier].price_id;
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Checkout error", description: err.message, variant: "destructive" });
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await checkSubscription();
    setRefreshing(false);
    toast({ title: "Subscription status refreshed" });
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const plans = [
    { key: "pilot" as const, name: "Pilot", price: "$9", period: "/mo", features: ["3 projects/month", "500 images/project", "1 GB storage", "Orthomosaic & DSM"] },
    { key: "professional" as const, name: "Professional", price: "$49", period: "/mo", features: ["Unlimited projects", "5,000 images/project", "50 GB storage", "Point cloud & contours", "Priority processing", "Share links", "Flight Planner & LAANC"] },
    { key: "enterprise" as const, name: "Enterprise", price: "$149", period: "/mo", features: ["Unlimited everything", "500 GB storage", "Multi-spectral (NDVI)", "API access", "White-label viewer", "Dedicated support"] },
  ];

  const currentPlanKey = isAdmin ? "admin" : (isSubscribed ? subscriptionTier : null);

  function formatLimit(val: number) {
    return val === Infinity ? "∞" : val.toLocaleString();
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <div>
              <h1 className="font-display font-700 text-foreground">Subscription</h1>
              <p className="text-xs text-muted-foreground">Manage your plan and view usage</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Refresh Status
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Current Plan Card */}
        <section className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isSubscribed || isAdmin ? "bg-accent/15" : "bg-secondary"}`}>
                {isAdmin ? <Shield className="w-5 h-5 text-accent" /> : <Crown className="w-5 h-5 text-accent" />}
              </div>
              <div>
                <h2 className="font-display font-700 text-lg text-foreground">{tierLimits.tierLabel}</h2>
                <p className="text-xs text-muted-foreground">
                  {isAdmin
                    ? "Full admin access — all limits bypassed"
                    : isSubscribed && subscriptionEnd
                      ? `Renews ${new Date(subscriptionEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                      : "No active subscription — pick a plan to get started"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {isSubscribed && (
                <Button onClick={openPortal} disabled={portalLoading} variant="outline" size="sm" className="gap-1.5 text-xs">
                  {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                  Manage Billing
                </Button>
              )}
              {!isSubscribed && !isAdmin && (
                <Button onClick={() => handleCheckout("professional")} disabled={!!checkoutLoading} size="sm" className="gap-1.5 text-xs bg-accent text-accent-foreground hover:bg-accent/90">
                  {checkoutLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Upgrade Now
                </Button>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: "Projects this month",
                value: `${monthlyProjectCount}`,
                sub: tierLimits.projectsPerMonth === Infinity ? "Unlimited" : `of ${tierLimits.projectsPerMonth}`,
                icon: FolderOpen,
              },
              {
                label: "Images / project limit",
                value: formatLimit(tierLimits.imagesPerProject),
                sub: "max per project",
                icon: ImageIcon,
              },
              {
                label: "Storage used",
                value: `${estimatedGB} GB`,
                sub: tierLimits.storageGB === Infinity ? "Unlimited" : `of ${tierLimits.storageGB} GB`,
                icon: HardDrive,
              },
              {
                label: "Projects remaining",
                value: projectsRemaining === Infinity ? "∞" : `${projectsRemaining}`,
                sub: "this month",
                icon: Calendar,
              },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-secondary/50 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="text-[11px] text-muted-foreground font-medium">{stat.label}</span>
                  </div>
                  <p className="text-xl font-display font-700 text-foreground">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Storage bar */}
          {tierLimits.storageGB !== Infinity && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Storage</span>
                <span className="text-foreground font-semibold">{estimatedGB} / {tierLimits.storageGB} GB</span>
              </div>
              <Progress value={storagePct} className="h-2" />
            </div>
          )}
        </section>

        {/* Feature Access */}
        <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h3 className="font-display font-700 text-foreground">Feature Access</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {([
              { label: "Priority Processing", key: "priorityProcessing" },
              { label: "Share Links", key: "shareLinks" },
              { label: "Point Cloud", key: "pointCloud" },
              { label: "Contour Export", key: "contourExport" },
              { label: "GCP Support", key: "gcpSupport" },
              { label: "Multi-Spectral", key: "multiSpectral" },
              { label: "API Access", key: "apiAccess" },
              { label: "White Label", key: "whiteLabel" },
            ] as const).map(({ label, key }) => {
              const enabled = tierLimits[key] as boolean;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm ${
                    enabled
                      ? "bg-primary/5 border-primary/20 text-foreground"
                      : "bg-muted/30 border-border text-muted-foreground"
                  }`}
                >
                  {enabled ? (
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  ) : (
                    <Lock className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                  )}
                  <span className="text-xs font-medium">{label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Plan Comparison */}
        <section className="space-y-4">
          <h3 className="font-display font-700 text-foreground">Available Plans</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrent =
                (plan.key === null && !isSubscribed && !isAdmin) ||
                (plan.key !== null && subscriptionTier === plan.key && isSubscribed);
              return (
                <div
                  key={plan.name}
                  className={`rounded-2xl p-6 border flex flex-col ${
                    isCurrent
                      ? "bg-accent/5 border-accent/30 ring-2 ring-accent ring-offset-2 ring-offset-background"
                      : "bg-card border-border hover:border-primary/20 transition-colors"
                  }`}
                >
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 self-start mb-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-accent/15 text-accent border border-accent/20">
                      Current Plan
                    </span>
                  )}
                  <h4 className="font-display font-700 text-foreground">{plan.name}</h4>
                  <div className="flex items-baseline gap-0.5 mt-1 mb-4">
                    <span className="text-3xl font-display font-700 text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="space-y-2 flex-1 mb-5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    isSubscribed ? (
                      <Button onClick={openPortal} variant="outline" size="sm" className="w-full text-xs gap-1.5" disabled={portalLoading}>
                        <CreditCard className="w-3.5 h-3.5" /> Manage
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full text-xs" disabled>
                        Current Plan
                      </Button>
                    )
                  ) : plan.key ? (
                    <Button
                      onClick={() => handleCheckout(plan.key!)}
                      disabled={!!checkoutLoading || isAdmin}
                      size="sm"
                      className="w-full text-xs gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {checkoutLoading === plan.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      {isSubscribed ? "Switch" : "Subscribe"}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            All plans include SSL, automated backups, and browser-based map viewer. Cancel anytime.
          </p>
        </section>
      </main>
    </div>
  );
}

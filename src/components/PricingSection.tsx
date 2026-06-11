import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Zap, Loader2, Rocket, Crown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { SUBSCRIPTION_TIERS } from "@/lib/stripe-config";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";

const plans = [
  {
    name: "Pilot",
    price: "$9",
    period: "/ month",
    tagline: "For hobbyists and small jobs",
    tier: "pilot" as const,
    features: [
      "3 projects / month",
      "Up to 500 images / project",
      "Orthomosaic & DSM",
      "Browser map viewer",
      "GeoTIFF download",
      "1 GB storage",
    ],
    cta: "Start as Pilot",
    ctaSub: "Cancel anytime",
    ctaAction: "checkout" as const,
    highlight: false,
  },
  {
    name: "Professional",
    price: "$49",
    period: "/ month",
    tagline: "For freelancers & survey crews",
    valueProp: "Win bigger jobs · Process 10× faster",
    tier: "professional" as const,
    features: [
      "Unlimited projects",
      "Up to 5,000 images / project",
      "All outputs incl. point cloud",
      "Contour lines (SHP, DXF)",
      "GCP support",
      "50 GB storage",
      "Priority processing",
      "Share links",
    ],
    cta: "Upgrade to Professional",
    ctaSub: "7-day free trial · Cancel anytime",
    ctaAction: "checkout" as const,
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    price: "$149",
    period: "/ month",
    tagline: "For agencies & large operations",
    valueProp: "White-label, API & SLA — pays for itself in one project",
    tier: "enterprise" as const,
    features: [
      "Unlimited images / project",
      "Multi-spectral support (NDVI)",
      "API access",
      "White-label map viewer",
      "Custom GCP workflows",
      "500 GB storage",
      "SLA guarantee",
      "Dedicated support",
    ],
    cta: "Go Enterprise",
    ctaSub: "7-day free trial · Cancel anytime",
    ctaAction: "checkout" as const,
    highlight: false,
  },
];

export default function PricingSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const { user, subscriptionTier, isSubscribed } = useAuth();
  const { toast } = useToast();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cards = section.querySelectorAll(".pricing-card");
            cards.forEach((card, i) => {
              setTimeout(() => {
                (card as HTMLElement).style.opacity = "1";
                (card as HTMLElement).style.transform = "translateY(0)";
                (card as HTMLElement).style.filter = "blur(0)";
              }, i * 100);
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  async function handleCheckout(tier: "pilot" | "professional" | "enterprise") {
    if (!user) {
      navigate("/auth");
      return;
    }

    setLoadingTier(tier);
    try {
      const priceId = SUBSCRIPTION_TIERS[tier].price_id;
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({
        title: "Checkout error",
        description: err.message || "Unable to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingTier(null);
    }
  }

  function handleCTA(plan: typeof plans[number]) {
    track("landing_pricing_cta_click", {
      plan: plan.name,
      tier: plan.tier ?? "free",
      action: plan.ctaAction,
      label: getButtonLabel(plan),
      is_current_plan: isCurrentPlan(plan),
      authenticated: !!user,
    });
    if (plan.ctaAction === "checkout" && plan.tier) {
      handleCheckout(plan.tier);
    }
  }

  function getButtonLabel(plan: typeof plans[number]) {
    if (plan.tier && isSubscribed && subscriptionTier === plan.tier) {
      return "Your Plan";
    }
    if (plan.tier && isSubscribed && subscriptionTier) {
      return "Switch Plan";
    }
    return plan.cta;
  }

  function isCurrentPlan(plan: typeof plans[number]) {
    if (!plan.tier && !isSubscribed) return !!user;
    return plan.tier === subscriptionTier && isSubscribed;
  }

  return (
    <section id="pricing" ref={sectionRef} className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Pricing
          </span>
          <h2 className="mt-3 text-4xl font-display font-700 text-foreground">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Start free. Scale as your operation grows. No hidden fees on downloads or image counts.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => {
            const current = isCurrentPlan(plan);
            return (
              <div
                key={plan.name}
                className={`pricing-card relative rounded-2xl p-8 flex flex-col transition-all duration-300 hover:shadow-xl ${
                  plan.highlight
                    ? "bg-primary text-primary-foreground border-2 border-primary shadow-lg scale-[1.02]"
                    : "bg-card border border-border hover:border-primary/20"
                } ${current ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""}`}
                style={{
                  opacity: 0,
                  transform: "translateY(20px)",
                  filter: "blur(4px)",
                  transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s, filter 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s, box-shadow 0.2s`,
                }}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-accent text-accent-foreground shadow-md">
                      <Zap className="w-3 h-3" />
                      {plan.badge}
                    </span>
                  </div>
                )}

                {current && (
                  <div className="absolute -top-3 right-4">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-accent text-accent-foreground shadow-md">
                      Your Plan
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`font-display font-700 text-lg mb-1 ${plan.highlight ? "text-primary-foreground" : "text-foreground"}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm mb-4 ${plan.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {plan.tagline}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-display font-700 ${plan.highlight ? "text-primary-foreground" : "text-foreground"}`}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className={`text-sm ${plan.highlight ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                  {"valueProp" in plan && plan.valueProp && (
                    <p
                      className={`mt-3 text-xs font-semibold tracking-wide ${
                        plan.highlight ? "text-accent" : "text-primary"
                      }`}
                    >
                      {plan.valueProp}
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                        plan.highlight ? "bg-accent/30" : "bg-secondary"
                      }`}>
                        <Check className={`w-2.5 h-2.5 ${plan.highlight ? "text-accent" : "text-primary"}`} />
                      </div>
                      <span className={`text-sm ${plan.highlight ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleCTA(plan)}
                  disabled={current || (!!plan.tier && loadingTier === plan.tier)}
                  size="lg"
                  className={`group w-full font-semibold transition-all active:scale-[0.97] gap-2 ${
                    plan.highlight
                      ? "bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg hover:shadow-xl hover:shadow-accent/30"
                      : plan.tier
                      ? "bg-foreground text-background hover:bg-foreground/90 shadow-md hover:shadow-lg"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {plan.tier && loadingTier === plan.tier ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : plan.tier === "professional" ? (
                    <Rocket className="w-4 h-4" />
                  ) : plan.tier === "enterprise" ? (
                    <Crown className="w-4 h-4" />
                  ) : null}
                  <span>{getButtonLabel(plan)}</span>
                  {!current && (
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  )}
                </Button>
                {!current && plan.ctaSub && (
                  <p
                    className={`mt-2.5 text-center text-[11px] ${
                      plan.highlight
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {plan.ctaSub}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Trust strip — reinforces the upgrade decision */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-primary" /> 7-day free trial on paid plans
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-primary" /> Cancel anytime
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-primary" /> Secure payments by Stripe
          </span>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All plans include SSL and automated backups. Cancel anytime from your account.
        </p>
      </div>
    </section>
  );
}

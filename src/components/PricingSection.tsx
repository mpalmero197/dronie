import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Pilot",
    price: "Free",
    period: "",
    tagline: "For hobbyists and small jobs",
    features: [
      "3 projects / month",
      "Up to 500 images / project",
      "Orthomosaic & DSM",
      "Browser map viewer",
      "GeoTIFF download",
      "1 GB storage",
    ],
    cta: "Get Started",
    ctaAction: "auth",
    highlight: false,
  },
  {
    name: "Professional",
    price: "$49",
    period: "/ month",
    tagline: "For freelancers & survey crews",
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
    cta: "Start Free Trial",
    ctaAction: "auth",
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    price: "$149",
    period: "/ month",
    tagline: "For agencies & large operations",
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
    cta: "Contact Sales",
    ctaAction: "contact",
    highlight: false,
  },
];

export default function PricingSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();

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

  function handleCTA(action: string) {
    if (action === "auth") {
      navigate("/auth");
    } else if (action === "contact") {
      window.location.href = "mailto:sales@dronie.com?subject=Enterprise%20Inquiry";
    }
  }

  return (
    <section id="pricing" ref={sectionRef} className="py-24 bg-background">
      <div className="container mx-auto px-6">
        {/* Header */}
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

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`pricing-card relative rounded-2xl p-8 flex flex-col transition-all duration-300 hover:shadow-xl ${
                plan.highlight
                  ? "bg-primary text-primary-foreground border-2 border-primary shadow-lg scale-[1.02]"
                  : "bg-card border border-border hover:border-primary/20"
              }`}
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
                onClick={() => handleCTA(plan.ctaAction)}
                className={`w-full font-semibold transition-all active:scale-[0.97] ${
                  plan.highlight
                    ? "bg-accent text-accent-foreground hover:bg-accent/90 shadow-md"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All plans include SSL, automated backups, and our processing SLA.
          <a href="#" className="text-primary font-medium hover:underline ml-1">Compare full features →</a>
        </p>
      </div>
    </section>
  );
}

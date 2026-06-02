import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDemo } from "@/demo/DemoContext";
import { ensureDemoProject } from "@/demo/seedDemo";
import { Sparkles, Loader2, Plane, Map, Cloud, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Demo() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const demo = useDemo();
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent("/demo")}`, { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const pid = await ensureDemoProject();
        if (cancelled) return;
        demo.start(pid);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to start demo");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-foreground text-primary-foreground p-6 relative overflow-hidden">
      {/* Backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 20%, hsl(var(--primary) / 0.55) 0%, transparent 60%), radial-gradient(50% 40% at 85% 80%, hsl(var(--accent) / 0.35) 0%, transparent 60%)",
        }}
      />
      {/* Grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary-foreground) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary-foreground) / 0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative max-w-2xl w-full text-center space-y-6 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.22em] bg-accent/15 text-accent border border-accent/30">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
          Live product tour
        </div>
        <div className="w-16 h-16 rounded-2xl bg-accent/15 text-accent flex items-center justify-center mx-auto ring-1 ring-accent/30">
          {error ? <Sparkles className="w-7 h-7" /> : <Loader2 className="w-7 h-7 animate-spin" />}
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-display font-700 leading-tight">
            {error
              ? "Could not start the demo"
              : booting
              ? "Spinning up your demo mission\u2026"
              : "Plan, fly, process, deliver."}
          </h1>
          <p className="text-primary-foreground/70 text-base max-w-lg mx-auto leading-relaxed">
            {error
              ? error
              : "Dronie will walk you through a full survey \u2014 from drawing the mission to publishing the deliverables \u2014 with real data in your account."}
          </p>
        </div>

        {!error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto pt-2">
            {[
              { icon: Map, label: "Plan" },
              { icon: Plane, label: "Fly" },
              { icon: Cloud, label: "Process" },
              { icon: Share2, label: "Deliver" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl bg-primary-foreground/5 border border-primary-foreground/10 px-3 py-3 flex flex-col items-center gap-1.5"
              >
                <s.icon className="w-4 h-4 text-accent" />
                <span className="text-xs font-semibold tracking-wide">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <Button onClick={() => navigate("/dashboard")} className="bg-accent text-accent-foreground hover:bg-accent/90">
            Back to dashboard
          </Button>
        )}
      </div>
    </div>
  );
}
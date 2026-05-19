import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDemo } from "@/demo/DemoContext";
import { ensureDemoProject } from "@/demo/seedDemo";
import { Sparkles, Loader2 } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-accent/15 text-accent flex items-center justify-center mx-auto">
          {error ? <Sparkles className="w-6 h-6" /> : <Loader2 className="w-6 h-6 animate-spin" />}
        </div>
        <h1 className="text-2xl font-display font-700">
          {error ? "Could not start the demo" : booting ? "Spinning up your demo mission\u2026" : "Enjoy the tour"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {error
            ? error
            : "Dronie will walk you through planning, flight, processing, and deliverables using a real project in your account."}
        </p>
        {error && (
          <Button onClick={() => navigate("/dashboard")}>Back to dashboard</Button>
        )}
      </div>
    </div>
  );
}
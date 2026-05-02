import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, DollarSign } from "lucide-react";

interface ConnectStatus {
  connected: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
}

export default function PilotPayouts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function loadStatus() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("connect-status");
      if (error) throw error;
      setStatus(data);
    } catch (err: any) {
      toast({ title: "Could not load status", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) loadStatus();
  }, [user]);

  async function startOnboarding() {
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke("connect-onboard");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Could not start onboarding", description: err.message, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-32 text-center text-muted-foreground">Sign in to manage payouts.</div>
      </div>
    );
  }

  const ready = status?.connected && status?.charges_enabled && status?.payouts_enabled;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-6 pt-28 pb-16 max-w-2xl">
        <h1 className="text-3xl font-display font-700 text-foreground flex items-center gap-2">
          <DollarSign className="w-7 h-7 text-primary" /> Get paid for jobs
        </h1>
        <p className="text-muted-foreground mt-2">
          Dronie uses Stripe Connect to pay you directly. Clients pay your full asking price plus a 1% Dronie connection fee — you receive 100% of your quote.
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          {loading ? (
            <div className="flex items-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking status…</div>
          ) : ready ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">You're set up to receive payouts.</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Clients can now book and pay you on Dronie. Funds arrive on your linked bank account on Stripe's standard payout schedule.
              </p>
              <Button variant="outline" onClick={startOnboarding} disabled={working} className="gap-2">
                {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Update Stripe details
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-5 h-5" />
                <span className="font-semibold">
                  {status?.connected ? "Stripe onboarding incomplete" : "Set up payouts to start accepting jobs"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                You'll be redirected to Stripe to verify your identity and link a bank account. This is required before clients can book you.
              </p>
              <Button onClick={startOnboarding} disabled={working} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                {status?.connected ? "Continue Stripe onboarding" : "Connect with Stripe"}
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          By using Dronie's marketplace, you agree to receive bookings exclusively through the platform. See the{" "}
          <a href="/terms" className="underline">Terms of Service</a> for details.
        </p>
      </main>
    </div>
  );
}
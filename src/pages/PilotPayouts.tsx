import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  DollarSign,
  Wallet,
  Clock,
  Receipt,
  TrendingUp,
  Briefcase,
  RefreshCw,
} from "lucide-react";

interface DashboardData {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  currency: string;
  totals: {
    lifetime_pilot_cents: number;
    lifetime_fee_cents: number;
    lifetime_gross_cents: number;
    pending_pilot_cents: number;
    jobs_count: number;
  };
  balance: { available_cents: number; pending_cents: number };
  next_payout: { amount_cents: number; arrival_date: number | null } | null;
  recent: Array<{
    id: string;
    request_id: string;
    amount_total_cents: number;
    amount_pilot_cents: number;
    fee_cents: number;
    currency: string;
    status: string;
    created_at: string;
  }>;
}

function fmtMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format((cents || 0) / 100);
}

function fmtDate(d: string | number) {
  const date = typeof d === "number" ? new Date(d * 1000) : new Date(d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function PilotPayouts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("connect-dashboard");
      if (error) throw error;
      setData(data);
    } catch (err: any) {
      toast({ title: "Could not load dashboard", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) load();
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

  const ready = !!(data?.connected && data?.charges_enabled && data?.payouts_enabled);
  const currency = data?.currency || "usd";

  const stats = useMemo(
    () => [
      {
        label: "Lifetime earnings",
        value: fmtMoney(data?.totals.lifetime_pilot_cents || 0, currency),
        icon: TrendingUp,
        hint: "Your share, all-time",
      },
      {
        label: "Available balance",
        value: fmtMoney(data?.balance.available_cents || 0, currency),
        icon: Wallet,
        hint: "Ready to pay out",
      },
      {
        label: "Pending in Stripe",
        value: fmtMoney(data?.balance.pending_cents || 0, currency),
        icon: Clock,
        hint: "Clearing soon",
      },
      {
        label: "Completed jobs",
        value: String(data?.totals.jobs_count || 0),
        icon: Briefcase,
        hint: "Successful payments",
      },
    ],
    [data, currency]
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-32 text-center text-muted-foreground">Sign in to view your payout dashboard.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 sm:px-6 pt-28 pb-16 max-w-5xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-display font-700 text-foreground flex items-center gap-2">
              <DollarSign className="w-7 h-7 text-primary" /> Payout dashboard
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Track your earnings, fees, and payouts. Clients pay your full asking price plus a 1% Dronie connection fee — you receive 100% of your quote.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Connect status card */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          {loading && !data ? (
            <div className="flex items-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…</div>
          ) : ready ? (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <div>
                  <div className="font-semibold text-foreground">Connected to Stripe</div>
                  <div className="text-xs text-muted-foreground">
                    Charges {data?.charges_enabled ? "enabled" : "off"} • Payouts {data?.payouts_enabled ? "enabled" : "off"}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={startOnboarding} disabled={working} className="gap-2">
                {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Update Stripe details
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <div>
                  <div className="font-semibold text-foreground">
                    {data?.connected ? "Stripe onboarding incomplete" : "Set up payouts to start accepting jobs"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Verify your identity and link a bank account to receive payments.
                  </div>
                </div>
              </div>
              <Button onClick={startOnboarding} disabled={working} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                {data?.connected ? "Continue onboarding" : "Connect with Stripe"}
              </Button>
            </div>
          )}
        </div>

        {/* Stat tiles */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs uppercase tracking-wide">{s.label}</span>
                <s.icon className="w-4 h-4" />
              </div>
              <div className="mt-2 text-2xl font-700 font-display text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.hint}</div>
            </div>
          ))}
        </div>

        {/* Fees & next payout */}
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Receipt className="w-4 h-4" /> Dronie connection fees
            </div>
            <div className="mt-2 text-2xl font-700 font-display text-foreground">
              {fmtMoney(data?.totals.lifetime_fee_cents || 0, currency)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Paid by your clients on top of your quotes (1%, min $0.50). Doesn't reduce your earnings.
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Lifetime client gross: <span className="text-foreground font-medium">{fmtMoney(data?.totals.lifetime_gross_cents || 0, currency)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="w-4 h-4" /> Next payout
            </div>
            {data?.next_payout ? (
              <>
                <div className="mt-2 text-2xl font-700 font-display text-foreground">
                  {fmtMoney(data.next_payout.amount_cents, currency)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {data.next_payout.arrival_date
                    ? `Arriving ${fmtDate(data.next_payout.arrival_date)}`
                    : "Scheduled by Stripe"}
                </div>
              </>
            ) : (
              <>
                <div className="mt-2 text-2xl font-700 font-display text-foreground">—</div>
                <div className="text-xs text-muted-foreground mt-1">
                  No payouts scheduled yet. Stripe pays out automatically once funds clear.
                </div>
              </>
            )}
            {(data?.totals.pending_pilot_cents || 0) > 0 && (
              <div className="mt-3 text-xs text-muted-foreground">
                Pending from open jobs: <span className="text-foreground font-medium">{fmtMoney(data!.totals.pending_pilot_cents, currency)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent payments */}
        <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-display font-700 text-foreground">Recent payments</h2>
            <span className="text-xs text-muted-foreground">{data?.recent.length || 0} shown</span>
          </div>
          {(!data || data.recent.length === 0) ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No payments yet. When a client pays for one of your quotes, it'll show up here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Date</th>
                    <th className="text-left px-4 py-2 font-medium">Request</th>
                    <th className="text-right px-4 py-2 font-medium">Client paid</th>
                    <th className="text-right px-4 py-2 font-medium">Fee</th>
                    <th className="text-right px-4 py-2 font-medium">Your share</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(p.created_at)}</td>
                      <td className="px-4 py-3">
                        <a href={`/marketplace/${p.request_id}`} className="text-primary hover:underline">
                          {p.request_id.slice(0, 8)}…
                        </a>
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">{fmtMoney(p.amount_total_cents, p.currency)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{fmtMoney(p.fee_cents, p.currency)}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">{fmtMoney(p.amount_pilot_cents, p.currency)}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            p.status === "succeeded" || p.status === "paid"
                              ? "border-primary/40 text-primary"
                              : p.status === "pending" || p.status === "processing"
                              ? "border-amber-500/40 text-amber-600"
                              : "border-border text-muted-foreground"
                          }
                        >
                          {p.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
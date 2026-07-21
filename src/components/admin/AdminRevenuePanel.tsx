import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, Percent, Users2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface RevenueRow {
  amount_total_cents: number;
  amount_pilot_cents: number;
  fee_cents: number;
  created_at: string;
  status: string;
  client_id: string;
  pilot_id: string;
}

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function AdminRevenuePanel() {
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("marketplace_payments")
        .select("amount_total_cents, amount_pilot_cents, fee_cents, created_at, status, client_id, pilot_id")
        .eq("status", "paid")
        .order("created_at", { ascending: false });
      setRows((data ?? []) as RevenueRow[]);
      setLoading(false);
    })();
  }, []);

  const total = rows.reduce((s, r) => s + r.amount_total_cents, 0);
  const platformRevenue = rows.reduce((s, r) => s + r.fee_cents, 0);
  const paidOutToPilots = rows.reduce((s, r) => s + r.amount_pilot_cents, 0);
  const uniqueClients = new Set(rows.map((r) => r.client_id)).size;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const mtdFees = rows
    .filter((r) => r.created_at >= monthStart)
    .reduce((s, r) => s + r.fee_cents, 0);

  const stats = [
    { label: "Platform Revenue (all-time)", value: fmt(platformRevenue), icon: DollarSign, color: "text-accent", bg: "bg-accent/10" },
    { label: "Revenue this month", value: fmt(mtdFees), icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
    { label: "Gross processed (GMV)", value: fmt(total), icon: Percent, color: "text-foreground", bg: "bg-muted" },
    { label: "Paying customers", value: uniqueClients, icon: Users2, color: "text-primary", bg: "bg-secondary" },
  ];

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-card rounded-xl p-4 border border-border">
                  <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                    <Icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <p className="text-xl font-display font-700 text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-display font-700 text-foreground">Recent paid transactions</h3>
              <span className="text-xs text-muted-foreground">Pilot payouts: {fmt(paidOutToPilots)}</span>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No payments yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {rows.slice(0, 10).map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-5 py-3 text-sm">
                    <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                    <span className="text-foreground font-semibold">{fmt(r.amount_total_cents)}</span>
                    <span className="text-accent font-semibold">+{fmt(r.fee_cents)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
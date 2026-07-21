import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, ExternalLink, CheckCircle2, XCircle, Crown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { SUBSCRIPTION_TIERS, getTierByProductId } from "@/lib/stripe-config";
import { Link } from "react-router-dom";

interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  headline: string | null;
  portfolio_published: boolean;
  account_type: string | null;
  roles: string[];
  project_count: number;
  created_at: string;
  subscription: { product_id: string | null; status: string; current_period_end: string | null } | null;
}

type FilterMode = "all" | "paid" | "free" | "portfolio";

export default function AdminUserDirectory() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/admin-users`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          },
        );
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const paid = rows.filter((r) => r.subscription).length;
    const portfolios = rows.filter((r) => r.portfolio_published && r.username).length;
    return { total: rows.length, paid, portfolios, free: rows.length - paid };
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "paid" && !r.subscription) return false;
      if (filter === "free" && r.subscription) return false;
      if (filter === "portfolio" && !(r.portfolio_published && r.username)) return false;
      if (!term) return true;
      return (
        r.email?.toLowerCase().includes(term) ||
        r.full_name?.toLowerCase().includes(term) ||
        r.username?.toLowerCase().includes(term)
      );
    });
  }, [rows, q, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  const filters: { id: FilterMode; label: string; count: number }[] = [
    { id: "all", label: "All", count: stats.total },
    { id: "paid", label: "Paid", count: stats.paid },
    { id: "free", label: "Free", count: stats.free },
    { id: "portfolio", label: "Portfolios", count: stats.portfolios },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total users" value={stats.total} tone="text-foreground" />
        <StatCard label="Paid subscribers" value={stats.paid} tone="text-accent" icon={<Crown className="w-3.5 h-3.5" />} />
        <StatCard label="Free / unpaid" value={stats.free} tone="text-muted-foreground" />
        <StatCard label="Published portfolios" value={stats.portfolios} tone="text-primary" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, or username"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                filter === f.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {f.label} <span className="opacity-70">({f.count})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="divide-y divide-border">
          {filtered.map((u) => {
            const tierKey = getTierByProductId(u.subscription?.product_id ?? null);
            const tierName = tierKey ? SUBSCRIPTION_TIERS[tierKey === "professional" ? "professional" : tierKey === "enterprise" ? "enterprise" : "pilot"].name : null;
            const isPaid = !!u.subscription;
            const hasPortfolio = u.portfolio_published && !!u.username;

            return (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground">
                      {(u.full_name || u.email || "?").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {u.full_name || u.email}
                    </p>
                    {u.username && (
                      <span className="text-xs text-muted-foreground">@{u.username}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.email}
                    {u.headline ? ` · ${u.headline}` : ""}
                  </p>
                </div>

                <div className="hidden md:flex items-center gap-1.5 text-xs">
                  {hasPortfolio ? (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Portfolio
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-muted-foreground/60">
                      <XCircle className="w-3.5 h-3.5" /> No portfolio
                    </span>
                  )}
                </div>

                <div className="text-xs w-24 text-right">
                  {isPaid ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/15 text-accent border border-accent/20 font-semibold">
                      <Crown className="w-3 h-3" />
                      {tierName ?? "Paid"}
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                      Free
                    </span>
                  )}
                </div>

                {hasPortfolio ? (
                  <Link
                    to={`/u/${u.username}`}
                    target="_blank"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Open portfolio"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                ) : (
                  <span className="w-4 h-4" />
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No users match.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone, icon }: { label: string; value: number; tone: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <p className={`text-2xl font-display font-700 ${tone} flex items-center gap-1.5`}>
        {icon}
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
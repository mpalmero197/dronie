import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Loader2, MapPin, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { VERTICAL_LABELS, formatBudget, type ServiceRequest } from "@/lib/marketplace";

const statusClasses: Record<string, string> = {
  open: "bg-primary/10 text-primary border-primary/20",
  quoted: "bg-accent/10 text-accent border-accent/20",
  assigned: "bg-primary/15 text-primary border-primary/30",
  in_progress: "bg-accent/15 text-accent border-accent/30",
  delivered: "bg-muted text-foreground border-border",
  closed: "bg-muted text-muted-foreground border-border",
};

export default function AdminRequestsPanel() {
  const [rows, setRows] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("service_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setRows((data ?? []) as ServiceRequest[]);
      setLoading(false);
    })();
  }, []);

  const openCount = rows.filter((r) => r.status === "open").length;
  const activeCount = rows.filter((r) => ["assigned", "in_progress"].includes(r.status)).length;
  const closedCount = rows.filter((r) => ["delivered", "closed"].includes(r.status)).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Open requests", value: openCount, tone: "text-primary" },
          { label: "In flight", value: activeCount, tone: "text-accent" },
          { label: "Completed", value: closedCount, tone: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-xl p-4 border border-border">
            <p className={`text-2xl font-display font-700 ${s.tone}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-primary" />
          <h3 className="font-display font-700 text-foreground">Service requests & jobs</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No service requests yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <Link
                key={r.id}
                to={`/marketplace/${r.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{r.title}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusClasses[r.status] || statusClasses.open}`}>
                      {r.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{VERTICAL_LABELS[r.vertical] ?? r.vertical}</span>
                    {r.location_label && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />
                        {r.location_label}
                      </span>
                    )}
                    <span>· {new Date(r.created_at).toLocaleDateString()}</span>
                  </p>
                </div>
                <span className="text-sm font-semibold text-foreground">{formatBudget(r.budget_cents)}</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
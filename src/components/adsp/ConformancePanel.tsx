import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Download, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  listConformanceEvents, listServiceRecords, recordsToCsv, resolveConformanceEvent,
  SERVICE_LABELS, type AdspServiceRecord, type ConformanceEvent,
} from "@/lib/adsp";

const DEVIATION_LABEL: Record<string, string> = {
  lateral: "Lateral excursion",
  vertical: "Altitude excursion",
  temporal: "Outside time window",
  loss_of_data: "Telemetry gap",
};

export default function ConformancePanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<ConformanceEvent[]>([]);
  const [records, setRecords] = useState<AdspServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [e, r] = await Promise.all([
        listConformanceEvents(user.id, 100),
        listServiceRecords(user.id, 200),
      ]);
      setEvents(e);
      setRecords(r);
    } catch (err) {
      toast({ title: "Could not load records", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const exportCsv = () => {
    const blob = new Blob([recordsToCsv(records)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dronie-adsp-evidence-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const open = events.filter((e) => !e.resolved);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading conformance records…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Open deviations" value={String(open.length)} tone={open.length ? "warn" : "ok"} />
        <Kpi label="Events (last 100)" value={String(events.length)} />
        <Kpi label="Evidence records" value={String(records.length)} />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="font-display font-700 text-base">Conformance events</h3>
          </div>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1.5" /> Refresh</Button>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No deviations recorded. Conformance monitoring compares live telemetry against your published flight
            intent and logs any lateral, vertical or time excursion.
          </p>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                {e.resolved
                  ? <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  : <TriangleAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {DEVIATION_LABEL[e.deviation_type] ?? e.deviation_type}
                    {e.magnitude != null && <span className="font-mono font-normal text-muted-foreground"> · {Math.round(e.magnitude)}{e.unit ?? ""}</span>}
                  </p>
                  {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    {new Date(e.recorded_at).toLocaleString()}
                    {e.latitude != null && ` · ${e.latitude.toFixed(5)}, ${e.longitude?.toFixed(5)}`}
                    {e.altitude_m != null && ` · ${Math.round(e.altitude_m)} m AGL`}
                  </p>
                </div>
                {!e.resolved && (
                  <Button size="sm" variant="ghost" onClick={async () => {
                    await resolveConformanceEvent(e.id);
                    setEvents((prev) => prev.map((x) => (x.id === e.id ? { ...x, resolved: true } : x)));
                  }}>Resolve</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display font-700 text-base">Evidence trail</h3>
            <p className="text-xs text-muted-foreground">
              Every automated data service call is retained with its inputs, source and data currency so any flight can be reconstructed.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!records.length}>
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
        </div>

        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">No service calls recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">Time</th>
                  <th className="py-2 pr-3 font-medium">Service</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Latency</th>
                  <th className="py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 40).map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-mono whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-3">{SERVICE_LABELS[r.service_kind] ?? r.service_kind}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.data_source ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono">{r.latency_ms != null ? `${r.latency_ms} ms` : "—"}</td>
                    <td className="py-2">
                      <Badge variant="outline" className={r.ok ? "bg-primary/10 text-primary border-primary/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                        {r.ok ? "ok" : "error"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <Card className="p-4">
      <p className={`font-display font-700 text-2xl ${tone === "warn" ? "text-destructive" : tone === "ok" ? "text-primary" : "text-foreground"}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </Card>
  );
}

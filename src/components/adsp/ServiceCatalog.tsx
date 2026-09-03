import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Database, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  listPerformance, listServices, listSubscriptions, rollupPerformance, setSubscription,
  SERVICE_LABELS, STATUS_STYLES,
  type AdspService, type AdspSubscription, type AdspPerformanceSample,
} from "@/lib/adsp";

export default function ServiceCatalog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [services, setServices] = useState<AdspService[]>([]);
  const [subs, setSubs] = useState<AdspSubscription[]>([]);
  const [samples, setSamples] = useState<AdspPerformanceSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [s, sub, perf] = await Promise.all([
        listServices(),
        listSubscriptions(user.id),
        listPerformance(30).catch(() => [] as AdspPerformanceSample[]),
      ]);
      setServices(s);
      setSubs(sub);
      setSamples(perf);
    } catch (e) {
      toast({ title: "Could not load services", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const rollup = useMemo(() => {
    const map = new Map(rollupPerformance(samples).map((r) => [r.kind, r]));
    return map;
  }, [samples]);

  const toggle = async (svc: AdspService, enabled: boolean) => {
    if (!user) return;
    setBusy(svc.id);
    try {
      await setSubscription(user.id, svc.id, enabled);
      setSubs((prev) => {
        const next = prev.filter((p) => p.service_id !== svc.id);
        return [...next, {
          id: crypto.randomUUID(), user_id: user.id, service_id: svc.id, drone_id: null,
          enabled, accepted_limitations_at: enabled ? new Date().toISOString() : null,
        }];
      });
      toast({
        title: enabled ? "Service subscribed" : "Service unsubscribed",
        description: enabled
          ? `You acknowledged the published limitations for ${svc.name}.`
          : `${svc.name} will no longer be used automatically.`,
      });
    } catch (e) {
      toast({ title: "Update failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading service declarations…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Each service below is published with its data sources, performance criteria and known limitations, as
          required of an Automated Data Service Provider. Subscribing records your acknowledgement of those limits.
        </p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {services.map((svc) => {
          const sub = subs.find((s) => s.service_id === svc.id);
          const perf = rollup.get(svc.kind);
          return (
            <Card key={svc.id} className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-700 text-base leading-tight">{svc.name}</h3>
                    <Badge variant="outline" className={STATUS_STYLES[svc.status]}>{svc.status}</Badge>
                  </div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">
                    {SERVICE_LABELS[svc.kind]} · v{svc.version} · {svc.source}
                  </p>
                </div>
                <Switch
                  checked={!!sub?.enabled}
                  disabled={busy === svc.id}
                  onCheckedChange={(v) => toggle(svc, v)}
                  aria-label={`Subscribe to ${svc.name}`}
                />
              </div>

              <p className="text-sm text-muted-foreground">{svc.description}</p>

              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Availability" value={perf ? `${perf.availability_pct.toFixed(1)}%` : "—"} />
                <Stat label="Avg latency" value={perf?.avg_latency_ms != null ? `${perf.avg_latency_ms} ms` : "—"} />
                <Stat label="Update rate" value={svc.update_frequency ?? "—"} />
              </div>

              <div className="space-y-2">
                <Detail icon={Database} title="Data sources" items={svc.data_sources} />
                <Detail icon={AlertTriangle} title="Known limitations" items={svc.limitations} muted />
              </div>

              {Object.keys(svc.performance_criteria ?? {}).length > 0 && (
                <div className="rounded-lg border border-border bg-secondary/40 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Declared performance criteria
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-foreground">
                    {Object.entries(svc.performance_criteria).map(([k, v]) => (
                      <span key={k}>{k}: <strong>{String(v)}</strong></span>
                    ))}
                  </div>
                </div>
              )}

              {sub?.accepted_limitations_at && (
                <p className="text-[11px] text-muted-foreground">
                  Limitations acknowledged {new Date(sub.accepted_limitations_at).toLocaleString()}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-2 py-2">
      <p className="font-mono text-sm font-700 text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Detail({ icon: Icon, title, items, muted }: { icon: any; title: string; items: string[]; muted?: boolean }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" /> {title}
      </p>
      <ul className={`text-xs space-y-0.5 ${muted ? "text-muted-foreground" : "text-foreground"}`}>
        {items.map((i) => <li key={i} className="flex gap-1.5"><span className="text-muted-foreground">·</span>{i}</li>)}
      </ul>
    </div>
  );
}

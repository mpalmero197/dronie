import { useEffect, useMemo, useState } from "react";
import { BookOpen, FileText, Gauge, Loader2, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  incidentSchema, listIncidents, listPerformance, listPersonnel, listQmsDocuments,
  rollupPerformance, PART_146_OBLIGATIONS, SEVERITY_STYLES, SERVICE_LABELS,
  type AdspIncident, type AdspPersonnel, type AdspQmsDocument, type AdspPerformanceSample,
} from "@/lib/adsp";

export default function ProviderCompliance() {
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<AdspIncident[]>([]);
  const [docs, setDocs] = useState<AdspQmsDocument[]>([]);
  const [people, setPeople] = useState<AdspPersonnel[]>([]);
  const [samples, setSamples] = useState<AdspPerformanceSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", severity: "medium", service_kind: "none",
    root_cause: "", corrective_action: "",
  });

  const load = async () => {
    setLoading(true);
    const [i, d, p, s] = await Promise.all([
      listIncidents().catch(() => [] as AdspIncident[]),
      listQmsDocuments().catch(() => [] as AdspQmsDocument[]),
      listPersonnel().catch(() => [] as AdspPersonnel[]),
      listPerformance(30).catch(() => [] as AdspPerformanceSample[]),
    ]);
    setIncidents(i); setDocs(d); setPeople(p); setSamples(s);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const rollup = useMemo(() => rollupPerformance(samples), [samples]);

  const submitIncident = async () => {
    const parsed = incidentSchema.safeParse(form);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      toast({ title: "Check the report", description: first ?? "Invalid input", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("adsp_incidents").insert({
        reported_by: auth.user?.id ?? null,
        title: parsed.data.title,
        description: parsed.data.description,
        severity: parsed.data.severity,
        service_kind: form.service_kind === "none" ? null : form.service_kind,
        root_cause: parsed.data.root_cause || null,
        corrective_action: parsed.data.corrective_action || null,
        started_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: "Report filed", description: "The malfunction has been added to the provider incident log." });
      setForm({ title: "", description: "", severity: "medium", service_kind: "none", root_cause: "", corrective_action: "" });
      load();
    } catch (e) {
      toast({ title: "Could not file the report", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading compliance records…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h3 className="font-display font-700 text-base">Provider obligations</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {PART_146_OBLIGATIONS.map((o) => (
            <div key={o.title} className="rounded-lg border border-border bg-secondary/30 p-3">
              <p className="text-sm font-semibold">{o.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{o.detail}</p>
              <Badge variant="outline" className="mt-2 text-[10px]">{o.reference}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="w-4 h-4 text-primary" />
          <h3 className="font-display font-700 text-base">Measured service performance (30 days)</h3>
        </div>
        {rollup.length === 0 ? (
          <p className="text-sm text-muted-foreground">No performance samples recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">Service</th>
                  <th className="py-2 pr-3 font-medium">Samples</th>
                  <th className="py-2 pr-3 font-medium">Availability</th>
                  <th className="py-2 pr-3 font-medium">Avg latency</th>
                  <th className="py-2 pr-3 font-medium">p95 latency</th>
                  <th className="py-2 font-medium">Error rate</th>
                </tr>
              </thead>
              <tbody>
                {rollup.map((r) => (
                  <tr key={r.kind} className="border-b border-border/50">
                    <td className="py-2 pr-3">{SERVICE_LABELS[r.kind] ?? r.kind}</td>
                    <td className="py-2 pr-3 font-mono">{r.samples}</td>
                    <td className="py-2 pr-3 font-mono">{r.availability_pct.toFixed(1)}%</td>
                    <td className="py-2 pr-3 font-mono">{r.avg_latency_ms != null ? `${r.avg_latency_ms} ms` : "—"}</td>
                    <td className="py-2 pr-3 font-mono">{r.p95_latency_ms != null ? `${r.p95_latency_ms} ms` : "—"}</td>
                    <td className="py-2 font-mono">{r.error_rate_pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-primary" />
            <h3 className="font-display font-700 text-base">Quality management documents</h3>
          </div>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No QMS documents published yet.</p>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold">{d.title}</span>
                    <Badge variant="outline" className="text-[10px]">{d.doc_type}</Badge>
                    <Badge variant="outline" className="text-[10px] font-mono">v{d.version}</Badge>
                  </div>
                  {d.summary && <p className="text-xs text-muted-foreground mt-1">{d.summary}</p>}
                  <p className="text-[11px] text-muted-foreground font-mono mt-1">
                    {d.reference ?? "—"}
                    {d.effective_date && ` · effective ${d.effective_date}`}
                    {d.review_due && ` · review due ${d.review_due}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="font-display font-700 text-base">Accountable personnel</h3>
          </div>
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground">No personnel records published yet.</p>
          ) : (
            <div className="space-y-2">
              {people.map((p) => (
                <div key={p.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold">{p.full_name} <span className="text-muted-foreground font-normal">— {p.role_title}</span></p>
                  {p.responsibilities && <p className="text-xs text-muted-foreground mt-1">{p.responsibilities}</p>}
                  {p.training_completed?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.training_completed.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground font-mono mt-1">
                    {p.competency_verified_at ? `verified ${p.competency_verified_at}` : "not yet verified"}
                    {p.next_review && ` · next review ${p.next_review}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <TriangleAlert className="w-4 h-4 text-accent" />
          <h3 className="font-display font-700 text-base">Malfunction & outage log</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-2 mb-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Erroneous terrain elevation returned" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low", "medium", "high", "critical"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Service</Label>
              <Select value={form.service_kind} onValueChange={(v) => setForm({ ...form, service_kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not service specific</SelectItem>
                  {Object.entries(SERVICE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">What happened</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the malfunction, when it started and what the operational impact was." />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={submitIncident} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} File report
            </Button>
          </div>
        </div>

        {incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No incidents recorded.</p>
        ) : (
          <div className="space-y-2">
            {incidents.map((i) => (
              <div key={i.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{i.title}</span>
                  <Badge variant="outline" className={SEVERITY_STYLES[i.severity]}>{i.severity}</Badge>
                  {i.service_kind && <Badge variant="outline" className="text-[10px]">{SERVICE_LABELS[i.service_kind]}</Badge>}
                  <Badge variant="outline" className="text-[10px]">{i.resolved_at ? "resolved" : "open"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{i.description}</p>
                {i.corrective_action && <p className="text-xs mt-1"><strong>Corrective action:</strong> {i.corrective_action}</p>}
                <p className="text-[11px] text-muted-foreground font-mono mt-1">
                  started {new Date(i.started_at).toLocaleString()}
                  {i.resolved_at && ` · resolved ${new Date(i.resolved_at).toLocaleString()}`}
                  {` · ${i.affected_users} user(s) affected`}
                  {i.faa_notified && " · FAA notified"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

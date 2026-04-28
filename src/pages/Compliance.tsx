import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Award, Battery, BookCheck, Calendar, ClipboardList,
  Plane, Plus, ShieldCheck, Wrench, Clock, AlertTriangle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface FlightLogRow {
  id: string;
  recorded_at: string;
  job_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  latitude: number | null;
  longitude: number | null;
}
interface MaintRow {
  id: string;
  drone_id: string;
  task: string;
  due_date: string;
  cycles_left: number;
  health_pct: number;
  status: string;
}
interface CertRow {
  id: string;
  cert_type: string;
  issued_at: string;
  expires_at: string;
  notes: string | null;
  recert_required?: boolean;
  recert_confirmed_at?: string | null;
}
interface JobRow { id: string; mission_type: string; started_at: string; ended_at: string | null; }
interface DroneRow { id: string; name: string; }

export default function Compliance() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [logs, setLogs] = useState<FlightLogRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [maint, setMaint] = useState<MaintRow[]>([]);
  const [drones, setDrones] = useState<DroneRow[]>([]);
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);

  // New cert dialog
  const [certOpen, setCertOpen] = useState(false);
  const [certDraft, setCertDraft] = useState({ cert_type: "Part 107", issued_at: "", expires_at: "", notes: "" });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [logsRes, jobsRes, dronesRes, maintRes, certsRes] = await Promise.all([
        supabase.from("mission_logs").select("id, recorded_at, job_id, event_type, payload, latitude, longitude")
          .eq("pilot_id", user.id).order("recorded_at", { ascending: false }).limit(100),
        supabase.from("jobs").select("id, mission_type, started_at, ended_at").eq("pilot_id", user.id).order("started_at", { ascending: false }).limit(50),
        supabase.from("drones").select("id, name"),
        supabase.from("drone_maintenance").select("id, drone_id, task, due_date, cycles_left, health_pct, status").order("due_date", { ascending: true }),
        supabase.from("pilot_certifications").select("id, cert_type, issued_at, expires_at, notes, recert_required, recert_confirmed_at").eq("user_id", user.id).order("expires_at", { ascending: true }),
      ]);
      if (cancelled) return;
      setLogs((logsRes.data ?? []) as FlightLogRow[]);
      setJobs((jobsRes.data ?? []) as JobRow[]);
      setDrones((dronesRes.data ?? []) as DroneRow[]);
      setMaint((maintRes.data ?? []) as MaintRow[]);
      setCerts((certsRes.data ?? []) as CertRow[]);
      setLoading(false);
    }
    load();
  }, [user]);

  // Compute jobs durations + totals from real rows
  const stats = useMemo(() => {
    const ms90 = Date.now() - 90 * 86400 * 1000;
    let totalMin = 0;
    let last90 = 0;
    for (const j of jobs) {
      const start = +new Date(j.started_at);
      const end = j.ended_at ? +new Date(j.ended_at) : Date.now();
      const mins = Math.max(0, (end - start) / 60000);
      totalMin += mins;
      if (start >= ms90) last90 += 1;
    }
    const part107 = certs.find((c) => /107/.test(c.cert_type));
    const daysToExpiry = part107
      ? Math.ceil((+new Date(part107.expires_at) - Date.now()) / 86400000)
      : null;
    return {
      totalHours: totalMin / 60,
      flights90: last90,
      part107,
      daysToExpiry,
    };
  }, [jobs, certs]);

  const droneById = useMemo(() => Object.fromEntries(drones.map((d) => [d.id, d.name])), [drones]);

  async function addCert() {
    if (!user) return;
    if (!certDraft.cert_type || !certDraft.issued_at || !certDraft.expires_at) {
      toast({ title: "Missing fields", description: "Cert type, issued and expiry dates are required", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("pilot_certifications").insert({
      user_id: user.id,
      cert_type: certDraft.cert_type,
      issued_at: certDraft.issued_at,
      expires_at: certDraft.expires_at,
      notes: certDraft.notes || null,
    });
    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Certification saved" });
    setCertOpen(false);
    setCertDraft({ cert_type: "Part 107", issued_at: "", expires_at: "", notes: "" });
    // refresh
    const { data } = await supabase.from("pilot_certifications").select("id, cert_type, issued_at, expires_at, notes").eq("user_id", user.id).order("expires_at", { ascending: true });
    setCerts((data ?? []) as CertRow[]);
  }

  if (authLoading) return <CenteredSpinner />;
  if (!user) { navigate("/auth"); return null; }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-display font-700 truncate">Compliance · UAS Part 107</h1>
              <p className="text-xs text-muted-foreground truncate">Airspace · maintenance · pilot currency</p>
            </div>
          </div>
          <Badge variant="outline" className="hidden sm:flex gap-1 text-[10px]">
            <ShieldCheck className="w-3 h-3 text-primary" />
            {stats.part107 && (stats.daysToExpiry ?? 0) > 0 ? "Compliant" : "Action needed"}
          </Badge>
        </div>
      </header>

      {loading ? <CenteredSpinner /> : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
          {/* KPI strip */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              icon={Award}
              label="Part 107 expiry"
              value={stats.daysToExpiry != null ? `${stats.daysToExpiry}d` : "—"}
              sub={stats.part107?.expires_at ?? "Add certification"}
              tone={stats.part107 == null ? "warn" : (stats.daysToExpiry ?? 0) < 60 ? "warn" : "ok"}
            />
            <Kpi icon={Plane} label="Total flight time" value={`${stats.totalHours.toFixed(1)}h`} sub={`${jobs.length} sorties`} tone="ok" />
            <Kpi icon={Clock} label="90-day currency" value={`${stats.flights90}`} sub="≥ 3 to stay current" tone={stats.flights90 >= 3 ? "ok" : "warn"} />
            <Kpi
              icon={Wrench}
              label="Open maintenance"
              value={`${maint.length}`}
              sub="items pending"
              tone={maint.some((m) => +new Date(m.due_date) < Date.now()) ? "warn" : "ok"}
            />
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Pilot certifications */}
            <section className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-2"><Award className="w-4 h-4 text-accent" /> Pilot certifications</h2>
                <Dialog open={certOpen} onOpenChange={setCertOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add certification</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Cert type</Label><Input value={certDraft.cert_type} onChange={(e) => setCertDraft({ ...certDraft, cert_type: e.target.value })} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Issued</Label><Input type="date" value={certDraft.issued_at} onChange={(e) => setCertDraft({ ...certDraft, issued_at: e.target.value })} /></div>
                        <div><Label>Expires</Label><Input type="date" value={certDraft.expires_at} onChange={(e) => setCertDraft({ ...certDraft, expires_at: e.target.value })} /></div>
                      </div>
                      <div><Label>Notes (optional)</Label><Input value={certDraft.notes} onChange={(e) => setCertDraft({ ...certDraft, notes: e.target.value })} /></div>
                    </div>
                    <DialogFooter><Button onClick={addCert}>Save</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="divide-y divide-border">
                {certs.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    <BookCheck className="w-6 h-6 mx-auto mb-2 text-muted-foreground/60" />
                    No certifications on file. Add your Part 107 to track expiry.
                  </div>
                )}
                {certs.map((c) => {
                  const days = Math.ceil((+new Date(c.expires_at) - Date.now()) / 86400000);
                  return (
                    <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{c.cert_type}</p>
                        <p className="text-[11px] text-muted-foreground">Issued {c.issued_at} · expires {c.expires_at}</p>
                        {c.notes && <p className="text-[11px] text-muted-foreground truncate">{c.notes}</p>}
                      </div>
                      {days < 0
                        ? <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" /> Expired</Badge>
                        : days < 60
                          ? <Badge className="bg-accent/15 text-accent border-accent/20 text-[10px]">{days}d left</Badge>
                          : <Badge className="bg-primary/15 text-primary border-primary/20 text-[10px]">{days}d</Badge>}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Maintenance */}
            <section className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-2"><Wrench className="w-4 h-4 text-primary" /> Maintenance</h2>
                <Badge variant="outline" className="text-[10px]">{maint.length} open</Badge>
              </div>
              <div className="divide-y divide-border">
                {maint.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No scheduled maintenance. Admins can add tasks from Fleet Management.
                  </div>
                )}
                {maint.map((m) => {
                  const overdue = +new Date(m.due_date) < Date.now();
                  return (
                    <div key={m.id} className="px-4 py-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{m.task}</p>
                        <p className="text-[11px] text-muted-foreground">{droneById[m.drone_id] ?? "—"} · due {m.due_date}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Battery className="w-4 h-4 text-primary" />
                        <span className="font-mono">{m.health_pct}%</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">{m.cycles_left} cycles</span>
                      {overdue
                        ? <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" /> Overdue</Badge>
                        : <Badge className="bg-primary/15 text-primary border-primary/20 text-[10px]">Scheduled</Badge>}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Flight log */}
          <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" /> Flight log (last 100 events)</h2>
              <span className="text-[11px] text-muted-foreground">{logs.length} events</span>
            </div>
            <div className="overflow-x-auto">
              {logs.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <Calendar className="w-6 h-6 mx-auto mb-2 text-muted-foreground/60" />
                  No flight log entries yet. Start a job from Active Jobs to record events.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-muted-foreground text-[11px] uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold">When</th>
                      <th className="text-left px-4 py-2 font-semibold">Event</th>
                      <th className="text-left px-4 py-2 font-semibold hidden md:table-cell">Coordinates</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {logs.map((l) => (
                      <tr key={l.id} className="hover:bg-secondary/30">
                        <td className="px-4 py-2.5 font-mono text-[12px]">{new Date(l.recorded_at).toLocaleString()}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="capitalize text-[10px]">{l.event_type}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-muted-foreground hidden md:table-cell font-mono">
                          {l.latitude != null && l.longitude != null
                            ? `${l.latitude.toFixed(4)}, ${l.longitude.toFixed(4)}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function CenteredSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, sub, tone = "ok",
}: { icon: typeof Plane; label: string; value: string; sub: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Icon className={`w-4 h-4 ${tone === "warn" ? "text-accent" : "text-primary"}`} /> {label}
      </div>
      <p className="font-display font-700 text-2xl mt-1">{value}</p>
      <p className={`text-[11px] mt-0.5 ${tone === "warn" ? "text-accent-foreground" : "text-muted-foreground"}`}>{sub}</p>
    </div>
  );
}
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Award, Battery, BookCheck, Calendar, CheckCircle2, ClipboardList, Plane, Plus,
  ShieldCheck, Wrench, Clock, AlertTriangle, MapPin, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface FlightLog {
  id: string;
  date: string;
  aircraft: string;
  duration: number; // minutes
  type: "training" | "commercial" | "recreational";
  location: string;
  notes?: string;
}

interface MaintItem {
  id: string;
  drone: string;
  task: string;
  due: string;
  cyclesLeft: number;
  health: number;
}

interface AirspaceZone {
  id: string;
  label: string;
  type: "Class B" | "Class C" | "Class D" | "Class E" | "Restricted";
  ceiling: number;
  status: "ok" | "auth-required" | "no-fly";
}

const SEED_LOGS: FlightLog[] = [
  { id: "L1", date: today(-1), aircraft: "Hawk-1 (M3E)", duration: 38, type: "commercial", location: "37.7749, −122.4194", notes: "Stockpile survey" },
  { id: "L2", date: today(-3), aircraft: "Hawk-2 (M3M)", duration: 24, type: "commercial", location: "37.7681, −122.4220" },
  { id: "L3", date: today(-9), aircraft: "Hawk-1 (M3E)", duration: 51, type: "training", location: "37.8044, −122.2711", notes: "Loiter recovery drills" },
  { id: "L4", date: today(-30), aircraft: "Hawk-3 (Mavic)", duration: 14, type: "recreational", location: "37.8716, −122.2727" },
];

const SEED_MAINT: MaintItem[] = [
  { id: "M1", drone: "Hawk-1", task: "Battery #4 calibration", due: today(2), cyclesLeft: 38, health: 86 },
  { id: "M2", drone: "Hawk-2", task: "Propeller inspection",   due: today(7), cyclesLeft: 12, health: 71 },
  { id: "M3", drone: "Hawk-3", task: "Firmware update v8.4",   due: today(-1), cyclesLeft: 0, health: 95 },
];

const SEED_AIRSPACE: AirspaceZone[] = [
  { id: "A1", label: "SFO Class B (KSFO)",   type: "Class B", ceiling: 100, status: "auth-required" },
  { id: "A2", label: "OAK Class C (KOAK)",   type: "Class C", ceiling: 200, status: "auth-required" },
  { id: "A3", label: "Hayward Class D",       type: "Class D", ceiling: 300, status: "auth-required" },
  { id: "A4", label: "GG National Recreation",type: "Restricted", ceiling: 0, status: "no-fly" },
  { id: "A5", label: "Open countryside (G)",  type: "Class E", ceiling: 400, status: "ok" },
];

function today(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export default function Compliance() {
  const { toast } = useToast();
  const [logs] = useState<FlightLog[]>(SEED_LOGS);
  const [maint] = useState<MaintItem[]>(SEED_MAINT);
  const [airspace] = useState<AirspaceZone[]>(SEED_AIRSPACE);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [autoSubmit, setAutoSubmit] = useState(true);

  // Part 107 currency: 90-day rolling, 3 takeoffs/landings = recent.
  // Cert valid for 24 calendar months from issuance.
  const stats = useMemo(() => {
    const ms90 = Date.now() - 90 * 86400 * 1000;
    const last90 = logs.filter((l) => +new Date(l.date) >= ms90);
    const totalHours = logs.reduce((s, l) => s + l.duration, 0) / 60;
    const flights90 = last90.length;
    const certIssued = "2024-09-12";
    const certExpires = "2026-09-30";
    const daysToExpiry = Math.ceil((+new Date(certExpires) - Date.now()) / 86400000);
    return { totalHours, flights90, certIssued, certExpires, daysToExpiry };
  }, [logs]);

  function submitLAANC(zoneId: string) {
    setSubmitting(zoneId);
    setTimeout(() => {
      setSubmitting(null);
      toast({
        title: "LAANC authorization submitted",
        description: "Approval received instantly · valid for 12 hours · ceiling honored.",
      });
    }, 1200);
  }

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
          <Badge variant="outline" className="hidden sm:flex gap-1 text-[10px]"><ShieldCheck className="w-3 h-3 text-primary" /> Compliant</Badge>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Top KPI strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={Award} label="Part 107 expiry" value={`${stats.daysToExpiry}d`} sub={stats.certExpires} tone={stats.daysToExpiry < 60 ? "warn" : "ok"} />
          <Kpi icon={Plane} label="Total flight time" value={`${stats.totalHours.toFixed(1)}h`} sub={`${logs.length} sorties`} tone="ok" />
          <Kpi icon={Clock} label="90-day currency" value={`${stats.flights90}`} sub="≥ 3 to stay current" tone={stats.flights90 >= 3 ? "ok" : "warn"} />
          <Kpi icon={Wrench} label="Open maintenance" value={`${maint.length}`} sub="items pending" tone={maint.some((m) => +new Date(m.due) < Date.now()) ? "warn" : "ok"} />
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Airspace + LAANC */}
          <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Airspace & LAANC</h2>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Switch checked={autoSubmit} onCheckedChange={setAutoSubmit} />
                Auto-submit eligible
              </div>
            </div>
            <div className="divide-y divide-border">
              {airspace.map((z) => (
                <div key={z.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{z.label}</p>
                    <p className="text-[11px] text-muted-foreground">{z.type} · ceiling {z.ceiling || "—"} ft AGL</p>
                  </div>
                  {z.status === "ok" && <Badge className="bg-primary/15 text-primary border-primary/20 text-[10px]">OK to fly</Badge>}
                  {z.status === "auth-required" && (
                    <Button size="sm" onClick={() => submitLAANC(z.id)} disabled={submitting === z.id} className="gap-1.5 h-8 text-[11px]">
                      <Send className="w-3.5 h-3.5" /> {submitting === z.id ? "Submitting…" : "LAANC"}
                    </Button>
                  )}
                  {z.status === "no-fly" && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" /> No-fly</Badge>}
                </div>
              ))}
            </div>
          </section>

          {/* Pilot currency */}
          <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2"><Award className="w-4 h-4 text-accent" /> Pilot · Part 107 currency</h2>
              <Badge variant="outline" className="text-[10px]">Cert {stats.certIssued}</Badge>
            </div>
            <div className="p-4 space-y-4">
              <CurrencyBar
                label="Recurrent training (every 24mo)"
                completed={Math.max(0, 24 - Math.floor(stats.daysToExpiry / 30))}
                total={24}
                unit="mo"
              />
              <CurrencyBar label="90-day takeoffs / landings" completed={stats.flights90} total={3} unit="" tone="accent" />
              <CurrencyBar label="Logged hours (rolling year)" completed={Math.round(stats.totalHours)} total={20} unit="h" tone="primary" />
              <div className="rounded-lg bg-secondary/40 border border-border p-3 text-xs flex items-start gap-2">
                <BookCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Online recurrent training due in {Math.max(0, stats.daysToExpiry - 60)} days.</p>
                  <p className="text-muted-foreground">Reminder will be sent 30 days prior. ATPs and Knowledge Tests are tracked here automatically.</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Flight log */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" /> Flight log</h2>
            <Button size="sm" variant="outline" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Manual entry</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-muted-foreground text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Date</th>
                  <th className="text-left px-4 py-2 font-semibold">Aircraft</th>
                  <th className="text-left px-4 py-2 font-semibold">Type</th>
                  <th className="text-right px-4 py-2 font-semibold">Duration</th>
                  <th className="text-left px-4 py-2 font-semibold hidden md:table-cell">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-2.5 font-mono text-[12px]">{l.date}</td>
                    <td className="px-4 py-2.5">{l.aircraft}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="capitalize text-[10px]">{l.type}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{l.duration}m</td>
                    <td className="px-4 py-2.5 text-[11px] text-muted-foreground hidden md:table-cell font-mono">{l.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Maintenance schedule */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2"><Wrench className="w-4 h-4 text-primary" /> Maintenance & battery health</h2>
            <Badge variant="outline" className="text-[10px]">{maint.length} open</Badge>
          </div>
          <div className="divide-y divide-border">
            {maint.map((m) => {
              const overdue = +new Date(m.due) < Date.now();
              return (
                <div key={m.id} className="px-4 py-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{m.task}</p>
                    <p className="text-[11px] text-muted-foreground">{m.drone} · due {m.due}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Battery className="w-4 h-4 text-primary" />
                    <span className="font-mono">{m.health}%</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">{m.cyclesLeft} cycles left</span>
                  {overdue ? (
                    <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" /> Overdue</Badge>
                  ) : (
                    <Badge className="bg-primary/15 text-primary border-primary/20 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" /> Scheduled</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
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

function CurrencyBar({
  label, completed, total, unit, tone = "primary",
}: { label: string; completed: number; total: number; unit: string; tone?: "primary" | "accent" }) {
  const pct = Math.min(100, (completed / total) * 100);
  const color = tone === "accent" ? "bg-accent" : "bg-primary";
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-muted-foreground">{completed}{unit} / {total}{unit}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

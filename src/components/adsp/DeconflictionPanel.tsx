import { useEffect, useState } from "react";
import {
  CheckCircle2, CloudSun, Loader2, Mountain, Plane, Radar, Send, TriangleAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  listIntents, runAeroData, runDeconfliction, updateIntent, volumeSchema,
  type AeroDataResult, type DeconflictionResult, type FlightIntent, type LatLng,
} from "@/lib/adsp";

/** Build a square operating area from a centre point and radius. */
function squareAround(lat: number, lng: number, radiusM: number): LatLng[] {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  return [
    { lat: lat + dLat, lng: lng - dLng },
    { lat: lat + dLat, lng: lng + dLng },
    { lat: lat - dLat, lng: lng + dLng },
    { lat: lat - dLat, lng: lng - dLng },
  ];
}

function localIso(offsetMinutes: number) {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export default function DeconflictionPanel() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: "Untitled operation",
    lat: "39.7392",
    lng: "-104.9903",
    radius: "400",
    min_alt_agl_m: "0",
    max_alt_agl_m: "120",
    start_time: localIso(30),
    end_time: localIso(120),
    buffer_m: "500",
  });
  const [publish, setPublish] = useState(true);
  const [shared, setShared] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DeconflictionResult | null>(null);
  const [aero, setAero] = useState<AeroDataResult | null>(null);
  const [intents, setIntents] = useState<FlightIntent[]>([]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const loadIntents = async () => {
    if (!user) return;
    try { setIntents(await listIntents(user.id)); } catch { /* ignore */ }
  };
  useEffect(() => { loadIntents(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const run = async () => {
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    const radius = Number(form.radius);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) {
      toast({ title: "Check the operating area", description: "Enter a valid centre point and radius.", variant: "destructive" });
      return;
    }
    const parsed = volumeSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Check the operation details", description: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "Invalid input", variant: "destructive" });
      return;
    }
    if (parsed.data.max_alt_agl_m <= parsed.data.min_alt_agl_m) {
      toast({ title: "Altitude band invalid", description: "Ceiling must be above the floor.", variant: "destructive" });
      return;
    }
    const polygon = squareAround(lat, lng, radius);
    const start = new Date(parsed.data.start_time).toISOString();
    const end = new Date(parsed.data.end_time).toISOString();
    if (new Date(end) <= new Date(start)) {
      toast({ title: "Time window invalid", description: "End time must be after the start time.", variant: "destructive" });
      return;
    }

    setRunning(true);
    setResult(null);
    setAero(null);
    try {
      const [dec, air] = await Promise.all([
        runDeconfliction({
          name: parsed.data.name,
          polygon,
          min_alt_agl_m: parsed.data.min_alt_agl_m,
          max_alt_agl_m: parsed.data.max_alt_agl_m,
          start_time: start,
          end_time: end,
          buffer_m: parsed.data.buffer_m,
          publish,
          shared,
        }),
        runAeroData({ polygon }).catch(() => null),
      ]);
      setResult(dec);
      setAero(air);
      await loadIntents();
      toast({
        title: dec.clear ? "Volume is clear" : `${dec.conflicts.length} conflict${dec.conflicts.length === 1 ? "" : "s"} found`,
        description: `Checked ${dec.checked} shared operation${dec.checked === 1 ? "" : "s"} in ${dec.latency_ms} ms.`,
        variant: dec.clear ? undefined : "destructive",
      });
    } catch (e) {
      toast({ title: "Deconfliction failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const applySuggestion = (s: DeconflictionResult["suggestions"][number]) => {
    setForm((f) => ({
      ...f,
      start_time: s.start_time ? new Date(s.start_time).toISOString().slice(0, 16) : f.start_time,
      end_time: s.end_time ? new Date(s.end_time).toISOString().slice(0, 16) : f.end_time,
      max_alt_agl_m: s.max_alt_agl_m != null ? String(s.max_alt_agl_m) : f.max_alt_agl_m,
      radius: s.buffer_m != null ? String(Math.max(50, Number(f.radius) - s.buffer_m / 2)) : f.radius,
    }));
    toast({ title: "Applied", description: "Re-run the check to confirm the volume is clear." });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr] items-start">
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4 text-primary" />
          <h3 className="font-display font-700 text-base">Operation volume</h3>
        </div>

        <Field label="Operation name"><Input value={form.name} onChange={set("name")} maxLength={160} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Centre latitude"><Input value={form.lat} onChange={set("lat")} inputMode="decimal" /></Field>
          <Field label="Centre longitude"><Input value={form.lng} onChange={set("lng")} inputMode="decimal" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Radius (m)"><Input value={form.radius} onChange={set("radius")} inputMode="numeric" /></Field>
          <Field label="Lateral buffer (m)"><Input value={form.buffer_m} onChange={set("buffer_m")} inputMode="numeric" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Floor (m AGL)"><Input value={form.min_alt_agl_m} onChange={set("min_alt_agl_m")} inputMode="numeric" /></Field>
          <Field label="Ceiling (m AGL)"><Input value={form.max_alt_agl_m} onChange={set("max_alt_agl_m")} inputMode="numeric" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><Input type="datetime-local" value={form.start_time} onChange={set("start_time")} /></Field>
          <Field label="End"><Input type="datetime-local" value={form.end_time} onChange={set("end_time")} /></Field>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
          <ToggleRow label="Publish as a flight intent" hint="Stores the volume so other operators can deconflict against it." checked={publish} onChange={setPublish} />
          <ToggleRow label="Share with the network" hint="Required for strategic deconfliction to be reciprocal." checked={shared} onChange={setShared} disabled={!publish} />
        </div>

        <Button className="w-full" onClick={run} disabled={running}>
          {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          {running ? "Checking volume…" : "Run strategic deconfliction"}
        </Button>
      </Card>

      <div className="space-y-4">
        {result && (
          <Card className={`p-5 border ${result.clear ? "border-primary/30" : "border-destructive/30"}`}>
            <div className="flex items-center gap-2 mb-3">
              {result.clear
                ? <CheckCircle2 className="w-5 h-5 text-primary" />
                : <TriangleAlert className="w-5 h-5 text-destructive" />}
              <h3 className="font-display font-700 text-base">
                {result.clear ? "No conflicting operations" : `${result.conflicts.length} potential conflict${result.conflicts.length === 1 ? "" : "s"}`}
              </h3>
              <Badge variant="outline" className="ml-auto font-mono text-[11px]">{result.latency_ms} ms · {result.checked} checked</Badge>
            </div>

            {result.conflicts.map((c) => (
              <div key={c.intent_id} className="rounded-lg border border-border p-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{c.name}</span>
                  {c.own_operation && <Badge variant="outline" className="text-[10px]">your operation</Badge>}
                  <Badge variant="outline" className="text-[10px] capitalize">{c.severity} severity</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {c.lateral} · {Math.round(c.separation_m)} m separation · {c.altitude_band_m[0]}–{c.altitude_band_m[1]} m AGL
                  {c.altitude_overlap ? " (overlapping)" : " (vertically separated)"} · {Math.round(c.time_overlap_minutes)} min time overlap
                </p>
              </div>
            ))}

            {result.suggestions.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Suggested mitigations</p>
                <div className="flex flex-wrap gap-2">
                  {result.suggestions.map((s, i) => (
                    <Button key={i} size="sm" variant="outline" onClick={() => applySuggestion(s)}>{s.label}</Button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {aero && (
          <div className="grid gap-4 md:grid-cols-3">
            <AdvisoryCard icon={Mountain} title="Terrain & obstacles" body={aero.terrain?.advisory ?? aero.terrain?.note ?? "Unavailable"} source={aero.terrain?.source} />
            <AdvisoryCard icon={Plane} title="Aeronautical" body={aero.aeronautical?.advisory ?? "Unavailable"} source={aero.aeronautical?.source} extra={aero.aeronautical?.reminder} />
            <AdvisoryCard
              icon={CloudSun}
              title="Weather"
              body={aero.weather?.advisory ?? aero.weather?.note ?? "Unavailable"}
              source={aero.weather?.source}
              tone={aero.weather?.go === false ? "warn" : undefined}
              extra={aero.weather?.current
                ? `${aero.weather.current.wind_kph} km/h wind, gusts ${aero.weather.current.gust_kph} km/h, ${aero.weather.current.visibility_km} km visibility, ${aero.weather.current.temperature_c}°C`
                : undefined}
            />
          </div>
        )}

        <Card className="p-5">
          <h3 className="font-display font-700 text-base mb-3">Your published flight intents</h3>
          {intents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No intents published yet. Run a check with publishing enabled to share your volume.</p>
          ) : (
            <div className="space-y-2">
              {intents.slice(0, 12).map((i) => (
                <div key={i.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{i.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {new Date(i.start_time).toLocaleString()} → {new Date(i.end_time).toLocaleTimeString()} · {i.min_alt_agl_m}–{i.max_alt_agl_m} m AGL
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize text-[10px]">{i.status}</Badge>
                  {i.status !== "cancelled" && i.status !== "completed" && (
                    <Button size="sm" variant="ghost" onClick={async () => {
                      await updateIntent(i.id, { status: "cancelled" });
                      loadIntents();
                    }}>Cancel</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange, disabled }: {
  label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
    </div>
  );
}

function AdvisoryCard({ icon: Icon, title, body, source, extra, tone }: {
  icon: any; title: string; body: string; source?: string; extra?: string; tone?: "warn";
}) {
  return (
    <Card className={`p-4 ${tone === "warn" ? "border-destructive/30" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${tone === "warn" ? "text-destructive" : "text-primary"}`} />
        <h4 className="font-display font-700 text-sm">{title}</h4>
      </div>
      <p className="text-xs text-foreground">{body}</p>
      {extra && <p className="text-[11px] text-muted-foreground mt-2 font-mono">{extra}</p>}
      {source && <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-2">Source: {source}</p>}
    </Card>
  );
}

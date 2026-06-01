import { useEffect, useState } from "react";
import { CalendarClock, CloudSun, Wind, Droplets, Eye, Thermometer, Loader2, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Schedule {
  id: string;
  plan_id: string;
  scheduled_at: string;
  status: string;
  weather_status: string;
  weather_summary: string | null;
  weather_checked_at: string | null;
  max_wind_kph: number;
  max_precip_pct: number;
  min_visibility_km: number;
  min_temp_c: number;
  notes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string | null;
  planName: string;
  centerLat?: number | null;
  centerLng?: number | null;
  onChanged?: () => void;
}

function localInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Fetches a weather snapshot for the target hour from Open-Meteo (no key)
 * and decides if conditions pass the user's go/no-go thresholds.
 */
async function evaluateWeather(
  lat: number, lng: number, whenIso: string,
  thresholds: { wind: number; precip: number; vis: number; temp: number },
): Promise<{ status: "go" | "no_go" | "marginal" | "unknown"; summary: string }> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lng.toString());
    url.searchParams.set("hourly", "temperature_2m,precipitation_probability,wind_speed_10m,wind_gusts_10m,visibility");
    url.searchParams.set("wind_speed_unit", "kmh");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "7");
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("forecast unavailable");
    const data = await res.json();
    const times: string[] = data.hourly?.time ?? [];
    if (!times.length) throw new Error("no hourly data");
    const when = new Date(whenIso).getTime();
    let bestIdx = 0; let bestDiff = Infinity;
    times.forEach((t, i) => {
      const diff = Math.abs(new Date(t).getTime() - when);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    });
    const temp = data.hourly.temperature_2m?.[bestIdx];
    const precip = data.hourly.precipitation_probability?.[bestIdx] ?? 0;
    const wind = data.hourly.wind_speed_10m?.[bestIdx] ?? 0;
    const gust = data.hourly.wind_gusts_10m?.[bestIdx] ?? wind;
    const visM = data.hourly.visibility?.[bestIdx] ?? 10000;
    const visKm = visM / 1000;
    const fails: string[] = [];
    const warns: string[] = [];
    if (gust > thresholds.wind) fails.push(`Gust ${gust.toFixed(0)} km/h`);
    else if (wind > thresholds.wind * 0.8) warns.push(`Wind ${wind.toFixed(0)} km/h`);
    if (precip > thresholds.precip) fails.push(`Rain ${precip}%`);
    else if (precip > thresholds.precip * 0.6) warns.push(`Rain ${precip}%`);
    if (visKm < thresholds.vis) fails.push(`Vis ${visKm.toFixed(1)} km`);
    if (temp < thresholds.temp) fails.push(`Temp ${temp.toFixed(0)}°C`);
    const summary = `Wind ${wind.toFixed(0)} (gust ${gust.toFixed(0)}) km/h · Rain ${precip}% · Vis ${visKm.toFixed(1)} km · ${temp?.toFixed(0)}°C`;
    if (fails.length) return { status: "no_go", summary: `${summary} — ${fails.join(", ")}` };
    if (warns.length) return { status: "marginal", summary: `${summary} — ${warns.join(", ")}` };
    return { status: "go", summary };
  } catch (err: any) {
    return { status: "unknown", summary: err?.message ?? "Weather unavailable" };
  }
}

export default function ScheduleMissionDialog({
  open, onOpenChange, planId, planName, centerLat, centerLng, onChanged,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form state
  const defaultWhen = () => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return localInput(d.toISOString());
  };
  const [when, setWhen] = useState(defaultWhen());
  const [wind, setWind] = useState(30);
  const [precip, setPrecip] = useState(30);
  const [vis, setVis] = useState(5);
  const [temp, setTemp] = useState(-10);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !planId) return;
    setLoading(true);
    supabase
      .from("mission_schedules")
      .select("*")
      .eq("plan_id", planId)
      .order("scheduled_at", { ascending: true })
      .then(({ data }) => {
        setItems((data ?? []) as Schedule[]);
        setLoading(false);
      });
  }, [open, planId]);

  const create = async () => {
    if (!user || !planId) return;
    setBusy(true);
    const iso = new Date(when).toISOString();
    const thresholds = { wind, precip, vis, temp };
    let weather = { status: "unknown" as const, summary: "" } as { status: string; summary: string };
    if (centerLat != null && centerLng != null) {
      weather = await evaluateWeather(centerLat, centerLng, iso, thresholds);
    }
    const { data, error } = await supabase
      .from("mission_schedules")
      .insert({
        user_id: user.id,
        plan_id: planId,
        scheduled_at: iso,
        max_wind_kph: wind,
        max_precip_pct: precip,
        min_visibility_km: vis,
        min_temp_c: temp,
        notes: notes.trim() || null,
        weather_status: weather.status,
        weather_summary: weather.summary,
        weather_checked_at: new Date().toISOString(),
      })
      .select()
      .single();
    setBusy(false);
    if (error) {
      toast({ title: "Could not schedule", description: error.message, variant: "destructive" });
      return;
    }
    setItems((p) => [...p, data as Schedule].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)));
    setNotes("");
    toast({
      title: "Flight scheduled",
      description: weather.status === "no_go"
        ? "Weather looks bad — we'll re-check closer to the date."
        : weather.status === "go"
        ? "Weather looks clear for the planned window."
        : "Saved. Re-check weather closer to the date.",
    });
    onChanged?.();
  };

  const recheck = async (s: Schedule) => {
    if (centerLat == null || centerLng == null) {
      toast({ title: "No location", description: "This plan has no usable coordinates.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const weather = await evaluateWeather(centerLat, centerLng, s.scheduled_at, {
      wind: s.max_wind_kph, precip: s.max_precip_pct, vis: s.min_visibility_km, temp: s.min_temp_c,
    });
    await supabase.from("mission_schedules").update({
      weather_status: weather.status,
      weather_summary: weather.summary,
      weather_checked_at: new Date().toISOString(),
    }).eq("id", s.id);
    setItems((p) => p.map((x) => x.id === s.id ? { ...x, weather_status: weather.status, weather_summary: weather.summary, weather_checked_at: new Date().toISOString() } : x));
    setBusy(false);
  };

  const remove = async (s: Schedule) => {
    await supabase.from("mission_schedules").delete().eq("id", s.id);
    setItems((p) => p.filter((x) => x.id !== s.id));
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" /> Schedule mission
          </DialogTitle>
          <DialogDescription className="truncate">
            {planName} — set a go/no-go weather window. We re-check Open-Meteo forecast on demand.
          </DialogDescription>
        </DialogHeader>

        {/* Existing schedules */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming</p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No flights scheduled yet.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((s) => {
                const past = new Date(s.scheduled_at).getTime() < Date.now();
                return (
                  <li key={s.id} className="rounded-lg border border-border bg-secondary/30 p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-sm font-semibold text-foreground">
                        {new Date(s.scheduled_at).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <WeatherChip status={s.weather_status} />
                        {past && <Badge variant="outline" className="text-[10px]">Past</Badge>}
                      </div>
                    </div>
                    {s.weather_summary && (
                      <p className="text-[11px] text-muted-foreground">{s.weather_summary}</p>
                    )}
                    {s.notes && <p className="text-xs text-foreground/80 italic">{s.notes}</p>}
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => recheck(s)} disabled={busy}>
                        <CloudSun className="w-3 h-3" /> Re-check weather
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 hover:border-destructive hover:text-destructive" onClick={() => remove(s)}>
                        <Trash2 className="w-3 h-3" /> Cancel
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add new schedule</p>
          <div>
            <Label className="text-xs">Date & time</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <ThresholdField icon={Wind} label="Max wind (km/h)" value={wind} setValue={setWind} />
            <ThresholdField icon={Droplets} label="Max rain %" value={precip} setValue={setPrecip} />
            <ThresholdField icon={Eye} label="Min vis (km)" value={vis} setValue={setVis} step={0.5} />
            <ThresholdField icon={Thermometer} label="Min temp (°C)" value={temp} setValue={setTemp} />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Crew, equipment, NOTAM check…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={create} disabled={busy || !planId} className="gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
            Schedule & check weather
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ThresholdField({
  icon: Icon, label, value, setValue, step = 1,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; setValue: (n: number) => void; step?: number }) {
  return (
    <div>
      <Label className="text-[11px] flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </Label>
      <Input type="number" step={step} value={value} onChange={(e) => setValue(Number(e.target.value))} />
    </div>
  );
}

function WeatherChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    go: { label: "Go", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
    marginal: { label: "Marginal", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    no_go: { label: "No-go", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    unknown: { label: "Unknown", cls: "bg-secondary text-muted-foreground border-border" },
  };
  const c = map[status] ?? map.unknown;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${c.cls}`}>{c.label}</span>;
}
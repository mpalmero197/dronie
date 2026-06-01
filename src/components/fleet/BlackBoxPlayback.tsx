import { useEffect, useMemo, useState } from "react";
import { Loader2, Play, Pause, SkipBack, Radio, MapPin, Activity, FileClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

interface JobOption {
  id: string;
  mission_type: string;
  started_at: string;
  ended_at: string | null;
  drone_id: string;
  drone_name?: string;
}

interface Track {
  recorded_at: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
}

interface LogEvent {
  recorded_at: string;
  event_type: string;
  payload: Record<string, unknown>;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
}

export default function BlackBoxPlayback() {
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobId, setJobId] = useState<string>("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [t, setT] = useState(0); // index along combined timeline
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, mission_type, started_at, ended_at, drone_id, drones(name)")
        .order("started_at", { ascending: false })
        .limit(50);
      setJobs(
        ((data as any[]) ?? []).map((j) => ({
          id: j.id,
          mission_type: j.mission_type,
          started_at: j.started_at,
          ended_at: j.ended_at,
          drone_id: j.drone_id,
          drone_name: j.drones?.name,
        })),
      );
      setJobsLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    setT(0);
    setPlaying(false);
    (async () => {
      const [{ data: tk }, { data: ev }] = await Promise.all([
        supabase
          .from("pilot_tracks")
          .select("recorded_at, latitude, longitude, altitude, speed, heading")
          .eq("job_id", jobId)
          .order("recorded_at"),
        supabase
          .from("mission_logs")
          .select("recorded_at, event_type, payload, latitude, longitude, altitude")
          .eq("job_id", jobId)
          .order("recorded_at"),
      ]);
      setTracks((tk as Track[]) ?? []);
      setEvents((ev as LogEvent[]) ?? []);
      setLoading(false);
    })();
  }, [jobId]);

  // Playback timer
  useEffect(() => {
    if (!playing || tracks.length === 0) return;
    const id = setInterval(() => {
      setT((cur) => {
        const next = cur + 1;
        if (next >= tracks.length) {
          setPlaying(false);
          return tracks.length - 1;
        }
        return next;
      });
    }, Math.max(50, 1000 / speed));
    return () => clearInterval(id);
  }, [playing, speed, tracks.length]);

  const current = tracks[t];
  const startMs = tracks[0] ? new Date(tracks[0].recorded_at).getTime() : 0;
  const elapsed = current ? Math.round((new Date(current.recorded_at).getTime() - startMs) / 1000) : 0;

  // Filter events up to the current time
  const currentTimeMs = current ? new Date(current.recorded_at).getTime() : 0;
  const visibleEvents = useMemo(
    () => events.filter((e) => new Date(e.recorded_at).getTime() <= currentTimeMs).slice(-30).reverse(),
    [events, currentTimeMs],
  );

  if (jobsLoading) {
    return <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Mission</label>
          <Select value={jobId} onValueChange={setJobId}>
            <SelectTrigger><SelectValue placeholder="Select a recent mission to replay" /></SelectTrigger>
            <SelectContent>
              {jobs.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No missions recorded yet</div>}
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.drone_name ?? "Drone"} · {j.mission_type} · {new Date(j.started_at).toLocaleString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {jobId && tracks.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setT(0); setPlaying(false); }}>
              <SkipBack className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </Button>
            <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 4, 8, 16].map((s) => <SelectItem key={s} value={String(s)}>{s}×</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {loading && <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

      {!loading && jobId && tracks.length === 0 && (
        <div className="text-center py-16 border border-border rounded-xl bg-card/50">
          <FileClock className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No black-box data recorded for this mission</p>
        </div>
      )}

      {!loading && current && (
        <>
          <div className="border border-border rounded-xl p-4 bg-card/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Radio className={`w-4 h-4 ${playing ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                <span className="text-sm font-mono text-foreground">T+{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
                <Badge variant="outline" className="text-xs">{t + 1}/{tracks.length}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(current.recorded_at).toLocaleTimeString()}</span>
            </div>
            <Slider
              value={[t]}
              min={0}
              max={Math.max(0, tracks.length - 1)}
              step={1}
              onValueChange={([v]) => setT(v)}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <Stat label="Altitude" value={`${(current.altitude ?? 0).toFixed(1)} m`} />
              <Stat label="Speed" value={`${(current.speed ?? 0).toFixed(1)} m/s`} />
              <Stat label="Heading" value={`${Math.round(current.heading ?? 0)}°`} />
              <Stat label="Position" value={`${current.latitude.toFixed(5)}, ${current.longitude.toFixed(5)}`} mono />
            </div>
          </div>

          <div className="border border-border rounded-xl bg-card/50">
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Event log</p>
              <Badge variant="outline" className="ml-auto text-xs">{visibleEvents.length}</Badge>
            </div>
            <ScrollArea className="h-48">
              <div className="p-3 space-y-1.5">
                {visibleEvents.length === 0 && <p className="text-xs text-muted-foreground italic">No events yet at this point in the timeline</p>}
                {visibleEvents.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground font-mono shrink-0">
                      {new Date(e.recorded_at).toLocaleTimeString().slice(0, 8)}
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{e.event_type}</Badge>
                    {(e.latitude && e.longitude) && (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{e.latitude.toFixed(4)}, {e.longitude.toFixed(4)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Compass,
  Loader2,
  Navigation as NavIcon,
  Radio,
  Signal,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGeolocationTracker, type TrackedPosition } from "@/hooks/useGeolocationTracker";
import {
  bearingDegrees,
  compassPoint,
  distanceMeters,
  logMissionEvent,
  recordTrackPoint,
  type MissionEvent,
  type MissionEventType,
} from "@/lib/pilotMission";
import PilotMapView from "@/components/pilot/PilotMapView";
import MissionChecklist from "@/components/pilot/MissionChecklist";
import QuickLogButtons from "@/components/pilot/QuickLogButtons";
import MissionLogList from "@/components/pilot/MissionLogList";
import BroadcastButton from "@/components/fleet/BroadcastButton";
import type { Drone, Job } from "@/lib/fleet-types";

interface JobWithExtras extends Job {
  drone?: Drone;
}

interface SavedFlightPlan {
  id: string;
  name: string;
  polygon: [number, number][];
  params: { altitude?: number; speed?: number; [key: string]: unknown };
}

export default function PilotCompanion() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [job, setJob] = useState<JobWithExtras | null>(null);
  const [flightPlan, setFlightPlan] = useState<SavedFlightPlan | null>(null);
  const [events, setEvents] = useState<MissionEvent[]>([]);
  const [track, setTrack] = useState<{ latitude: number; longitude: number }[]>([]);
  const [missionStarted, setMissionStarted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Track GPS — write to DB only after mission start
  const handlePosition = useCallback(
    (p: TrackedPosition) => {
      if (!missionStarted || !job || !user) return;
      recordTrackPoint(job.id, user.id, p);
      setTrack((prev) => [...prev, { latitude: p.latitude, longitude: p.longitude }]);
    },
    [missionStarted, job, user],
  );

  const { position, error: gpsError, permission } = useGeolocationTracker({
    enabled: !!job,
    onPosition: handlePosition,
    minIntervalMs: 4000,
  });

  // Fetch job + flight plan
  useEffect(() => {
    if (!jobId || !user) return;

    const load = async () => {
      setLoading(true);
      const { data: jobData } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();

      if (!jobData) {
        toast({ title: "Job not found", variant: "destructive" });
        navigate("/jobs");
        return;
      }

      const { data: droneData } = await supabase
        .from("drones")
        .select("*")
        .eq("id", jobData.drone_id)
        .maybeSingle();

      setJob({ ...(jobData as unknown as Job), drone: droneData as unknown as Drone });

      // Find a flight plan for the same project
      if (jobData.project_id) {
        const { data: planData } = await supabase
          .from("saved_flight_plans")
          .select("id, name, polygon, params")
          .eq("project_id", jobData.project_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (planData) {
          setFlightPlan({
            id: planData.id,
            name: planData.name,
            polygon: planData.polygon as unknown as [number, number][],
            params: planData.params as SavedFlightPlan["params"],
          });
        }
      }

      // Existing events
      const { data: eventData } = await supabase
        .from("mission_logs")
        .select("*")
        .eq("job_id", jobId)
        .order("recorded_at", { ascending: false });
      if (eventData) setEvents(eventData as unknown as MissionEvent[]);

      // Existing track
      const { data: trackData } = await supabase
        .from("pilot_tracks")
        .select("latitude, longitude")
        .eq("job_id", jobId)
        .order("recorded_at", { ascending: true });
      if (trackData) setTrack(trackData);

      setLoading(false);
    };

    load();
  }, [jobId, user, navigate, toast]);

  // Subscribe to live events
  useEffect(() => {
    if (!jobId) return;
    const channel = supabase
      .channel(`mission_logs:${jobId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mission_logs", filter: `job_id=eq.${jobId}` },
        (payload) => {
          const newEvent = payload.new as MissionEvent;
          setEvents((prev) =>
            prev.some((e) => e.id === newEvent.id) ? prev : [newEvent, ...prev],
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  // Compute polygon centroid → use as first "waypoint" indicator
  const targetPoint = useMemo<[number, number] | null>(() => {
    if (!flightPlan?.polygon || flightPlan.polygon.length < 3) return null;
    const lats = flightPlan.polygon.map((p) => p[0]);
    const lngs = flightPlan.polygon.map((p) => p[1]);
    const lat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const lng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    return [lat, lng];
  }, [flightPlan]);

  const distanceToTarget = useMemo(() => {
    if (!position || !targetPoint) return null;
    return distanceMeters(
      { latitude: position.latitude, longitude: position.longitude },
      { latitude: targetPoint[0], longitude: targetPoint[1] },
    );
  }, [position, targetPoint]);

  const bearingToTarget = useMemo(() => {
    if (!position || !targetPoint) return null;
    return bearingDegrees(
      { latitude: position.latitude, longitude: position.longitude },
      { latitude: targetPoint[0], longitude: targetPoint[1] },
    );
  }, [position, targetPoint]);

  const handleQuickLog = useCallback(
    (type: MissionEventType, payload: Record<string, unknown> = {}) => {
      if (!job || !user) return;
      logMissionEvent(job.id, user.id, type, payload, position);
      toast({ title: `Logged: ${type.replace(/_/g, " ")}` });
    },
    [job, user, position, toast],
  );

  const startMission = async () => {
    if (!job || !user) return;
    setMissionStarted(true);
    await logMissionEvent(job.id, user.id, "mission_start", {}, position);
    toast({ title: "🚀 Mission started", description: "GPS tracking is now recording." });
  };

  const endMission = async () => {
    if (!job || !user) return;
    await logMissionEvent(job.id, user.id, "mission_end", {}, position);
    setMissionStarted(false);
    toast({ title: "Mission ended", description: "Track saved." });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (!job) return null;

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Sticky header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border">
        <div className="px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate("/jobs")}
              className="p-1.5 rounded-lg hover:bg-secondary"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display font-700 text-foreground text-sm truncate">
                {job.drone?.name ?? "Drone"} — Pilot view
              </h1>
              <p className="text-[11px] text-muted-foreground capitalize">
                {job.mission_type}
                {flightPlan && ` · ${flightPlan.name}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {permission === "granted" ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-primary">
                <Signal className="w-3 h-3" /> GPS
              </span>
            ) : permission === "denied" ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-destructive">
                <WifiOff className="w-3 h-3" /> No GPS
              </span>
            ) : (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      </header>

      <main className="px-3 py-3 space-y-3">
        {/* GPS error banner */}
        {gpsError && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2">
            {gpsError}
          </div>
        )}

        {/* Plan / View flight path */}
        {job.project_id && (
          <Button
            variant={flightPlan ? "outline" : "default"}
            size="sm"
            onClick={() => navigate(`/viewer/${job.project_id}?mode=plan`)}
            className="w-full gap-2"
          >
            <NavIcon className="w-4 h-4" />
            {flightPlan ? `View / edit "${flightPlan.name}"` : "Plan flight path for this job"}
          </Button>
        )}

        {/* Hero: live map */}
        <PilotMapView
          pilot={position}
          plannedPolygon={flightPlan?.polygon ?? null}
          plannedPath={null}
          flownTrack={track}
          className="h-72"
        />

        {/* Live stats strip */}
        {position && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card border border-border rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                Accuracy
              </p>
              <p className="text-lg font-display font-bold tabular-nums text-foreground">
                ±{Math.round(position.accuracy)}m
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                To target
              </p>
              <p className="text-lg font-display font-bold tabular-nums text-foreground">
                {distanceToTarget !== null ? `${Math.round(distanceToTarget)}m` : "—"}
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                Bearing
              </p>
              <p className="text-lg font-display font-bold tabular-nums text-foreground flex items-center justify-center gap-1">
                {bearingToTarget !== null ? (
                  <>
                    <Compass className="w-4 h-4 text-primary" />
                    {compassPoint(bearingToTarget)}
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>
        )}

        {/* Mission start/end */}
        {!missionStarted ? (
          <Button onClick={startMission} size="lg" className="w-full gap-2 h-14 text-base">
            <NavIcon className="w-5 h-5" />
            Start mission
          </Button>
        ) : (
          <Button
            onClick={endMission}
            size="lg"
            variant="destructive"
            className="w-full gap-2 h-14 text-base"
          >
            End mission
          </Button>
        )}

        {/* Quick log buttons (only after start) */}
        {missionStarted && (
          <>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">
              Quick log
            </h2>
            <QuickLogButtons onLog={handleQuickLog} />
          </>
        )}

        {/* Broadcast */}
        {job.drone && (
          <div className="space-y-1.5 pt-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Radio className="w-3 h-3" /> Share with office
            </h2>
            <BroadcastButton drone={job.drone} compact />
          </div>
        )}

        {/* Pre-flight checklist */}
        {!missionStarted && <MissionChecklist />}

        {/* Recent events */}
        {events.length > 0 && (
          <div className="space-y-1.5 pt-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Mission log
            </h2>
            <MissionLogList events={events.slice(0, 12)} />
          </div>
        )}
      </main>
    </div>
  );
}

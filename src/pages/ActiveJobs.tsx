import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, RefreshCw, Briefcase, Video, Loader2, Clock, StopCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { Drone, Job, JobStatus } from "@/lib/fleet-types";
import CameraFeed from "@/components/fleet/CameraFeed";
import DroneStatusBadge from "@/components/fleet/DroneStatusBadge";
import CreateJobDialog from "@/components/fleet/CreateJobDialog";

interface JobRow extends Job {
  drone_name?: string;
  drone_status?: string;
  drone_battery?: number;
  drone_stream_url?: string | null;
  pilot_name?: string;
  project_name?: string;
  drone?: Drone;
}

function formatDuration(start: string): string {
  const ms = Date.now() - new Date(start).getTime();
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

export default function ActiveJobs() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [tab, setTab] = useState<"active" | "history">("active");

  const fetchData = useCallback(async () => {
    // Fetch drones
    const { data: droneData } = await supabase.from("drones").select("*").order("name");
    const droneList = (droneData || []) as unknown as Drone[];
    setDrones(droneList);

    // Fetch jobs with related data
    const { data: jobData } = await supabase
      .from("jobs")
      .select("*")
      .order("started_at", { ascending: false });

    if (jobData) {
      // Enrich jobs with drone info
      const enriched: JobRow[] = (jobData as unknown as Job[]).map(job => {
        const drone = droneList.find(d => d.id === job.drone_id);
        return {
          ...job,
          drone,
          drone_name: drone?.name,
          drone_status: drone?.status,
          drone_battery: drone?.battery_level,
          drone_stream_url: drone?.stream_url,
        };
      });
      setJobs(enriched);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchData();

    // Realtime for jobs
    const channel = supabase
      .channel("jobs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "drones" }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchData]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const completeJob = async (job: JobRow) => {
    try {
      await supabase.from("jobs").update({ status: "completed" as any, ended_at: new Date().toISOString() }).eq("id", job.id);
      if (job.drone_id) {
        await supabase.from("drones").update({ status: "idle" as any }).eq("id", job.drone_id);
      }
      toast({ title: "Job completed", description: `Mission ended successfully.` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const abortJob = async (job: JobRow) => {
    try {
      await supabase.from("jobs").update({ status: "aborted" as any, ended_at: new Date().toISOString() }).eq("id", job.id);
      if (job.drone_id) {
        await supabase.from("drones").update({ status: "idle" as any }).eq("id", job.drone_id);
      }
      toast({ title: "Job aborted", description: "Mission has been stopped." });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const activeJobs = jobs.filter(j => j.status === "active");
  const historyJobs = jobs.filter(j => j.status !== "active");

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/dashboard")} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Briefcase className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-700 text-foreground text-sm">Active Jobs</h1>
              <p className="text-xs text-muted-foreground">{activeJobs.length} active · {historyJobs.length} completed</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowCreateJob(true)} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> New Job
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Multi-camera grid for active jobs */}
        {activeJobs.length > 0 && activeJobs.some(j => j.drone_stream_url) && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" /> Live Camera Feeds
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {activeJobs.filter(j => j.drone).map(job => (
                <div key={job.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{job.drone_name}</span>
                    <span className="text-muted-foreground capitalize">{job.mission_type}</span>
                  </div>
                  <CameraFeed drone={job.drone!} />
                </div>
              ))}
            </div>
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "history")}>
          <TabsList>
            <TabsTrigger value="active" className="gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Active ({activeJobs.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> History ({historyJobs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3 mt-4">
            {activeJobs.length === 0 ? (
              <div className="text-center py-16">
                <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No active jobs</p>
                {isAdmin && <p className="text-xs text-muted-foreground/60 mt-1">Click "New Job" to deploy a drone</p>}
              </div>
            ) : (
              activeJobs.map(job => (
                <div key={job.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-700 text-foreground text-sm">{job.drone_name || "Unknown Drone"}</h3>
                        {job.drone && <DroneStatusBadge status={job.drone.status} />}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 capitalize">
                          {job.mission_type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Running for {formatDuration(job.started_at)}
                        {job.notes && ` · ${job.notes}`}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="outline" onClick={() => completeJob(job)} className="gap-1 text-xs">
                        <CheckCircle className="w-3 h-3" /> Complete
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => abortJob(job)} className="gap-1 text-xs">
                        <StopCircle className="w-3 h-3" /> Abort
                      </Button>
                    </div>
                  </div>

                  {/* Telemetry strip */}
                  {job.drone && (
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>🔋 {job.drone.battery_level}%</span>
                      <span>📏 {job.drone.altitude}m alt</span>
                      <span>💨 {job.drone.speed.toFixed(1)} m/s</span>
                      <span>🧭 {job.drone.heading}°</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-4">
            {historyJobs.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-sm">No job history yet</p>
              </div>
            ) : (
              historyJobs.map(job => (
                <div key={job.id} className="bg-card border border-border rounded-xl p-4 opacity-75">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground text-sm">{job.drone_name || "Unknown"}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          job.status === "completed"
                            ? "bg-primary/10 text-primary"
                            : "bg-destructive/10 text-destructive"
                        }`}>
                          {job.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground capitalize">{job.mission_type}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(job.started_at).toLocaleDateString()} · {job.ended_at ? formatDuration(job.started_at) : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <CreateJobDialog
        open={showCreateJob}
        onOpenChange={setShowCreateJob}
        drones={drones}
        onCreated={fetchData}
      />
    </div>
  );
}

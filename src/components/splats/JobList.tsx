import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SplatJob {
  id: string;
  preset: string;
  status: "queued" | "training" | "ready" | "failed";
  iterations: number;
  image_count: number | null;
  psnr: number | null;
  training_seconds: number | null;
  error: string | null;
  created_at: string;
}

interface Props {
  projectId: string;
  refreshKey: number;
}

export function JobList({ projectId, refreshKey }: Props) {
  const [jobs, setJobs] = useState<SplatJob[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchJobs = async () => {
      if (!projectId) { setJobs([]); return; }
      const { data } = await supabase
        .from("splat_jobs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (!cancelled) setJobs((data ?? []) as SplatJob[]);
    };

    fetchJobs();
    timer = setInterval(fetchJobs, 4000);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [projectId, refreshKey]);

  if (!projectId || jobs.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic">
        No training jobs yet. Click "Train new scene" to start one.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((j) => (
        <div key={j.id} className="rounded-lg border border-border bg-card/60 p-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <StatusIcon status={j.status} />
              <span className="font-medium capitalize">{j.preset}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{j.iterations.toLocaleString()} iter</span>
              {j.image_count != null && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{j.image_count} imgs</span>
                </>
              )}
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${chipClass(j.status)}`}>
              {j.status}
            </span>
          </div>
          {(j.psnr || j.training_seconds) && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              {j.psnr && <>PSNR {j.psnr.toFixed(2)} dB</>}
              {j.psnr && j.training_seconds ? " · " : ""}
              {j.training_seconds && <>{Math.round(j.training_seconds / 60)} min</>}
            </div>
          )}
          {j.error && (
            <div className="mt-1 text-[10px] text-destructive break-words">{j.error}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: SplatJob["status"] }) {
  if (status === "ready") return <CheckCircle2 className="w-3.5 h-3.5 text-primary" />;
  if (status === "failed") return <XCircle className="w-3.5 h-3.5 text-destructive" />;
  if (status === "training") return <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />;
  return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
}

function chipClass(status: SplatJob["status"]): string {
  switch (status) {
    case "ready": return "bg-primary/15 text-primary";
    case "failed": return "bg-destructive/15 text-destructive";
    case "training": return "bg-amber-500/15 text-amber-400";
    default: return "bg-muted text-muted-foreground";
  }
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2, Clock, Loader2, XCircle, Zap, Coins, Timer, FileBox, RefreshCw, Link2, Cpu, Images,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface SplatJob {
  id: string;
  preset: string;
  status: "queued" | "training" | "ready" | "failed";
  iterations: number;
  image_count: number | null;
  psnr: number | null;
  training_seconds: number | null;
  error: string | null;
  output_path: string | null;
  source?: "photos" | "video" | null;
  provider?: string | null;
  provider_prediction_id?: string | null;
  provider_output_url?: string | null;
  updated_at?: string | null;
  created_at: string;
}

interface Props {
  projectId: string;
  refreshKey: number;
  onSceneReady?: () => void;
}

/** Tunable per-1k-iteration cost in cents. Drives the cost estimator chip. */
const COST_CENTS_PER_1K_ITER = 6;
/** Median iterations-per-second on shared training infra (empirical). */
const ITER_PER_SECOND = 28;

function estimateCostCents(j: { iterations: number; image_count: number | null }): number {
  const imgs = Math.max(1, j.image_count ?? 50);
  const factor = Math.max(0.5, Math.log2(imgs / 50));
  return Math.round((j.iterations / 1000) * COST_CENTS_PER_1K_ITER * factor);
}

function formatCents(c: number): string {
  if (c < 100) return `${c}¢`;
  return `$${(c / 100).toFixed(2)}`;
}

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

export function JobList({ projectId, refreshKey, onSceneReady }: Props) {
  const [jobs, setJobs] = useState<SplatJob[]>([]);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [tick, setTick] = useState(0);
  const fetchRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchJobs = async () => {
      if (!projectId) { setJobs([]); return; }
      if (!cancelled) setSyncing(true);
      const { data } = await supabase
        .from("splat_jobs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (!cancelled) {
        setJobs((data ?? []) as SplatJob[]);
        setLastSync(Date.now());
        setSyncing(false);
      }
    };

    fetchRef.current = fetchJobs;
    fetchJobs();
    timer = setInterval(fetchJobs, 3000);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [projectId, refreshKey]);

  // Drives elapsed-time / "updated Xs ago" readouts without refetching.
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!projectId || jobs.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic">
        No training jobs yet. Click "Train new scene" to start one.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <QueueSummary
        jobs={jobs}
        lastSync={lastSync}
        syncing={syncing}
        tick={tick}
        onRefresh={() => fetchRef.current()}
      />
      {jobs.map((j) => {
        const cost = estimateCostCents(j);
        const startedMs = new Date(j.created_at).getTime();
        const elapsedS = (Date.now() - startedMs) / 1000;
        const totalEstS = j.iterations / ITER_PER_SECOND;
        const remainingS = j.status === "training" ? Math.max(0, totalEstS - elapsedS) : null;
        const progressPct = j.status === "training"
          ? Math.min(99, Math.round((elapsedS / Math.max(1, totalEstS)) * 100))
          : j.status === "ready" ? 100 : 0;
        return (
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
          {j.status === "training" && (
            <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-amber-400 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          )}
          {(j.status === "queued" || j.status === "training") && <StageTrack job={j} />}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Coins className="w-3 h-3" /> {formatCents(cost)} est.</span>
            {j.status === "training" && remainingS != null && (
              <span className="inline-flex items-center gap-1"><Timer className="w-3 h-3" /> ~{formatSeconds(remainingS)} left</span>
            )}
            {j.status === "queued" && (
              <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3" /> ETA ~{formatSeconds(totalEstS)}</span>
            )}
            {(j.status === "queued" || j.status === "training") && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatSeconds(elapsedS)} elapsed
              </span>
            )}
          </div>
          {(j.psnr || j.training_seconds) && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              {j.psnr && <>PSNR {j.psnr.toFixed(2)} dB</>}
              {j.psnr && j.training_seconds ? " · " : ""}
              {j.training_seconds && <>{Math.round(j.training_seconds / 60)} min</>}
            </div>
          )}
          {j.status === "ready" && j.output_path && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-primary/25 bg-primary/5 p-2">
              <span className="inline-flex min-w-0 items-center gap-1 text-[10px] text-primary">
                <FileBox className="h-3 w-3 shrink-0" />
                <span className="truncate">3D splat file created</span>
              </span>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={onSceneReady}>
                Load scene
              </Button>
            </div>
          )}
          {j.error && (
            <div className="mt-1 text-[10px] text-destructive break-words">{j.error}</div>
          )}
        </div>
        );
      })}
    </div>
  );
}

function StageTrack({ job }: { job: SplatJob }) {
  const hasPrediction = Boolean(job.provider_prediction_id);
  const hasOutput = Boolean(job.provider_output_url || job.output_path);
  const framesDone = (job.image_count ?? 0) > 0;

  const steps: { label: string; icon: typeof Images; state: "done" | "active" | "pending" }[] = [
    {
      label: framesDone ? `Frames received (${job.image_count})` : "Receiving frames",
      icon: Images,
      state: framesDone ? "done" : "active",
    },
    {
      label: hasPrediction ? "Signed URLs generated" : "Generating signed URLs",
      icon: Link2,
      state: hasPrediction ? "done" : framesDone ? "active" : "pending",
    },
    {
      label: job.status === "training" ? "Training in progress" : "Training queued",
      icon: Cpu,
      state: job.status === "training" ? "active" : hasPrediction ? "active" : "pending",
    },
    {
      label: hasOutput ? "Splat file written" : "Awaiting splat file",
      icon: FileBox,
      state: hasOutput ? "done" : "pending",
    },
  ];

  return (
    <ol className="mt-2 space-y-1">
      {steps.map((s) => (
        <li
          key={s.label}
          className={`flex items-center gap-1.5 text-[10px] ${
            s.state === "done"
              ? "text-primary"
              : s.state === "active"
                ? "text-amber-400"
                : "text-muted-foreground/60"
          }`}
        >
          {s.state === "done" ? (
            <CheckCircle2 className="w-3 h-3 shrink-0" />
          ) : s.state === "active" ? (
            <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
          ) : (
            <s.icon className="w-3 h-3 shrink-0" />
          )}
          <span>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function QueueSummary({
  jobs, lastSync, syncing, tick, onRefresh,
}: {
  jobs: SplatJob[];
  lastSync: number | null;
  syncing: boolean;
  tick: number;
  onRefresh: () => void;
}) {
  const stats = useMemo(() => {
    const queued = jobs.filter((j) => j.status === "queued").length;
    const training = jobs.filter((j) => j.status === "training").length;
    const ready = jobs.filter((j) => j.status === "ready").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    const totalCost = jobs
      .filter((j) => j.status === "ready" || j.status === "training")
      .reduce((acc, j) => acc + estimateCostCents(j), 0);
    return { queued, training, ready, failed, totalCost };
  }, [jobs]);
  const agoS = lastSync ? Math.max(0, Math.round((Date.now() - lastSync) / 1000)) : null;
  void tick;
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-wider font-semibold">
      {stats.training > 0 && <span className="text-amber-500">{stats.training} training</span>}
      {stats.queued > 0 && <span className="text-muted-foreground">{stats.queued} queued</span>}
      {stats.ready > 0 && <span className="text-primary">{stats.ready} ready</span>}
      {stats.failed > 0 && <span className="text-destructive">{stats.failed} failed</span>}
      <span className="ml-auto text-muted-foreground normal-case">
        {formatCents(stats.totalCost)} session spend
      </span>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center gap-1 normal-case text-muted-foreground hover:text-foreground transition-colors"
        title="Refresh job status"
      >
        <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
        {agoS == null ? "syncing…" : agoS < 2 ? "live" : `${agoS}s ago`}
      </button>
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

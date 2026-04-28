import { forwardRef, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Layers,
  Grid3X3,
  Mountain,
  Map as MapIcon,
  Package,
  Image as ImageIcon,
  Ruler,
  XCircle,
  Terminal,
  Clock,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  PIPELINE_STAGES,
  type StageKey,
  type StageLogEntry,
  formatDurationShort,
  stageForProgress,
} from "@/lib/photogrammetry";

const STAGE_ICON: Record<StageKey, any> = {
  alignment: Layers,
  pointcloud: Grid3X3,
  mesh: Mountain,
  texture: ImageIcon,
  ortho: MapIcon,
  dem: Ruler,
  export: Package,
};

export interface LiveProject {
  id: string;
  status: string;
  progress: number;
  current_stage: string | null;
  stage_progress: number | null;
  stage_started_at: string | null;
  eta_seconds: number | null;
  stage_log: StageLogEntry[] | null;
  outputs_urls?: Record<string, any> | null;
}

export interface LivePipelineProps {
  projectId: string;
  initial: LiveProject;
  canCancel?: boolean;
  onCancel?: () => void;
  cancelling?: boolean;
}

export const LivePipeline = forwardRef<HTMLDivElement, LivePipelineProps>(
  function LivePipeline({ projectId, initial, canCancel, onCancel, cancelling }, ref) {
    const [data, setData] = useState<LiveProject>(initial);
    const [now, setNow] = useState(Date.now());
    const [showLog, setShowLog] = useState(false);

    useEffect(() => setData(initial), [initial.id]);

    useEffect(() => {
      const ch = supabase
        .channel(`pipeline:${projectId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${projectId}` },
          (payload) => setData(payload.new as LiveProject)
        )
        .subscribe();
      return () => {
        supabase.removeChannel(ch);
      };
    }, [projectId]);

    useEffect(() => {
      const t = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(t);
    }, []);

    const isProcessing = data.status === "processing";
    const isComplete = data.status === "complete";
    const isFailed = data.status === "failed";
    const overallProgress = data.progress ?? 0;
    const activeStage =
      (data.current_stage as StageKey | null) || stageForProgress(overallProgress);

    const stageElapsed = useMemo(() => {
      if (!data.stage_started_at || !isProcessing) return null;
      return now - new Date(data.stage_started_at).getTime();
    }, [data.stage_started_at, now, isProcessing]);

    const recentLog = (data.stage_log || []).slice(-50);

    return (
      <div ref={ref} className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-700 text-foreground flex items-center gap-2 text-base">
            <Loader2 className={`w-4 h-4 text-primary ${isProcessing ? "animate-spin" : ""}`} />
            Reconstruction Pipeline
          </h2>
          <div className="flex items-center gap-2">
            {isProcessing && (
              <span className="text-xs font-semibold text-accent">{overallProgress}%</span>
            )}
            {isComplete && (
              <span className="text-xs font-semibold text-primary flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Complete
              </span>
            )}
            {isFailed && (
              <span className="text-xs font-semibold text-destructive flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Failed
              </span>
            )}
            {isProcessing && canCancel && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={onCancel}
                disabled={cancelling}
              >
                <Square className="w-3 h-3" />
                {cancelling ? "Cancelling…" : "Cancel"}
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-gradient-to-r from-primary/5 to-accent/5 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {isProcessing && data.eta_seconds != null && data.eta_seconds > 0 ? (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> ETA {formatDurationShort(data.eta_seconds * 1000)}
                </span>
              ) : isComplete ? (
                "All stages finished"
              ) : isFailed ? (
                "Pipeline halted"
              ) : (
                "Queued"
              )}
            </span>
            <span className="font-mono text-lg font-bold text-primary">{overallProgress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isComplete ? "bg-primary" : isFailed ? "bg-destructive" : "bg-accent"
              }`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          {PIPELINE_STAGES.map((stage) => {
            const Icon = STAGE_ICON[stage.key];
            const finished = overallProgress >= stage.to || isComplete;
            const active = isProcessing && activeStage === stage.key;
            const errored = isFailed && activeStage === stage.key;
            const stagePct = active
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    data.stage_progress ??
                      Math.round(
                        ((overallProgress - stage.from) / Math.max(1, stage.to - stage.from)) * 100
                      )
                  )
                )
              : finished
              ? 100
              : 0;
            return (
              <div
                key={stage.key}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  errored
                    ? "bg-destructive/10 border-destructive/20"
                    : active
                    ? "bg-accent/10 border-accent/20"
                    : finished
                    ? "bg-primary/5 border-primary/10"
                    : "bg-muted/30 border-transparent"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    errored
                      ? "bg-destructive text-destructive-foreground"
                      : finished
                      ? "bg-primary text-primary-foreground"
                      : active
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {errored ? (
                    <XCircle className="w-4 h-4" />
                  ) : finished ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : active ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-sm font-semibold ${
                        errored
                          ? "text-destructive"
                          : finished
                          ? "text-primary"
                          : active
                          ? "text-accent"
                          : "text-muted-foreground"
                      }`}
                    >
                      {stage.label}
                    </p>
                    {active && stageElapsed != null && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {formatDurationShort(stageElapsed)}
                      </span>
                    )}
                    {finished && !active && (
                      <span className="text-[10px] font-semibold text-primary">Done</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{stage.desc}</p>
                  {(active || (finished && stagePct < 100)) && (
                    <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          errored ? "bg-destructive" : active ? "bg-accent" : "bg-primary"
                        }`}
                        style={{ width: `${stagePct}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {recentLog.length > 0 && (
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowLog((v) => !v)}
              className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3 h-3" />
                Pipeline log ({recentLog.length})
              </span>
              <span className="text-[10px]">{showLog ? "Hide" : "Show"}</span>
            </button>
            {showLog && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-muted/40 border border-border/60 font-mono text-[11px] leading-relaxed p-2 space-y-0.5">
                {recentLog.map((entry, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${
                      entry.level === "error"
                        ? "text-destructive"
                        : entry.level === "warn"
                        ? "text-accent"
                        : "text-foreground/80"
                    }`}
                  >
                    <span className="text-muted-foreground flex-shrink-0">
                      {new Date(entry.ts).toLocaleTimeString()}
                    </span>
                    <span className="text-muted-foreground flex-shrink-0">[{entry.stage}]</span>
                    <span className="break-all">{entry.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isFailed && data.outputs_urls?.error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
            {data.outputs_urls.error === "canceled" ? "Cancelled by user." : `Error: ${data.outputs_urls.error}`}
          </div>
        )}
      </div>
    );
  }
);
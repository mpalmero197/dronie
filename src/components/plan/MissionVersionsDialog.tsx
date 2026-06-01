import { useEffect, useState } from "react";
import { History, RotateCcw, Loader2, Calendar } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Version {
  id: string;
  plan_id: string;
  name: string;
  polygon: unknown;
  home_position: unknown;
  params: Record<string, unknown>;
  version_number: number;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string | null;
  planName: string;
  onRestored?: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

export default function MissionVersionsDialog({ open, onOpenChange, planId, planName, onRestored }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !planId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("mission_versions")
        .select("*")
        .eq("plan_id", planId)
        .order("version_number", { ascending: false });
      if (!cancelled) {
        if (error) toast({ title: "Failed to load history", description: error.message, variant: "destructive" });
        setVersions(((data ?? []) as unknown) as Version[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, planId, toast]);

  const restore = async (v: Version) => {
    if (!planId) return;
    if (!confirm(`Restore version ${v.version_number}? The current state will be saved as a new version first.`)) return;
    setRestoringId(v.id);
    const { error } = await supabase
      .from("saved_flight_plans")
      .update({
        name: v.name,
        polygon: v.polygon as any,
        home_position: v.home_position as any,
        params: v.params as any,
      })
      .eq("id", planId);
    setRestoringId(null);
    if (error) {
      toast({ title: "Restore failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Restored version ${v.version_number}` });
    onRestored?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" /> Version history
          </DialogTitle>
          <DialogDescription className="truncate">{planName}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No previous versions yet. Edits to this mission will be snapshotted here automatically.
          </div>
        ) : (
          <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {versions.map((v) => {
              const p = v.params as any;
              const vertices = Array.isArray(v.polygon) ? (v.polygon as unknown[]).length : 0;
              return (
                <li
                  key={v.id}
                  className="rounded-lg border border-border bg-card p-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">v{v.version_number}</span>
                      <span className="text-[11px] text-muted-foreground truncate">{v.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Calendar className="w-3 h-3" /> {timeAgo(v.created_at)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {vertices} vertices · {p?.altitude ?? "?"}m alt · {p?.frontOverlap ?? "?"}/{p?.sideOverlap ?? "?"}% overlap
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restore(v)}
                    disabled={restoringId === v.id}
                    className="gap-1.5 h-8"
                  >
                    {restoringId === v.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <RotateCcw className="w-3 h-3" />}
                    Restore
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
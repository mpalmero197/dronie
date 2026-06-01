import { useEffect, useState } from "react";
import { Wrench, AlertTriangle, CheckCircle2, Loader2, Calendar, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Drone } from "@/lib/fleet-types";

interface MaintItem {
  id: string;
  drone_id: string;
  task: string;
  due_date: string;
  cycles_left: number;
  health_pct: number;
  status: string;
}

interface Props {
  drones: Drone[];
}

export default function MaintenancePanel({ drones }: Props) {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<MaintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const droneMap = new Map(drones.map((d) => [d.id, d]));

  const load = async () => {
    const { data, error } = await supabase
      .from("drone_maintenance")
      .select("id, drone_id, task, due_date, cycles_left, health_pct, status")
      .order("due_date", { ascending: true });
    if (!error && data) setItems(data as MaintItem[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("drone_maintenance-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "drone_maintenance" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    const { error } = await supabase.from("drone_maintenance").update({ status }).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else toast({ title: `Marked ${status}` });
    setUpdatingId(null);
  };

  const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

  const urgency = (item: MaintItem) => {
    const days = daysUntil(item.due_date);
    if (item.health_pct < 30 || days < 0 || item.cycles_left <= 5) return "critical";
    if (item.health_pct < 60 || days < 7 || item.cycles_left <= 20) return "warn";
    return "ok";
  };

  if (loading) {
    return <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const open = items.filter((i) => i.status !== "done");
  const done = items.filter((i) => i.status === "done").slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Open tasks" value={open.length} icon={<Wrench className="w-4 h-4" />} />
        <StatCard label="Critical" value={open.filter((i) => urgency(i) === "critical").length} icon={<AlertTriangle className="w-4 h-4" />} tone="critical" />
        <StatCard label="Drones flagged" value={new Set(open.map((i) => i.drone_id)).size} icon={<Activity className="w-4 h-4" />} />
      </div>

      {open.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-xl bg-card/50">
          <CheckCircle2 className="w-12 h-12 text-primary/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">All maintenance up to date</p>
        </div>
      ) : (
        <div className="space-y-2">
          {open.map((item) => {
            const drone = droneMap.get(item.drone_id);
            const u = urgency(item);
            const days = daysUntil(item.due_date);
            return (
              <div key={item.id} className="border border-border rounded-xl p-4 bg-card/50">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-foreground text-sm truncate">{item.task}</p>
                      <Badge
                        variant={u === "critical" ? "destructive" : "outline"}
                        className={u === "warn" ? "border-amber-500/40 text-amber-600 dark:text-amber-400" : ""}
                      >
                        {u === "critical" ? "Critical" : u === "warn" ? "Soon" : "Scheduled"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{drone?.name ?? "Unknown drone"} · {drone?.model ?? ""}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1.5">
                      {item.status === "open" && (
                        <Button variant="outline" size="sm" disabled={updatingId === item.id} onClick={() => updateStatus(item.id, "in_progress")}>
                          Start
                        </Button>
                      )}
                      <Button variant="default" size="sm" disabled={updatingId === item.id} onClick={() => updateStatus(item.id, "done")}>
                        Mark done
                      </Button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Calendar className="w-3 h-3" /> Due
                    </div>
                    <p className={`font-mono ${days < 0 ? "text-destructive" : days < 7 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`}
                    </p>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Cycles left</div>
                    <p className={`font-mono ${item.cycles_left <= 5 ? "text-destructive" : "text-foreground"}`}>
                      {item.cycles_left}
                    </p>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Health {item.health_pct}%</div>
                    <Progress value={item.health_pct} className="h-1.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <div className="pt-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Recently completed</p>
          <div className="space-y-1">
            {done.map((d) => (
              <div key={d.id} className="text-xs text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-primary" />
                <span>{d.task}</span>
                <span>· {droneMap.get(d.drone_id)?.name ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone?: "critical" }) {
  return (
    <div className={`border rounded-xl p-3 bg-card/50 ${tone === "critical" && value > 0 ? "border-destructive/40" : "border-border"}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon} {label}
      </div>
      <p className={`text-2xl font-bold ${tone === "critical" && value > 0 ? "text-destructive" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
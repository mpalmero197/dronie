import { useEffect, useState } from "react";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { sendDroneCommand } from "@/lib/droneCommands";
import type { Drone } from "@/lib/fleet-types";

interface Pilot {
  user_id: string;
  display_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  drone: Drone | null;
}

export default function HandoffDialog({ open, onOpenChange, drone }: Props) {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [targetId, setTargetId] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("pilot_profiles")
        .select("user_id, display_name")
        .eq("available", true)
        .order("display_name");
      setPilots(((data as Pilot[]) ?? []).filter((p) => p.user_id !== drone?.assigned_pilot_id));
    })();
  }, [open, drone?.assigned_pilot_id]);

  const submit = async () => {
    if (!drone || !targetId || !user) return;
    setSubmitting(true);
    try {
      // 1. Queue a handoff command for the receiving pilot to confirm
      await sendDroneCommand(drone.id, "set_home", { handoff_to: targetId, note });

      // 2. Reassign drone (admin-only via RLS; non-admins notify instead)
      if (isAdmin) {
        const { error } = await supabase
          .from("drones")
          .update({ assigned_pilot_id: targetId })
          .eq("id", drone.id);
        if (error) throw error;
      }

      // 3. Notify receiving pilot
      await supabase.from("notifications").insert({
        user_id: targetId,
        kind: "info",
        title: `Control of ${drone.name} transferred to you`,
        body: note || "Please confirm and assume control from the fleet console.",
        link: "/fleet",
        metadata: { drone_id: drone.id, from_pilot: user.id },
      });

      toast({ title: "Handoff initiated", description: `${drone.name} → new pilot` });
      onOpenChange(false);
      setTargetId("");
      setNote("");
    } catch (err: any) {
      toast({ title: "Handoff failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" /> Transfer control
          </DialogTitle>
          <DialogDescription>
            Hand off <strong>{drone?.name}</strong> mid-flight. The receiving pilot must confirm before assuming command.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Receiving pilot</label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger><SelectValue placeholder="Select a pilot" /></SelectTrigger>
              <SelectContent>
                {pilots.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No other available pilots</div>}
                {pilots.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Note (optional)</label>
            <Textarea
              placeholder="Battery at 42%. Continue NE perimeter sweep, RTH at 25%."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">
              Only admins can reassign the drone record. This will send a handoff request and notification.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={!targetId || submitting}>
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />}
            Initiate handoff
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
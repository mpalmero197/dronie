import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { Drone } from "@/lib/fleet-types";

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drones: Drone[];
  onCreated: () => void;
}

export default function CreateJobDialog({ open, onOpenChange, drones, onCreated }: CreateJobDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pilots, setPilots] = useState<{ id: string; full_name: string | null }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    drone_id: "",
    pilot_id: "",
    project_id: "",
    mission_type: "survey",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    // Fetch pilots (users with pilot or admin role)
    supabase.from("user_roles").select("user_id").in("role", ["pilot", "admin"]).then(({ data }) => {
      if (!data) return;
      const ids = [...new Set(data.map(r => r.user_id))];
      supabase.from("profiles").select("id, full_name").in("id", ids).then(({ data: profiles }) => {
        if (profiles) setPilots(profiles);
      });
    });
    // Fetch projects
    supabase.from("projects").select("id, name").then(({ data }) => {
      if (data) setProjects(data);
    });
  }, [open]);

  const availableDrones = drones.filter(d => d.status === "idle" || d.status === "active");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.drone_id || !form.pilot_id) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("jobs").insert({
        drone_id: form.drone_id,
        pilot_id: form.pilot_id,
        project_id: form.project_id || null,
        mission_type: form.mission_type,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;

      // Set drone to active
      await supabase.from("drones").update({ status: "active" as any }).eq("id", form.drone_id);

      toast({ title: "Job created", description: "Mission is now active." });
      setForm({ drone_id: "", pilot_id: "", project_id: "", mission_type: "survey", notes: "" });
      onCreated();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Drone *</Label>
            <Select value={form.drone_id} onValueChange={(v) => setForm(f => ({ ...f, drone_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select drone" /></SelectTrigger>
              <SelectContent>
                {availableDrones.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name} ({d.status})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pilot *</Label>
            <Select value={form.pilot_id} onValueChange={(v) => setForm(f => ({ ...f, pilot_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select pilot" /></SelectTrigger>
              <SelectContent>
                {pilots.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || "Unnamed Pilot"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Project (optional)</Label>
            <Select value={form.project_id} onValueChange={(v) => setForm(f => ({ ...f, project_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Link to project" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Mission Type</Label>
            <Select value={form.mission_type} onValueChange={(v) => setForm(f => ({ ...f, mission_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="survey">Survey</SelectItem>
                <SelectItem value="inspection">Inspection</SelectItem>
                <SelectItem value="mapping">Mapping</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="monitoring">Monitoring</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Mission notes…" rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.drone_id || !form.pilot_id}>
              {loading ? "Creating…" : "Launch Job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

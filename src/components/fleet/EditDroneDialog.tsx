import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import StreamSourcePicker, { type StreamMode } from "./StreamSourcePicker";
import type { Drone, DroneStatus } from "@/lib/fleet-types";

interface EditDroneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drone: Drone | null;
  onSaved: () => void;
}

export default function EditDroneDialog({ open, onOpenChange, drone, onSaved }: EditDroneDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", model: "", serial_number: "", status: "idle" as DroneStatus });
  const [stream, setStream] = useState<{ mode: StreamMode; url?: string; demoPath?: string }>({ mode: "webrtc" });

  useEffect(() => {
    if (drone) {
      setForm({
        name: drone.name,
        model: drone.model || "",
        serial_number: drone.serial_number || "",
        status: drone.status,
      });
      setStream({
        mode: (drone.stream_mode || "none") as StreamMode,
        url: drone.stream_url ?? undefined,
        demoPath: drone.stream_demo_path ?? undefined,
      });
    }
  }, [drone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drone || !form.name.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("drones")
        .update({
          name: form.name.trim(),
          model: form.model.trim(),
          serial_number: form.serial_number.trim(),
          status: form.status,
          stream_mode: stream.mode,
          stream_url: stream.mode === "url" || stream.mode === "upload" ? (stream.url || null) : null,
          stream_demo_path: stream.mode === "upload" ? (stream.demoPath || null) : null,
        })
        .eq("id", drone.id);
      if (error) throw error;
      toast({ title: "Drone updated", description: form.name });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Drone</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Name *</Label>
            <Input id="edit-name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="edit-model">Model</Label>
            <Input id="edit-model" value={form.model} onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="edit-serial">Serial Number</Label>
            <Input id="edit-serial" value={form.serial_number} onChange={(e) => setForm(f => ({ ...f, serial_number: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="edit-status">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as DroneStatus }))}>
              <SelectTrigger id="edit-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="idle">Idle</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <StreamSourcePicker value={stream} onChange={setStream} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.name.trim()}>
              {loading ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import StreamSourcePicker, { type StreamMode } from "./StreamSourcePicker";

interface AddDroneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

export default function AddDroneDialog({ open, onOpenChange, onAdded }: AddDroneDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    model: "",
    serial_number: "",
  });
  const [stream, setStream] = useState<{ mode: StreamMode; url?: string; demoPath?: string }>({
    mode: "webrtc",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("drones").insert({
        name: form.name.trim(),
        model: form.model.trim(),
        serial_number: form.serial_number.trim(),
        stream_mode: stream.mode,
        stream_url: stream.mode === "url" ? (stream.url || null) : stream.mode === "upload" ? (stream.url || null) : null,
        stream_demo_path: stream.mode === "upload" ? (stream.demoPath || null) : null,
      });
      if (error) throw error;
      toast({ title: "Drone added", description: `${form.name} has been registered.` });
      setForm({ name: "", model: "", serial_number: "" });
      setStream({ mode: "webrtc" });
      onAdded();
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
          <DialogTitle>Register New Drone</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="drone-name">Name *</Label>
            <Input id="drone-name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Mavic 3 Enterprise" />
          </div>
          <div>
            <Label htmlFor="drone-model">Model</Label>
            <Input id="drone-model" value={form.model} onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))} placeholder="e.g. DJI Mavic 3E" />
          </div>
          <div>
            <Label htmlFor="drone-serial">Serial Number</Label>
            <Input id="drone-serial" value={form.serial_number} onChange={(e) => setForm(f => ({ ...f, serial_number: e.target.value }))} placeholder="e.g. 1ZNBJ1234567" />
          </div>

          <StreamSourcePicker value={stream} onChange={setStream} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.name.trim()}>
              {loading ? "Adding…" : "Add Drone"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

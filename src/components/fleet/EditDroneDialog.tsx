import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import StreamSourcePicker, { type StreamMode } from "./StreamSourcePicker";
import SerialNumberField from "./SerialNumberField";
import { DRONE_CATALOG, getModelsFor, parseEquipmentString, formatDroneLabel } from "@/lib/drone-catalog";
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
  const [form, setForm] = useState({ name: "", serial_number: "", status: "idle" as DroneStatus });
  const [manufacturer, setManufacturer] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [serialDuplicate, setSerialDuplicate] = useState(false);
  const [stream, setStream] = useState<{ mode: StreamMode; url?: string; demoPath?: string }>({ mode: "webrtc" });

  useEffect(() => {
    if (drone) {
      const parsed = drone.model ? parseEquipmentString(drone.model) : null;
      setManufacturer(parsed?.manufacturer ?? "");
      setModel(parsed?.model ?? "");
      setForm({
        name: drone.name,
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

  const availableModels = manufacturer ? getModelsFor(manufacturer) : [];
  const fullModelLabel = manufacturer && model ? formatDroneLabel(manufacturer, model) : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drone || !form.name.trim()) return;
    if (serialDuplicate) {
      toast({
        title: "Duplicate serial number",
        description: "This serial is already on another drone in your fleet.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("drones")
        .update({
          name: form.name.trim(),
          model: fullModelLabel,
          serial_number: form.serial_number.trim(),
          status: form.status,
          stream_mode: stream.mode,
          stream_url: stream.mode === "url" || stream.mode === "upload" ? (stream.url || null) : null,
          stream_demo_path: stream.mode === "upload" ? (stream.demoPath || null) : null,
        })
        .eq("id", drone.id);
      if (error) {
        if (error.code === "23505") {
          throw new Error("A drone with that serial number is already in your fleet.");
        }
        throw error;
      }
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
            <Input id="edit-name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} maxLength={80} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-mfr">Manufacturer</Label>
              <Select value={manufacturer} onValueChange={(v) => { setManufacturer(v); setModel(""); }}>
                <SelectTrigger id="edit-mfr"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {DRONE_CATALOG.map((m) => (
                    <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-model">Model</Label>
              <Select value={model} onValueChange={setModel} disabled={!manufacturer}>
                <SelectTrigger id="edit-model">
                  <SelectValue placeholder={manufacturer ? "Select…" : "Pick maker first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => (
                    <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <SerialNumberField
            id="edit-serial"
            value={form.serial_number}
            onChange={(v) => setForm((f) => ({ ...f, serial_number: v }))}
            excludeDroneId={drone?.id}
            onDuplicateChange={setSerialDuplicate}
          />
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
            <Button type="submit" disabled={loading || !form.name.trim() || serialDuplicate}>
              {loading ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import StreamSourcePicker, { type StreamMode } from "./StreamSourcePicker";
import SerialNumberField from "./SerialNumberField";
import { DRONE_CATALOG, getModelsFor, parseEquipmentString, formatDroneLabel } from "@/lib/drone-catalog";

interface AddDroneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
  prefill?: { name?: string; model?: string };
  hint?: string;
}

export default function AddDroneDialog({ open, onOpenChange, onAdded, prefill, hint }: AddDroneDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    serial_number: "",
  });
  const [manufacturer, setManufacturer] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [serialDuplicate, setSerialDuplicate] = useState(false);
  const [stream, setStream] = useState<{ mode: StreamMode; url?: string; demoPath?: string }>({
    mode: "webrtc",
  });

  useEffect(() => {
    if (open && prefill) {
      const parsed = prefill.model ? parseEquipmentString(prefill.model) : null;
      if (parsed) {
        setManufacturer(parsed.manufacturer);
        setModel(parsed.model);
      }
      setForm(f => ({
        name: prefill.name ?? f.name,
        serial_number: f.serial_number,
      }));
    }
  }, [open, prefill]);

  const availableModels = manufacturer ? getModelsFor(manufacturer) : [];
  const fullModelLabel = manufacturer && model ? formatDroneLabel(manufacturer, model) : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
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
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("You must be signed in.");
      const { error } = await supabase.from("drones").insert({
        name: form.name.trim(),
        model: fullModelLabel,
        serial_number: form.serial_number.trim(),
        assigned_pilot_id: uid,
        stream_mode: stream.mode,
        stream_url: stream.mode === "url" ? (stream.url || null) : stream.mode === "upload" ? (stream.url || null) : null,
        stream_demo_path: stream.mode === "upload" ? (stream.demoPath || null) : null,
      });
      if (error) {
        if (error.code === "23505") {
          throw new Error("A drone with that serial number is already in your fleet.");
        }
        throw error;
      }
      toast({ title: "Drone added", description: `${form.name} has been registered.` });
      setForm({ name: "", serial_number: "" });
      setManufacturer("");
      setModel("");
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
          {hint && <DialogDescription className="text-xs">{hint}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="drone-name">Name *</Label>
            <Input id="drone-name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bravo-1" maxLength={80} />
            <p className="text-xs text-muted-foreground mt-1">A nickname so you can tell drones apart.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="drone-mfr">Manufacturer</Label>
              <Select value={manufacturer} onValueChange={(v) => { setManufacturer(v); setModel(""); }}>
                <SelectTrigger id="drone-mfr"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {DRONE_CATALOG.map((m) => (
                    <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="drone-model">Model</Label>
              <Select value={model} onValueChange={setModel} disabled={!manufacturer}>
                <SelectTrigger id="drone-model">
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
            value={form.serial_number}
            onChange={(v) => setForm((f) => ({ ...f, serial_number: v }))}
            onDuplicateChange={setSerialDuplicate}
          />

          <StreamSourcePicker value={stream} onChange={setStream} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.name.trim() || serialDuplicate}>
              {loading ? "Adding…" : "Add Drone"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

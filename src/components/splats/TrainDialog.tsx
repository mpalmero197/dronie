import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";

interface Props {
  projectId: string;
  disabled?: boolean;
  onJobCreated?: () => void;
}

const PRESETS = [
  { value: "draft",     label: "Draft · 7k iter · ~1.5 min",   blurb: "Fast preview" },
  { value: "balanced",  label: "Balanced · 30k iter · ~6 min", blurb: "Production default" },
  { value: "cinematic", label: "Cinematic · 50k iter · ~12 min", blurb: "Highest fidelity" },
];

export function TrainDialog({ projectId, disabled, onJobCreated }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState("balanced");
  const [sphDegree, setSphDegree] = useState<number[]>([2]);
  const [useGeoref, setUseGeoref] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!projectId) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("train-splat", {
        body: { projectId, preset, sphDegree: sphDegree[0], useGeoref },
      });
      if (error) throw error;
      track("splats_train_started", { projectId, preset, sphDegree: sphDegree[0] });
      toast({
        title: "Training queued",
        description: `${(data as any)?.job?.image_count ?? "Your"} images · ${preset} preset.`,
      });
      setOpen(false);
      onJobCreated?.();
    } catch (e) {
      toast({
        title: "Could not start training",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled} className="gap-1.5">
          <Sparkles className="w-4 h-4" /> Train new scene
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Train Gaussian Splat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Quality preset</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex flex-col">
                      <span>{p.label}</span>
                      <span className="text-[10px] text-muted-foreground">{p.blurb}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <Label className="text-muted-foreground">Spherical harmonics degree</Label>
              <span className="font-mono">{sphDegree[0]}</span>
            </div>
            <Slider value={sphDegree} onValueChange={setSphDegree} min={0} max={3} step={1} />
            <p className="text-[10px] text-muted-foreground">Higher = better view-dependent color, slower training.</p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-xs">Use RTK / EXIF georeferencing</Label>
              <p className="text-[10px] text-muted-foreground">Inspired by DJI Terra: aligns the splat to real-world coords.</p>
            </div>
            <Switch checked={useGeoref} onCheckedChange={setUseGeoref} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Start training
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
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
import { SPLAT_PRESET_SPECS, SPLAT_LIMITATIONS } from "@/lib/splat3dgs";

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

  // Pre-flight self-assessment — feeds capture_flags into splat_jobs so we
  // can correlate bad runs with capture conditions later.
  const [staticScene, setStaticScene] = useState(false);
  const [stableLighting, setStableLighting] = useState(false);
  const [rtkOrGcp, setRtkOrGcp] = useState(false);

  const warnings = [
    !staticScene && SPLAT_LIMITATIONS.find((l) => l.key === "motion")!,
    !stableLighting && SPLAT_LIMITATIONS.find((l) => l.key === "lighting")!,
    !rtkOrGcp && SPLAT_LIMITATIONS.find((l) => l.key === "pose")!,
  ].filter(Boolean) as typeof SPLAT_LIMITATIONS;

  const handleSubmit = async () => {
    if (!projectId) return;
    setSubmitting(true);
    try {
      if (warnings.length > 0) {
        track("splats_preflight_overridden", { warnings: warnings.map((w) => w.key) });
      }
      const { data, error } = await supabase.functions.invoke("train-splat", {
        body: {
          projectId,
          preset,
          sphDegree: sphDegree[0],
          useGeoref,
          captureFlags: { staticScene, stableLighting, rtkOrGcp },
        },
      });
      if (error) throw error;

      const imgCount = (data as any)?.job?.image_count as number | null | undefined;
      const minImages = SPLAT_PRESET_SPECS[preset]?.minImages ?? 0;
      if (typeof imgCount === "number" && imgCount > 0 && imgCount < minImages) {
        toast({
          title: "Heads up: low image count",
          description: `${imgCount} images detected · ${preset} preset recommends ${SPLAT_PRESET_SPECS[preset].recommendedImages}. Expect softer detail.`,
        });
      }

      track("splats_train_started", { projectId, preset, sphDegree: sphDegree[0] });
      toast({
        title: "Training queued",
        description: `${imgCount ?? "Your"} images · ${preset} preset.`,
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
            <p className="text-[10px] text-muted-foreground">
              Recommended images: {SPLAT_PRESET_SPECS[preset]?.recommendedImages ?? "—"}.
            </p>
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

          <div className="rounded-lg border border-border p-3 space-y-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Capture self-assessment
            </div>
            <CaptureToggle
              checked={staticScene} onChange={setStaticScene}
              label="Static scene"
              hint="No moving foliage, water, traffic or people during the flight."
            />
            <CaptureToggle
              checked={stableLighting} onChange={setStableLighting}
              label="Stable lighting"
              hint="Even sky, no fast-moving shadows; flight short enough to keep light consistent."
            />
            <CaptureToggle
              checked={rtkOrGcp} onChange={setRtkOrGcp}
              label="RTK or GCPs available"
              hint="Precise poses prevent SfM drift and spatial corruption."
            />

            {warnings.length > 0 && (
              <div className="rounded-md bg-highlight/10 border border-highlight/30 p-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-highlight">
                  <AlertTriangle className="w-3 h-3" /> Likely to reduce splat quality
                </div>
                <ul className="text-[10px] text-muted-foreground space-y-1 leading-relaxed">
                  {warnings.map((w) => (
                    <li key={w.key}>
                      <span className="text-foreground font-medium">{w.label}:</span> {w.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
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

function CaptureToggle({
  checked, onChange, label, hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Label className="text-xs">{label}</Label>
        <p className="text-[10px] text-muted-foreground leading-snug">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

import { forwardRef, useEffect, useState } from "react";
import {
  MapPin, Ruler, Triangle, CheckCircle2, Circle, Trash2, Loader2, Plus, Mountain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  listAnnotations,
  createAnnotation,
  deleteAnnotation,
  toggleResolved,
  type ProjectAnnotation,
  type AnnotationKind,
} from "@/lib/projectAnnotations";

interface Props {
  projectId: string;
  userId: string;
}

const ICON: Record<AnnotationKind, any> = {
  pin: MapPin,
  distance: Ruler,
  area: Triangle,
  volume: Mountain,
  rectangle: Triangle,
};

/**
 * Lightweight CRUD on project annotations. Geometry capture is intentionally
 * simple — a coordinate field per pin or measurement — so the same panel works
 * whether the viewer is a map, an ortho preview, or a 3D scene.
 */
export const AnnotationsPanel = forwardRef<HTMLDivElement, Props>(
  function AnnotationsPanel({ projectId, userId }, ref) {
    const { toast } = useToast();
    const [items, setItems] = useState<ProjectAnnotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState({
      kind: "pin" as AnnotationKind,
      label: "",
      body: "",
      lat: "",
      lng: "",
    });

    useEffect(() => {
      setLoading(true);
      listAnnotations(projectId)
        .then(setItems)
        .catch((e) => toast({ title: "Could not load annotations", description: e.message, variant: "destructive" }))
        .finally(() => setLoading(false));
    }, [projectId, toast]);

    async function handleCreate() {
      const lat = parseFloat(draft.lat);
      const lng = parseFloat(draft.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        toast({ title: "Enter lat/lng", variant: "destructive" });
        return;
      }
      setSaving(true);
      try {
        const row = await createAnnotation({
          project_id: projectId,
          user_id: userId,
          kind: draft.kind,
          label: draft.label || null,
          body: draft.body || null,
          geometry: { lat, lng },
          measurement: null,
          color: "#22c55e",
        });
        setItems((p) => [row, ...p]);
        setDraft({ kind: "pin", label: "", body: "", lat: "", lng: "" });
        toast({ title: "Annotation added" });
      } catch (e: any) {
        toast({ title: "Could not save", description: e.message, variant: "destructive" });
      } finally {
        setSaving(false);
      }
    }

    return (
      <div ref={ref} className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-700 text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Annotations
          </h3>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            {items.length} total
          </span>
        </div>

        <div className="rounded-xl border border-dashed border-border p-3 space-y-2 bg-secondary/30">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider">Type</Label>
              <select
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as AnnotationKind })}
                className="w-full bg-background border border-border rounded-md h-9 px-2 text-xs"
              >
                <option value="pin">Pin note</option>
                <option value="distance">Distance</option>
                <option value="area">Area</option>
                <option value="volume">Volume</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider">Latitude</Label>
              <Input className="h-9 text-xs" value={draft.lat} onChange={(e) => setDraft({ ...draft, lat: e.target.value })} placeholder="40.7128" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider">Longitude</Label>
              <Input className="h-9 text-xs" value={draft.lng} onChange={(e) => setDraft({ ...draft, lng: e.target.value })} placeholder="-74.0060" />
            </div>
          </div>
          <Input className="h-9 text-xs" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Label (e.g. Roof crack #2)" />
          <Textarea rows={2} className="text-xs" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Notes for the team…" />
          <Button onClick={handleCreate} disabled={saving} className="w-full gap-2" size="sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add annotation
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No annotations yet. Drop the first pin above.</p>
        ) : (
          <ul className="divide-y divide-border max-h-96 overflow-y-auto">
            {items.map((a) => {
              const Icon = ICON[a.kind] ?? MapPin;
              return (
                <li key={a.id} className="py-2.5 flex items-start gap-2">
                  <Icon className={`w-4 h-4 mt-0.5 ${a.resolved ? "text-muted-foreground" : "text-primary"}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${a.resolved ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {a.label || a.kind}
                    </p>
                    {a.body && <p className="text-[11px] text-muted-foreground line-clamp-2">{a.body}</p>}
                    <p className="text-[10px] text-muted-foreground/80 mt-0.5 font-mono">
                      {a.geometry?.lat?.toFixed(5)}, {a.geometry?.lng?.toFixed(5)}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      await toggleResolved(a.id, !a.resolved);
                      setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, resolved: !x.resolved } : x)));
                    }}
                  >
                    {a.resolved ? <Circle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      await deleteAnnotation(a.id);
                      setItems((prev) => prev.filter((x) => x.id !== a.id));
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }
);
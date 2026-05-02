import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  IndustryVertical,
  VERTICAL_LABELS,
  DELIVERABLE_OPTIONS,
} from "@/lib/marketplace";
import { useMemo } from "react";
import LiabilityNotice from "@/components/LiabilityNotice";

export default function MarketplaceNew() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { id: editId } = useParams<{ id: string }>();
  const isEditing = !!editId;
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [vertical, setVertical] = useState<IndustryVertical>(
    (params.get("vertical") as IndustryVertical) || "other"
  );
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [customDeliverable, setCustomDeliverable] = useState("");
  const [customDeliverables, setCustomDeliverables] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);

  const deliverablesByCategory = useMemo(() => {
    const map = new Map<string, typeof DELIVERABLE_OPTIONS>();
    for (const d of DELIVERABLE_OPTIONS) {
      const cat = (d as any).category ?? "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(d);
    }
    return map;
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!isEditing || !user || !editId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("id", editId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast({ title: "Could not load request", variant: "destructive" });
        navigate("/marketplace");
        return;
      }
      if (data.client_id !== user.id) {
        toast({ title: "You can only edit your own requests", variant: "destructive" });
        navigate(`/marketplace/${editId}`);
        return;
      }
      setTitle(data.title ?? "");
      setDescription(data.description ?? "");
      setVertical((data.vertical as IndustryVertical) ?? "other");
      setLocation(data.location_label ?? "");
      setBudget(data.budget_cents != null ? String(data.budget_cents / 100) : "");
      setDeadline(data.deadline ?? "");
      const allLabels = new Set(DELIVERABLE_OPTIONS.map((d) => d.label));
      const incoming = (data.deliverables ?? []) as string[];
      setDeliverables(incoming);
      setCustomDeliverables(incoming.filter((v) => !allLabels.has(v)));
      setLoadingExisting(false);
    })();
    return () => { cancelled = true; };
  }, [isEditing, user, editId, navigate, toast]);

  function toggleDeliverable(id: string) {
    setDeliverables((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  function addCustomDeliverable() {
    const value = customDeliverable.trim();
    if (!value) return;
    if (customDeliverables.includes(value) || deliverables.includes(value)) {
      setCustomDeliverable("");
      return;
    }
    setCustomDeliverables((prev) => [...prev, value]);
    setDeliverables((prev) => [...prev, value]);
    setCustomDeliverable("");
  }

  function removeCustomDeliverable(value: string) {
    setCustomDeliverables((prev) => prev.filter((d) => d !== value));
    setDeliverables((prev) => prev.filter((d) => d !== value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        vertical,
        location_label: location.trim() || null,
        budget_cents: budget ? Math.round(parseFloat(budget) * 100) : null,
        deadline: deadline || null,
        deliverables,
      };
      if (isEditing && editId) {
        const { error } = await supabase
          .from("service_requests")
          .update(payload)
          .eq("id", editId);
        if (error) throw error;
        toast({ title: "Request updated" });
        navigate(`/marketplace/${editId}`);
        return;
      }
      const { data, error } = await supabase
        .from("service_requests")
        .insert({
          client_id: user.id,
          ...payload,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast({ title: "Request posted", description: "Pilots can now submit quotes." });
      navigate(`/marketplace/${data.id}`);
    } catch (err: any) {
      toast({ title: isEditing ? "Could not update" : "Could not post", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-2xl">
        <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to marketplace
        </Link>

        <h1 className="text-3xl font-display font-700 text-foreground mb-2">{isEditing ? "Edit request" : "Post a request"}</h1>
        <p className="text-muted-foreground mb-8">
          {isEditing ? "Update the details of your request below." : "Tell pilots what you need. You'll receive quotes within hours."}
        </p>

        {loadingExisting ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Roof inspection for 4-unit residential building"
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="vertical">Industry</Label>
            <Select value={vertical} onValueChange={(v) => setVertical(v as IndustryVertical)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(VERTICAL_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Site details, access notes, special requirements…"
              rows={5}
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="budget">Budget (USD, optional)</Label>
            <Input
              id="budget"
              type="number"
              min="0"
              step="50"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 500"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>Deliverables needed</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Select all that apply, or add your own below.
            </p>
            <div className="mt-3 space-y-4">
              {Array.from(deliverablesByCategory.entries()).map(([category, items]) => (
                <div key={category}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{category}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map((d) => (
                      <label
                        key={d.id}
                        className="flex items-center gap-2 p-2 rounded-lg border border-border hover:border-primary/30 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={deliverables.includes(d.label)}
                          onCheckedChange={() => toggleDeliverable(d.label)}
                        />
                        <span className="text-foreground">{d.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {customDeliverables.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {customDeliverables.map((value) => (
                  <span
                    key={value}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-foreground"
                  >
                    {value}
                    <button
                      type="button"
                      onClick={() => removeCustomDeliverable(value)}
                      className="hover:text-destructive transition-colors"
                      aria-label={`Remove ${value}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <Input
                value={customDeliverable}
                onChange={(e) => setCustomDeliverable(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomDeliverable();
                  }
                }}
                placeholder="Add custom deliverable (e.g. Site safety walkthrough)"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addCustomDeliverable}
                disabled={!customDeliverable.trim()}
                className="gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
          </div>

          <Button type="submit" disabled={submitting} size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {isEditing ? "Save changes" : "Post request"}
          </Button>

          <LiabilityNotice context="client" />
        </form>
        )}
      </div>
    </div>
  );
}
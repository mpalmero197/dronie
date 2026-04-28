import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
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

export default function MarketplaceNew() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  function toggleDeliverable(id: string) {
    setDeliverables((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
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
      const { data, error } = await supabase
        .from("service_requests")
        .insert({
          client_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          vertical,
          location_label: location.trim() || null,
          budget_cents: budget ? Math.round(parseFloat(budget) * 100) : null,
          deadline: deadline || null,
          deliverables,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast({ title: "Request posted", description: "Pilots can now submit quotes." });
      navigate(`/marketplace/${data.id}`);
    } catch (err: any) {
      toast({ title: "Could not post", description: err.message, variant: "destructive" });
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

        <h1 className="text-3xl font-display font-700 text-foreground mb-2">Post a request</h1>
        <p className="text-muted-foreground mb-8">
          Tell pilots what you need. You'll receive quotes within hours.
        </p>

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
            <div className="grid grid-cols-2 gap-2 mt-2">
              {DELIVERABLE_OPTIONS.map((d) => (
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

          <Button type="submit" disabled={submitting} size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Post request
          </Button>
        </form>
      </div>
    </div>
  );
}
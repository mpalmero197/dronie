import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Loader2, Plus, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { listMyOrgs, orgSchema, type Organization } from "@/lib/orgs";
import LiabilityNotice from "@/components/LiabilityNotice";

export default function Organizations() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState({ name: "", website: "", contact_email: "", phone: "", bio: "" });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    listMyOrgs(user.id)
      .then(setOrgs)
      .catch((e) => toast({ title: "Could not load orgs", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [user, toast]);

  async function createOrg() {
    if (!user) return;
    const parsed = orgSchema.safeParse(draft);
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("organizations")
        .insert({
          owner_id: user.id,
          name: parsed.data.name,
          website: parsed.data.website || null,
          contact_email: parsed.data.contact_email || null,
          phone: parsed.data.phone || null,
          bio: parsed.data.bio || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      // Add owner as active member
      await supabase.from("organization_members").insert({
        org_id: data.id,
        user_id: user.id,
        role: "owner",
        status: "active",
      });
      toast({ title: "Organization created" });
      setOpen(false);
      navigate(`/orgs/${data.id}`);
    } catch (e: any) {
      toast({ title: "Could not create", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-40 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-4xl">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-700 text-foreground">Organizations</h1>
              <p className="text-muted-foreground">Manage drone teams, pilots, and certifications.</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                <Plus className="w-4 h-4" /> New organization
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create organization</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Business name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Website</Label><Input value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} placeholder="https://…" /></div>
                  <div><Label>Contact email</Label><Input type="email" value={draft.contact_email} onChange={(e) => setDraft({ ...draft, contact_email: e.target.value })} /></div>
                </div>
                <div><Label>Phone</Label><Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></div>
                <div><Label>About</Label><Textarea rows={3} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} /></div>
                <LiabilityNotice variant="inline" context="org" />
              </div>
              <DialogFooter>
                <Button onClick={createOrg} disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {orgs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Building2 className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
            <p className="text-foreground font-semibold">No organizations yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create one to add pilots and track their certifications.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {orgs.map((o) => (
              <Link key={o.id} to={`/orgs/${o.id}`} className="rounded-2xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-foreground">{o.name}</p>
                  {o.verified && <ShieldCheck className="w-4 h-4 text-primary" />}
                </div>
                {o.website && <p className="text-xs text-muted-foreground mt-1 truncate">{o.website}</p>}
                {o.bio && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{o.bio}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

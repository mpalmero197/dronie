import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Building2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function AcceptOrgInvite() {
  const { user, loading: authLoading } = useAuth();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing invite token.");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("organization_invites")
        .select("org_id, expires_at, accepted_at")
        .eq("token", token)
        .maybeSingle();
      if (!data) return setError("Invite not found.");
      if (data.accepted_at) return setError("This invite has already been used.");
      if (new Date(data.expires_at) < new Date()) return setError("This invite has expired.");
      const { data: o } = await supabase.from("organizations").select("name").eq("id", data.org_id).maybeSingle();
      setOrgName(o?.name ?? "Organization");
    })();
  }, [token]);

  async function accept() {
    if (!user) return navigate(`/auth?redirect=/orgs/accept?token=${token}`);
    setBusy(true);
    try {
      const { data: invite, error: ie } = await supabase
        .from("organization_invites")
        .select("*")
        .eq("token", token)
        .single();
      if (ie || !invite) throw ie ?? new Error("Invite not found");
      const { error: me } = await supabase
        .from("organization_members")
        .update({ user_id: user.id, status: "active" })
        .eq("org_id", invite.org_id)
        .eq("invited_email", invite.email);
      if (me) throw me;
      await supabase.from("organization_invites").update({ accepted_at: new Date().toISOString() }).eq("token", token);
      toast({ title: "Joined organization" });
      navigate(`/orgs/${invite.org_id}`);
    } catch (e: any) {
      toast({ title: "Could not accept", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-32 pb-16 max-w-md">
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-700 text-foreground">Organization invite</h1>
          {error ? (
            <>
              <p className="text-sm text-destructive mt-3">{error}</p>
              <Link to="/" className="text-sm text-primary mt-4 inline-block">Back to home</Link>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mt-2">
                You've been invited to join <span className="text-foreground font-semibold">{orgName ?? "…"}</span>.
              </p>
              <Button onClick={accept} disabled={busy || authLoading} className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90">
                {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {user ? "Accept invite" : "Sign in to accept"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

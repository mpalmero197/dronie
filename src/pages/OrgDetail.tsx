import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Loader2, Mail, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  getOrg,
  inviteMember,
  listMembers,
  memberCertSummary,
  type OrgMember,
  type Organization,
} from "@/lib/orgs";
import LiabilityNotice from "@/components/LiabilityNotice";

export default function OrgDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [certMap, setCertMap] = useState<Map<string, { worst: number | null; expired: number; total: number }>>(new Map());
  const [pilotNames, setPilotNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  async function refresh() {
    if (!id) return;
    setLoading(true);
    try {
      const [o, m] = await Promise.all([getOrg(id), listMembers(id)]);
      setOrg(o);
      setMembers(m);
      const ids = m.map((x) => x.user_id).filter((x): x is string => !!x);
      const [certs, profs] = await Promise.all([
        memberCertSummary(ids),
        ids.length
          ? supabase.from("pilot_profiles").select("user_id, display_name").in("user_id", ids)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      setCertMap(certs);
      const map: Record<string, string> = {};
      for (const r of (profs as any).data ?? []) map[r.user_id] = r.display_name;
      setPilotNames(map);
    } catch (e: any) {
      toast({ title: "Could not load org", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user && id) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  async function handleInvite() {
    if (!id || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const token = await inviteMember(id, inviteEmail);
      const url = `${window.location.origin}/orgs/accept?token=${token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast({ title: "Invite created", description: "Invite link copied to clipboard." });
      setInviteEmail("");
      refresh();
    } catch (e: any) {
      toast({ title: "Could not invite", description: e.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(memberId: string) {
    const { error } = await supabase
      .from("organization_members")
      .update({ status: "removed" })
      .eq("id", memberId);
    if (error) toast({ title: "Could not remove", description: error.message, variant: "destructive" });
    else refresh();
  }

  if (authLoading || loading || !org) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-40 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      </div>
    );
  }

  const active = members.filter((m) => m.status !== "removed");
  const isOwner = org.owner_id === user?.id;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-4xl">
        <Link to="/orgs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> All organizations
        </Link>

        <div className="flex items-start gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-display font-700 text-foreground">{org.name}</h1>
              {org.verified && <ShieldCheck className="w-5 h-5 text-primary" />}
            </div>
            {org.website && <a href={org.website} className="text-sm text-primary" target="_blank" rel="noreferrer">{org.website}</a>}
            {org.bio && <p className="text-muted-foreground mt-2">{org.bio}</p>}
          </div>
        </div>

        <section className="bg-card rounded-2xl border border-border p-6 mb-6">
          <h2 className="font-display font-700 text-foreground mb-4">Invite a pilot</h2>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="pilot@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="max-w-md"
            />
            <Button onClick={handleInvite} disabled={inviting || !isOwner} className="gap-2">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Invite
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            We'll generate an invite link and copy it to your clipboard. Share it with the pilot to add them to this org.
          </p>
        </section>

        <section className="bg-card rounded-2xl border border-border p-6 mb-6">
          <h2 className="font-display font-700 text-foreground mb-4">Roster ({active.length})</h2>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {active.map((m) => {
                const summary = m.user_id ? certMap.get(m.user_id) : undefined;
                const expired = summary?.expired ?? 0;
                const worst = summary?.worst;
                let badge: JSX.Element;
                if (m.status === "invited") badge = <Badge variant="outline" className="text-[10px]">Invited</Badge>;
                else if (expired > 0) badge = <Badge variant="destructive" className="text-[10px]">{expired} cert(s) expired</Badge>;
                else if (worst != null && worst < 60) badge = <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20 text-[10px]">{worst}d to expiry</Badge>;
                else if (summary && summary.total > 0) badge = <Badge className="bg-primary/15 text-primary border-primary/20 text-[10px]">Compliant</Badge>;
                else badge = <Badge variant="outline" className="text-[10px]">No certs on file</Badge>;
                return (
                  <div key={m.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {m.user_id ? pilotNames[m.user_id] ?? "Pilot" : m.invited_email ?? "Invited"}
                      </p>
                      <p className="text-[11px] text-muted-foreground capitalize">{m.role} · {m.status}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {badge}
                      {m.invited_email && <Mail className="w-3.5 h-3.5 text-muted-foreground" />}
                      {isOwner && m.role !== "owner" && (
                        <Button size="icon" variant="ghost" onClick={() => removeMember(m.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <LiabilityNotice context="org" />
      </div>
    </div>
  );
}

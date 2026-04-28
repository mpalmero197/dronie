import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Clock, Loader2, ShieldAlert, ShieldCheck, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ID_TYPES,
  VERIFICATION_STATUS_LABELS,
  getMyLatestVerification,
  verificationSchema,
  type PilotVerification,
  type VerificationStatus,
} from "@/lib/verification";

const STATUS_STYLES: Record<VerificationStatus, string> = {
  unverified: "bg-muted text-muted-foreground border-border",
  pending: "bg-highlight/15 text-highlight border-highlight/30",
  verified: "bg-primary/15 text-primary border-primary/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

function StatusBadge({ status }: { status: VerificationStatus }) {
  const Icon =
    status === "verified" ? ShieldCheck :
    status === "pending" ? Clock :
    status === "rejected" ? ShieldAlert : BadgeCheck;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[status]}`}>
      <Icon className="w-3 h-3" />
      {VERIFICATION_STATUS_LABELS[status]}
    </span>
  );
}

export default function PilotVerification() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<PilotVerification | null>(null);
  const [hasProfile, setHasProfile] = useState(false);

  // Form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState("United States");
  const [region, setRegion] = useState("");
  const [idType, setIdType] = useState<typeof ID_TYPES[number]>("Driver's License");
  const [idLast4, setIdLast4] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [insurer, setInsurer] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [pilotNotes, setPilotNotes] = useState("");
  const [docUrlsRaw, setDocUrlsRaw] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: profile } = await supabase
          .from("pilot_profiles")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();
        setHasProfile(!!profile);

        const v = await getMyLatestVerification(user.id);
        if (v) {
          setExisting(v);
          setFirstName(v.legal_first_name);
          setLastName(v.legal_last_name);
          setDob(v.date_of_birth ?? "");
          setCountry(v.country);
          setRegion(v.region ?? "");
          setIdType((ID_TYPES as readonly string[]).includes(v.id_type) ? (v.id_type as any) : "Driver's License");
          setIdLast4(v.id_last4);
          setCertNumber(v.part_107_cert_number ?? "");
          setInsurer(v.insurance_provider ?? "");
          setPolicyNumber(v.insurance_policy_number ?? "");
          setPilotNotes(v.pilot_notes ?? "");
          setDocUrlsRaw((v.document_urls ?? []).join("\n"));
        }
      } catch (err: any) {
        toast({ title: "Could not load verification", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [user, toast]);

  const locked = existing && (existing.status === "pending" || existing.status === "verified");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!hasProfile) {
      toast({
        title: "Create your pilot profile first",
        description: "Verification requires an active pilot profile.",
        variant: "destructive",
      });
      return;
    }
    const docs = docUrlsRaw
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const parsed = verificationSchema.safeParse({
      legal_first_name: firstName,
      legal_last_name: lastName,
      date_of_birth: dob || null,
      country,
      region: region || null,
      id_type: idType,
      id_last4: idLast4,
      part_107_cert_number: certNumber || null,
      insurance_provider: insurer || null,
      insurance_policy_number: policyNumber || null,
      pilot_notes: pilotNotes || null,
      document_urls: docs,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast({ title: "Check your info", description: `${first.path.join(".")}: ${first.message}`, variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...parsed.data,
        user_id: user.id,
        status: "pending" as const,
        admin_notes: null,
        reviewed_by: null,
        reviewed_at: null,
      };
      if (existing && existing.status === "rejected") {
        // Resubmission: update the existing rejected record back to pending
        const { error } = await supabase
          .from("pilot_verifications")
          .update({
            ...parsed.data,
            status: "pending",
            admin_notes: null,
            reviewed_by: null,
            reviewed_at: null,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pilot_verifications").insert(payload as any);
        if (error) throw error;
      }
      toast({
        title: "Verification submitted",
        description: "An admin will review your details shortly. You'll be notified once approved.",
      });
      navigate("/pilots/join");
    } catch (err: any) {
      toast({ title: "Could not submit", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-40 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 pt-24 pb-16 max-w-3xl">
        <Link to="/pilots/join" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to pilot profile
        </Link>

        <div className="flex flex-wrap items-start gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-display font-700 text-foreground">Pilot verification</h1>
              {existing && <StatusBadge status={existing.status} />}
            </div>
            <p className="text-muted-foreground mt-1">
              Verified pilots earn a trust badge that's shown to clients on the marketplace and pilot map.
              Your identity details are private and only visible to Dronie admins.
            </p>
          </div>
        </div>

        {existing?.status === "verified" && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">You're verified</p>
              <p className="text-sm text-muted-foreground">
                Approved {existing.reviewed_at ? new Date(existing.reviewed_at).toLocaleDateString() : "recently"}.
                Your badge is now visible to clients.
              </p>
            </div>
          </div>
        )}

        {existing?.status === "rejected" && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-6 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Verification was not approved</p>
              {existing.admin_notes && (
                <p className="text-sm text-muted-foreground mt-1 break-words">
                  Reviewer note: {existing.admin_notes}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">Update your details below and resubmit.</p>
            </div>
          </div>
        )}

        {existing?.status === "pending" && (
          <div className="bg-highlight/5 border border-highlight/20 rounded-xl p-4 mb-6 flex items-start gap-3">
            <Clock className="w-5 h-5 text-highlight flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Submitted for review</p>
              <p className="text-sm text-muted-foreground">
                We typically review within 1–2 business days. You'll be notified once a decision is made.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset disabled={!!locked} className="space-y-6 disabled:opacity-60">
            <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <h2 className="font-display font-700 text-foreground">Legal identity</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Legal first name</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={80} className="mt-1.5" required />
                </div>
                <div>
                  <Label htmlFor="lastName">Legal last name</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={80} className="mt-1.5" required />
                </div>
                <div>
                  <Label htmlFor="dob">Date of birth (optional)</Label>
                  <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={80} className="mt-1.5" required />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="region">State / region (optional)</Label>
                  <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} maxLength={120} className="mt-1.5" />
                </div>
              </div>
            </section>

            <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <h2 className="font-display font-700 text-foreground">Government ID</h2>
              <p className="text-sm text-muted-foreground -mt-2">
                We only store the last 4 digits and the document type. Upload a photo of your ID below if you'd like to fast-track review.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="idType">ID type</Label>
                  <Select value={idType} onValueChange={(v) => setIdType(v as typeof idType)}>
                    <SelectTrigger id="idType" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ID_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="idLast4">Last 4 digits</Label>
                  <Input id="idLast4" inputMode="numeric" pattern="\d{4}" maxLength={4} value={idLast4} onChange={(e) => setIdLast4(e.target.value.replace(/\D/g, ""))} className="mt-1.5" required />
                </div>
              </div>
            </section>

            <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <h2 className="font-display font-700 text-foreground">Credentials (optional but recommended)</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cert">FAA Part 107 certificate #</Label>
                  <Input id="cert" value={certNumber} onChange={(e) => setCertNumber(e.target.value)} maxLength={40} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="insurer">Insurance provider</Label>
                  <Input id="insurer" value={insurer} onChange={(e) => setInsurer(e.target.value)} maxLength={120} className="mt-1.5" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="policy">Insurance policy number</Label>
                  <Input id="policy" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} maxLength={80} className="mt-1.5" />
                </div>
              </div>
            </section>

            <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <h2 className="font-display font-700 text-foreground">Supporting documents</h2>
              <div>
                <Label htmlFor="docs">Document links (one URL per line)</Label>
                <Textarea
                  id="docs"
                  rows={4}
                  value={docUrlsRaw}
                  onChange={(e) => setDocUrlsRaw(e.target.value)}
                  placeholder={"https://drive.google.com/...\nhttps://..."}
                  className="mt-1.5 font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste shareable links to your ID, Part 107 certificate, or insurance certificate. Up to 8 links.
                </p>
              </div>
              <div>
                <Label htmlFor="notes">Notes for the reviewer (optional)</Label>
                <Textarea id="notes" rows={3} value={pilotNotes} onChange={(e) => setPilotNotes(e.target.value)} maxLength={800} className="mt-1.5" />
                <p className="text-xs text-muted-foreground mt-1">{pilotNotes.length}/800</p>
              </div>
            </section>
          </fieldset>

          {!locked && (
            <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {existing?.status === "rejected" ? "Resubmit for review" : "Submit for review"}
            </Button>
          )}
          {locked && existing?.status === "pending" && (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <X className="w-4 h-4" /> Form locked while review is in progress.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
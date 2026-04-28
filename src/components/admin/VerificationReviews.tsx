import { useEffect, useState } from "react";
import { BadgeCheck, Check, Clock, ExternalLink, Loader2, Plane, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  listVerifications,
  reviewVerification,
  VERIFICATION_STATUS_LABELS,
  type PilotVerification,
  type VerificationStatus,
} from "@/lib/verification";

const STATUS_BORDER: Record<VerificationStatus, string> = {
  unverified: "border-border",
  pending: "border-highlight/40",
  verified: "border-primary/40",
  rejected: "border-destructive/40",
};

function StatusPill({ status }: { status: VerificationStatus }) {
  const Icon =
    status === "verified" ? ShieldCheck :
    status === "pending" ? Clock :
    status === "rejected" ? ShieldAlert : BadgeCheck;
  const cls =
    status === "verified" ? "bg-primary/15 text-primary border-primary/30" :
    status === "pending" ? "bg-highlight/15 text-highlight border-highlight/30" :
    status === "rejected" ? "bg-destructive/15 text-destructive border-destructive/30" :
    "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      <Icon className="w-3 h-3" />
      {VERIFICATION_STATUS_LABELS[status]}
    </span>
  );
}

function VerificationCard({
  v,
  onReview,
  busy,
}: {
  v: PilotVerification;
  onReview: (id: string, decision: "verified" | "rejected", notes: string) => Promise<void>;
  busy: string | null;
}) {
  const [notes, setNotes] = useState(v.admin_notes ?? "");
  const isPending = v.status === "pending";
  const isBusy = busy === v.id;

  // FAA Airmen Inquiry is a public web form (CAPTCHA-protected, no API).
  // We deep-link the admin to it pre-focused on the pilot's last name; the
  // admin completes the search and confirms the pilot holds a Remote Pilot
  // certificate (Part 107) before approving.
  const faaLookupUrl = `https://amsrvs.registry.faa.gov/airmeninquiry/Main.aspx?lastName=${encodeURIComponent(v.legal_last_name)}`;
  const dobHint = v.date_of_birth
    ? `DOB on file: ${new Date(v.date_of_birth).toLocaleDateString()}`
    : "No DOB on file — search by last name only";
  return (
    <div className={`bg-card rounded-xl border-2 ${STATUS_BORDER[v.status]} p-5 space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">
            {v.legal_first_name} {v.legal_last_name}
          </p>
          <p className="text-xs text-muted-foreground">
            Submitted {new Date(v.created_at).toLocaleString()}
            {v.reviewed_at && ` · Reviewed ${new Date(v.reviewed_at).toLocaleString()}`}
          </p>
        </div>
        <StatusPill status={v.status} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Country / region</p>
          <p className="text-foreground">{v.country}{v.region ? `, ${v.region}` : ""}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">ID</p>
          <p className="text-foreground">{v.id_type} ····{v.id_last4}</p>
        </div>
        {v.date_of_birth && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Date of birth</p>
            <p className="text-foreground">{new Date(v.date_of_birth).toLocaleDateString()}</p>
          </div>
        )}
        {v.part_107_cert_number && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Part 107 cert #</p>
            <p className="text-foreground font-mono">{v.part_107_cert_number}</p>
          </div>
        )}
        {v.insurance_provider && (
          <div className="sm:col-span-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Insurance</p>
            <p className="text-foreground">
              {v.insurance_provider}
              {v.insurance_policy_number && <span className="text-muted-foreground"> · {v.insurance_policy_number}</span>}
            </p>
          </div>
        )}
      </div>

      {v.document_urls.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Documents</p>
          <div className="flex flex-wrap gap-2">
            {v.document_urls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-foreground text-xs hover:bg-secondary/70"
              >
                <ExternalLink className="w-3 h-3" />
                Document {i + 1}
              </a>
            ))}
          </div>
        </div>
      )}

      {v.pilot_notes && (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Pilot notes</p>
          <p className="text-sm text-foreground bg-muted/40 rounded-md p-3 whitespace-pre-wrap">{v.pilot_notes}</p>
        </div>
      )}

      {/* FAA Airmen Registry lookup — verify Remote Pilot (Part 107) certificate */}
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2">
        <div className="flex items-start gap-2">
          <Plane className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-foreground">Verify with FAA Airmen Registry</p>
            <p className="text-xs text-muted-foreground">
              Open the FAA inquiry, search for <span className="font-mono">{v.legal_last_name}</span>, then
              confirm the record lists a <strong>Remote Pilot</strong> certificate. {dobHint}.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <a href={faaLookupUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3.5 h-3.5" /> Look up on FAA Airmen Registry
          </a>
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-3 pt-2 border-t border-border">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Reviewer notes (required for rejection)</label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={800}
              placeholder="Optional for approval, required when rejecting…"
              className="mt-1.5"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={isBusy}
              onClick={() => onReview(v.id, "verified", notes)}
              className="gap-1.5"
            >
              {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isBusy || !notes.trim()}
              onClick={() => onReview(v.id, "rejected", notes)}
              className="gap-1.5"
            >
              {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              Reject
            </Button>
          </div>
        </div>
      ) : v.admin_notes ? (
        <div className="pt-2 border-t border-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Reviewer note</p>
          <p className="text-sm text-foreground">{v.admin_notes}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function VerificationReviews() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<PilotVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<VerificationStatus | "all">("pending");

  async function load() {
    setLoading(true);
    try {
      const data = await listVerifications();
      setItems(data);
    } catch (err: any) {
      toast({ title: "Could not load verifications", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleReview(id: string, decision: "verified" | "rejected", notes: string) {
    if (!user) return;
    if (decision === "rejected" && !notes.trim()) {
      toast({ title: "Please add a note explaining the rejection", variant: "destructive" });
      return;
    }
    setBusy(id);
    try {
      await reviewVerification(id, decision, notes, user.id);
      toast({
        title: decision === "verified" ? "Pilot verified" : "Submission rejected",
      });
      await load();
    } catch (err: any) {
      toast({ title: "Could not submit decision", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  const filtered = tab === "all" ? items : items.filter((v) => v.status === tab);
  const pendingCount = items.filter((v) => v.status === "pending").length;
  const verifiedCount = items.filter((v) => v.status === "verified").length;
  const rejectedCount = items.filter((v) => v.status === "rejected").length;

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h2 className="font-display font-700 text-foreground">Pilot verifications</h2>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as VerificationStatus | "all")}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="verified">Verified ({verifiedCount})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejectedCount})</TabsTrigger>
          <TabsTrigger value="all">All ({items.length})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No verifications in this view.</div>
          ) : (
            filtered.map((v) => (
              <VerificationCard key={v.id} v={v} onReview={handleReview} busy={busy} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
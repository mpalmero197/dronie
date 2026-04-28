import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shield, ShieldCheck, ShieldAlert, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyLatestVerification,
  VERIFICATION_STATUS_LABELS,
  type VerificationStatus,
} from "@/lib/verification";

interface Props {
  /** Compact variant for embedding inside other dashboards. */
  compact?: boolean;
  /** Hide entirely when the pilot has no profile yet. Default true on the dashboard. */
  hideWhenUnverified?: boolean;
  className?: string;
}

/**
 * Live pilot verification status banner. Subscribes to `pilot_verifications`
 * via Supabase Realtime so pending → verified/rejected transitions appear
 * without a page refresh.
 */
export default function PilotVerificationBanner({
  compact = false,
  hideWhenUnverified = false,
  className = "",
}: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;

    async function load() {
      try {
        const v = await getMyLatestVerification(user!.id);
        if (!active) return;
        if (v) {
          setStatus(v.status);
          setRejectionReason(v.status === "rejected" ? v.admin_notes : null);
        } else {
          setStatus("unverified");
          setRejectionReason(null);
        }
      } catch {
        if (active) setStatus("unverified");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();

    const channel = supabase
      .channel(`pilot-verification:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pilot_verifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as
            | { status: VerificationStatus; admin_notes: string | null }
            | undefined;
          if (!row) return;
          setStatus(row.status);
          setRejectionReason(row.status === "rejected" ? row.admin_notes : null);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!user) return null;
  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Checking verification…
      </div>
    );
  }
  if (!status) return null;
  if (hideWhenUnverified && status === "unverified") return null;

  const tone =
    status === "verified"
      ? "bg-primary/5 border-primary/20"
      : status === "rejected"
        ? "bg-destructive/5 border-destructive/20"
        : status === "pending"
          ? "bg-highlight/5 border-highlight/20"
          : "bg-muted/40 border-border";

  const Icon =
    status === "verified"
      ? ShieldCheck
      : status === "rejected"
        ? ShieldAlert
        : status === "pending"
          ? Clock
          : Shield;

  const iconColor =
    status === "verified"
      ? "text-primary"
      : status === "rejected"
        ? "text-destructive"
        : status === "pending"
          ? "text-highlight"
          : "text-muted-foreground";

  const description =
    status === "verified"
      ? "Your verified badge is shown to clients on the marketplace."
      : status === "pending"
        ? "An admin is reviewing your submission. This page will update automatically when a decision is made."
        : status === "rejected"
          ? rejectionReason
            ? `Reason: ${rejectionReason}`
            : "Your last submission wasn't approved. Update and resubmit to earn your badge."
          : "Get a verified badge so clients can trust your profile faster.";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl border ${compact ? "p-3" : "p-4"} flex flex-wrap items-start gap-3 ${tone} ${className}`}
    >
      <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
      <div className="min-w-0 flex-1">
        <p className={`font-semibold text-foreground ${compact ? "text-sm" : ""}`}>
          Identity verification: {VERIFICATION_STATUS_LABELS[status]}
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild size="sm" variant={status === "verified" ? "outline" : "default"}>
        <Link to="/pilots/verify">
          {status === "unverified" ? "Start verification" : "Manage verification"}
        </Link>
      </Button>
    </div>
  );
}
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  variant?: "inline" | "card";
  context?: "pilot" | "client" | "org";
}

const COPY: Record<NonNullable<Props["context"]>, string> = {
  pilot:
    "You are solely responsible for keeping your FAA Part 107, insurance, and other certifications current and for complying with all applicable aviation, privacy, and local regulations. Dronie and its affiliates accept no responsibility for damages, losses, injuries, regulatory violations, or disputes arising from your operations.",
  client:
    "Dronie is a listing platform that introduces clients to independent pilots. We do not employ pilots, do not verify every credential beyond what is uploaded, and accept no responsibility for the conduct, deliverables, damages, losses, or disputes between you and any pilot or organization.",
  org: "Organizations are responsible for ensuring every pilot they list maintains current certifications, insurance, and regulatory compliance. Dronie and its affiliates accept no responsibility for damages, losses, or disputes arising from any pilot's operations or recordkeeping.",
};

export default function LiabilityNotice({ variant = "card", context = "pilot" }: Props) {
  const body = COPY[context];
  if (variant === "inline") {
    return (
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {body}{" "}
        <Link to="/terms" className="underline hover:text-foreground">
          Read the full terms
        </Link>
        .
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="text-xs text-muted-foreground leading-relaxed">
        <p className="font-semibold text-foreground mb-1">Your responsibility</p>
        <p>{body}</p>
        <Link to="/terms" className="inline-block mt-2 text-amber-600 hover:text-amber-700 font-medium">
          Read the full terms →
        </Link>
      </div>
    </div>
  );
}

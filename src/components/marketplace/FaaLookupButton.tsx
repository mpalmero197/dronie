import { ExternalLink, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FaaLookupButtonProps {
  /** Pilot's public display name; used to seed the FAA Airmen Inquiry search. */
  displayName: string;
  /** Visual variant. `compact` is suitable for inline placement next to a name. */
  size?: "sm" | "compact";
  className?: string;
}

/**
 * Deep-links the viewer to the FAA Airmen Registry public inquiry with the
 * pilot's last token of their display name pre-filled as the last-name search.
 * The FAA inquiry is CAPTCHA-protected and has no API, so this is the most
 * direct way for clients to independently verify a pilot's Part 107 claim
 * before hiring. Legal name and DOB stay private — only the public display
 * name is sent in the URL.
 */
export default function FaaLookupButton({
  displayName,
  size = "sm",
  className,
}: FaaLookupButtonProps) {
  // Best-effort: take the last whitespace-separated token as the search seed.
  // Clients refine the search on the FAA page if needed.
  const tokens = displayName.trim().split(/\s+/).filter(Boolean);
  const lastNameSeed = tokens.length > 0 ? tokens[tokens.length - 1] : displayName;
  const url = `https://amsrvs.registry.faa.gov/airmeninquiry/Main.aspx?lastName=${encodeURIComponent(
    lastNameSeed,
  )}`;

  const tip = (
    <span className="text-xs">
      Verify on the FAA Airmen Registry. Search opens pre-filled for{" "}
      <span className="font-mono">{lastNameSeed}</span> — confirm the record lists a{" "}
      <strong>Remote Pilot</strong> certificate.
    </span>
  );

  if (size === "compact") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors ${
                className ?? ""
              }`}
            >
              <Plane className="w-3 h-3" /> Verify on FAA
              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
            </a>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{tip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild size="sm" variant="outline" className={`gap-1.5 ${className ?? ""}`}>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Plane className="w-3.5 h-3.5" />
              Verify on FAA Registry
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, BookOpen, ExternalLink, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getMyLatestVerification } from "@/lib/verification";

const DISMISS_KEY = "dronie:part107-prompt-dismissed";

const STUDY_LINKS = [
  {
    title: "FAA Part 107 — Become a Drone Pilot (official)",
    href: "https://www.faa.gov/uas/commercial_operators/become_a_drone_pilot",
  },
  {
    title: "Schedule the Part 107 knowledge test (PSI)",
    href: "https://faa.psiexams.com/faa/login",
  },
  {
    title: "Free FAA study guide (PDF)",
    href: "https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/remote_pilot_study_guide.pdf",
  },
  {
    title: "Recommended book — Part 107 Made Easy (Field Guides)",
    href: "/field-guides",
    internal: true,
  },
];

/**
 * Encourages unverified pilots to complete Part 107 certification + identity
 * verification. Hidden once dismissed or once a verification record exists.
 */
export default function Part107Prompt({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [stage, setStage] = useState<"ask" | "study">("ask");

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setShow(false);
      return;
    }
    if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1") {
      return;
    }
    (async () => {
      try {
        const v = await getMyLatestVerification(user.id);
        if (cancelled) return;
        if (!v || v.status === "unverified" || v.status === "rejected") {
          setShow(true);
        }
      } catch {
        if (!cancelled) setShow(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="Part 107 certification prompt"
      className={`relative rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 via-background to-primary/5 p-5 ${className}`}
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
          <Award className="w-5 h-5 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          {stage === "ask" ? (
            <>
              <h3 className="font-display font-700 text-foreground">
                Get your verified pilot badge
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Verified pilots stand out in the marketplace and earn client trust faster.
                Do you have your FAA Part 107 Remote Pilot certification?
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" className="gap-1.5">
                  <Link to="/pilots/verify">
                    <ShieldCheck className="w-4 h-4" />
                    Yes — verify my certification
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setStage("study")}
                >
                  <BookOpen className="w-4 h-4" />
                  Not yet — help me get started
                </Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-display font-700 text-foreground">
                Get Part 107 certified
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The FAA Part 107 Remote Pilot Certificate is required to fly commercially in the U.S.
                Start with these official and recommended resources:
              </p>
              <ul className="mt-3 space-y-1.5">
                {STUDY_LINKS.map((link) =>
                  link.internal ? (
                    <li key={link.href}>
                      <Link
                        to={link.href}
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        {link.title}
                      </Link>
                    </li>
                  ) : (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {link.title}
                      </a>
                    </li>
                  ),
                )}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <Link to="/pilots/verify">
                    <ShieldCheck className="w-4 h-4" />
                    I already have it — verify now
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setStage("ask")}
                >
                  Back
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
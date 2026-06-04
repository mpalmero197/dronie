import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "dronie-cookie-consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      // Small delay so it doesn't flash on initial load
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] p-4 pointer-events-none">
      <div
        className="pointer-events-auto max-w-lg mx-auto md:mx-4 md:ml-auto bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-5 animate-in slide-in-from-bottom-4 duration-500"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Cookie className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground mb-1">We use cookies</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We use cookies and similar technologies to improve your experience, analyze traffic, and personalize content. Read our{" "}
              <Link
                to="/privacy"
                className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                Privacy Policy
              </Link>{" "}
              to learn more.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={accept} className="text-xs h-8 px-4">
                Accept All
              </Button>
              <Button size="sm" variant="outline" onClick={decline} className="text-xs h-8 px-4">
                Decline
              </Button>
            </div>
          </div>
          <button
            onClick={decline}
            aria-label="Close"
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

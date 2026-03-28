import { useNavigate } from "react-router-dom";
import { Zap, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface UpgradePromptProps {
  open: boolean;
  onClose: () => void;
  feature: string;
  description: string;
  requiredTier?: "professional" | "enterprise";
}

export default function UpgradePrompt({ open, onClose, feature, description, requiredTier = "professional" }: UpgradePromptProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <Lock className="w-4 h-4 text-accent" />
            </div>
            {feature}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
          <div className="bg-secondary/50 rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-foreground">
                Upgrade to {requiredTier === "enterprise" ? "Enterprise" : "Professional"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {requiredTier === "enterprise"
                ? "Get unlimited images, multi-spectral support, API access, and white-label options."
                : "Get unlimited projects, priority processing, point cloud outputs, and share links."}
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Maybe Later</Button>
          <Button
            className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => {
              onClose();
              navigate("/#pricing");
            }}
          >
            <Zap className="w-4 h-4" /> View Plans
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Inline banner variant for embedding in pages */
export function UpgradeBanner({ feature, tierLabel }: { feature: string; tierLabel: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent/10 border border-accent/20">
      <Lock className="w-4 h-4 text-accent flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{feature}</p>
        <p className="text-xs text-muted-foreground">Available on {tierLabel} plan and above</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="text-xs gap-1 flex-shrink-0 border-accent/30 text-accent hover:bg-accent/10"
        onClick={() => navigate("/#pricing")}
      >
        <Zap className="w-3 h-3" /> Upgrade
      </Button>
    </div>
  );
}

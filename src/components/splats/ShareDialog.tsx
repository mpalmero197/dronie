import { useState } from "react";
import { Copy, Link2, Loader2, Share2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";

interface Props {
  projectId: string;
  assetPath: string;     // bucket-relative path, e.g. "{pid}/splats/foo.ply"
  assetName: string;
  disabled?: boolean;
}

const EXPIRY_OPTIONS = [
  { value: "0",   label: "Never expires" },
  { value: "1",   label: "1 day" },
  { value: "7",   label: "7 days" },
  { value: "30",  label: "30 days" },
];

function genToken(): string {
  // 22-char URL-safe random token (≈ 128 bits of entropy)
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function ShareDialog({ projectId, assetPath, assetName, disabled }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [expiry, setExpiry] = useState("7");
  const [submitting, setSubmitting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const create = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const token = genToken();
      const days = Number(expiry);
      const expires_at = days > 0
        ? new Date(Date.now() + days * 86400_000).toISOString()
        : null;

      const { error } = await supabase.from("splat_shares").insert({
        token, user_id: user.id, project_id: projectId,
        asset_path: assetPath, asset_name: assetName, expires_at,
      });
      if (error) throw error;

      const url = `${window.location.origin}/embed/splats/${token}`;
      setShareUrl(url);
      track("splats_share_created", { projectId, expiry_days: days });
    } catch (e) {
      toast({
        title: "Share failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setShareUrl(null); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled} className="gap-1.5">
          <Share2 className="w-3.5 h-3.5" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" /> Share splat scene
          </DialogTitle>
        </DialogHeader>

        {!shareUrl ? (
          <>
            <div className="space-y-3 py-2">
              <div className="text-xs text-muted-foreground">
                Generates a public, view-only link to <span className="font-mono">{assetName}</span>.
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expiration</Label>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={create} disabled={submitting} className="gap-1.5">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Create link
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Share URL</Label>
              <div className="flex gap-1.5">
                <Input readOnly value={shareUrl} className="font-mono text-xs" />
                <Button size="sm" variant="outline" onClick={() => copy(shareUrl)} className="px-2">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Embed iframe</Label>
              <div className="flex gap-1.5">
                <Input
                  readOnly
                  value={`<iframe src="${shareUrl}" width="800" height="500" frameborder="0" allow="fullscreen"></iframe>`}
                  className="font-mono text-[10px]"
                />
                <Button size="sm" variant="outline" onClick={() => copy(
                  `<iframe src="${shareUrl}" width="800" height="500" frameborder="0" allow="fullscreen"></iframe>`
                )} className="px-2">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <Button size="sm" className="w-full" onClick={() => setOpen(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

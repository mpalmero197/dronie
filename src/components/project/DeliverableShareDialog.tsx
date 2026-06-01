import { forwardRef, useEffect, useState } from "react";
import { Loader2, Copy, Trash2, Link2, ExternalLink, Eye, MessageSquare, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  listShares,
  createShare,
  revokeShare,
  shareUrl,
  type DeliverableShare,
  type SharePermission,
} from "@/lib/deliverableShares";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  ownerId: string;
  selectedKeys: string[];
  availableKeys: { key: string; label: string }[];
}

const PERM_META: Record<SharePermission, { icon: any; label: string; desc: string }> = {
  view: { icon: Eye, label: "View only", desc: "Recipient can browse deliverables." },
  comment: { icon: MessageSquare, label: "View & comment", desc: "Allows leaving pin annotations." },
  download: { icon: Download, label: "Download", desc: "Permits downloading original files." },
};

export const DeliverableShareDialog = forwardRef<HTMLDivElement, Props>(
  function DeliverableShareDialog({ open, onOpenChange, projectId, ownerId, selectedKeys, availableKeys }, ref) {
    const { toast } = useToast();
    const [shares, setShares] = useState<DeliverableShare[]>([]);
    const [loading, setLoading] = useState(false);
    const [permission, setPermission] = useState<SharePermission>("view");
    const [expiresInDays, setExpiresInDays] = useState<string>("7");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
      if (!open) return;
      setLoading(true);
      listShares(projectId)
        .then(setShares)
        .catch((e) => toast({ title: "Could not load shares", description: e.message, variant: "destructive" }))
        .finally(() => setLoading(false));
    }, [open, projectId, toast]);

    const keys = selectedKeys.length ? selectedKeys : availableKeys.map((a) => a.key);

    async function handleCreate() {
      if (!keys.length) {
        toast({ title: "Pick at least one deliverable", variant: "destructive" });
        return;
      }
      setCreating(true);
      try {
        const days = expiresInDays === "0" ? null : parseInt(expiresInDays, 10);
        const row = await createShare({ projectId, ownerId, deliverableKeys: keys, permission, expiresInDays: days });
        setShares((prev) => [row, ...prev]);
        await navigator.clipboard.writeText(shareUrl(row.token)).catch(() => {});
        toast({ title: "Share link created", description: "Copied to clipboard." });
      } catch (e: any) {
        toast({ title: "Could not create share", description: e.message, variant: "destructive" });
      } finally {
        setCreating(false);
      }
    }

    async function handleRevoke(id: string) {
      try {
        await revokeShare(id);
        setShares((prev) => prev.map((s) => (s.id === id ? { ...s, revoked_at: new Date().toISOString() } : s)));
        toast({ title: "Share revoked" });
      } catch (e: any) {
        toast({ title: "Could not revoke", description: e.message, variant: "destructive" });
      }
    }

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent ref={ref as any} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary" /> Share deliverables
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-secondary/40 p-3">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                Included ({keys.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availableKeys
                  .filter((a) => keys.includes(a.key))
                  .map((a) => (
                    <Badge key={a.key} variant="outline" className="text-[10px]">
                      {a.label}
                    </Badge>
                  ))}
                {keys.length === 0 && <p className="text-xs text-muted-foreground">All deliverables</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Permission</Label>
                <Select value={permission} onValueChange={(v) => setPermission(v as SharePermission)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PERM_META) as SharePermission[]).map((p) => {
                      const meta = PERM_META[p];
                      const Icon = meta.icon;
                      return (
                        <SelectItem key={p} value={p}>
                          <span className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5" /> {meta.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">{PERM_META[permission].desc}</p>
              </div>
              <div>
                <Label className="text-xs">Expires in</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">24 hours</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="0">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleCreate} disabled={creating} className="w-full gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Create share link
            </Button>

            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                Existing links
              </p>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : shares.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No share links yet.</p>
              ) : (
                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                  {shares.map((s) => {
                    const revoked = !!s.revoked_at;
                    const expired = s.expires_at && new Date(s.expires_at) < new Date();
                    const PermIcon = PERM_META[s.permission as SharePermission].icon;
                    return (
                      <div key={s.id} className="py-2 flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <PermIcon className="w-3 h-3 text-muted-foreground" />
                            <p className="text-xs font-mono truncate text-foreground">{shareUrl(s.token)}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {s.deliverable_keys.length} deliverable{s.deliverable_keys.length === 1 ? "" : "s"} ·{" "}
                            {s.view_count} view{s.view_count === 1 ? "" : "s"}
                            {s.expires_at && ` · Expires ${new Date(s.expires_at).toLocaleDateString()}`}
                            {revoked && " · Revoked"}
                            {expired && !revoked && " · Expired"}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            await navigator.clipboard.writeText(shareUrl(s.token));
                            toast({ title: "Copied" });
                          }}
                          disabled={revoked}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => window.open(shareUrl(s.token), "_blank")}
                          disabled={revoked}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                        {!revoked && (
                          <Button size="icon" variant="ghost" onClick={() => handleRevoke(s.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
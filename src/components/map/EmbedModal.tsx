import { useState } from "react";
import { Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmbedModalProps {
  projectId: string;
  onClose: () => void;
}

export default function EmbedModal({ projectId, onClose }: EmbedModalProps) {
  const [width, setWidth] = useState("800");
  const [height, setHeight] = useState("600");
  const [copied, setCopied] = useState(false);

  const url = `${window.location.origin}/viewer/${projectId}`;
  const code = `<iframe src="${url}" width="${width}" height="${height}" frameborder="0" allowfullscreen></iframe>`;

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="absolute inset-0 z-[1100] flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-700 text-foreground">Embed Map</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Width (px)</Label>
            <Input value={width} onChange={(e) => setWidth(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Height (px)</Label>
            <Input value={height} onChange={(e) => setHeight(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Embed Code</Label>
          <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground font-mono break-all select-all">
            {code}
          </div>
        </div>

        <div className="bg-muted/50 rounded-xl overflow-hidden border border-border">
          <div className="text-xs text-muted-foreground p-2 text-center">Preview</div>
          <iframe src={url} width="100%" height="200" className="border-t border-border" />
        </div>

        <Button onClick={copy} className="w-full gap-2 bg-primary text-primary-foreground">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy Embed Code"}
        </Button>
      </div>
    </div>
  );
}

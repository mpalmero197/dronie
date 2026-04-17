import { useState, useRef } from "react";
import { Radio, Link2, Upload, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type StreamMode = "none" | "webrtc" | "url" | "upload";

interface StreamSourcePickerProps {
  value: { mode: StreamMode; url?: string; demoPath?: string };
  onChange: (v: { mode: StreamMode; url?: string; demoPath?: string }) => void;
}

export default function StreamSourcePicker({ value, onChange }: StreamSourcePickerProps) {
  const { toast } = useToast();
  const [showAdvanced, setShowAdvanced] = useState(value.mode === "url");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tiles: { mode: StreamMode; icon: typeof Radio; title: string; desc: string }[] = [
    { mode: "webrtc", icon: Radio, title: "Phone Broadcast", desc: "Pilot's phone shares the live feed — no setup needed" },
    { mode: "upload", icon: Upload, title: "Demo Clip", desc: "Upload an MP4 to use as a placeholder feed" },
  ];

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `demos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("drone-demos").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("drone-demos").getPublicUrl(path);
      onChange({ mode: "upload", demoPath: path, url: data.publicUrl });
      toast({ title: "Demo clip uploaded", description: file.name });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Camera Source</Label>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(({ mode, icon: Icon, title, desc }) => {
          const selected = value.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ mode })}
              className={`relative text-left p-3 rounded-lg border-2 transition-all ${
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 bg-card"
              }`}
            >
              {selected && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </span>
              )}
              <Icon className="w-4 h-4 text-primary mb-1.5" />
              <p className="text-xs font-semibold text-foreground">{title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{desc}</p>
            </button>
          );
        })}
      </div>

      {value.mode === "upload" && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full gap-1.5"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {value.demoPath ? "Replace clip" : uploading ? "Uploading…" : "Choose video file"}
          </Button>
          {value.demoPath && (
            <p className="text-[10px] text-muted-foreground mt-1 truncate">✓ {value.demoPath.split("/").pop()}</p>
          )}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Link2 className="w-3 h-3" />
          {showAdvanced ? "Hide" : "Advanced:"} use stream URL (RTSP, HLS, WebRTC gateway)
        </button>
        {showAdvanced && (
          <div className="mt-2 space-y-1">
            <Input
              value={value.url ?? ""}
              onChange={(e) => onChange({ mode: "url", url: e.target.value })}
              placeholder="rtsp:// or https://...m3u8"
              className="text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              For dedicated hardware encoders or existing stream infrastructure.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

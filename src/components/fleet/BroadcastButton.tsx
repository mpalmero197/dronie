import { useEffect, useMemo, useRef, useState } from "react";
import { Radio, Square, Camera, Monitor, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { startBroadcast, type BroadcastHandle, type BroadcastSource } from "@/lib/webrtcBroadcast";
import type { Drone } from "@/lib/fleet-types";

interface BroadcastButtonProps {
  drone: Drone;
  compact?: boolean;
}

/** True when the browser actually supports `getDisplayMedia` (screen sharing).
 * iOS Safari/Chrome/Firefox all return false here — Apple has never shipped it. */
function supportsScreenShare(): boolean {
  return typeof navigator !== "undefined"
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getDisplayMedia === "function";
}

/** Detect iOS so we can show a tailored hint. */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

export default function BroadcastButton({ drone, compact = false }: BroadcastButtonProps) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [handle, setHandle] = useState<BroadcastHandle | null>(null);
  const [starting, setStarting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const previewRef = useRef<HTMLVideoElement>(null);

  const isAssigned = user && (drone.assigned_pilot_id === user.id || isAdmin);
  const isLive = !!handle;

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      handle?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (handle && previewRef.current) {
      previewRef.current.srcObject = handle.stream;
    }
  }, [handle]);

  const screenShareAvailable = useMemo(supportsScreenShare, []);
  const onIOS = useMemo(isIOS, []);

  const start = async (source: BroadcastSource) => {
    setShowPicker(false);
    setStarting(true);
    try {
      if (source === "screen" && !screenShareAvailable) {
        throw new Error(
          onIOS
            ? "iOS doesn't support browser screen sharing. Use Phone Camera mode instead — point your phone at the controller screen."
            : "Your browser doesn't support screen sharing. Try Chrome on Android, or use Phone Camera mode.",
        );
      }
      const h = await startBroadcast(drone.id, source);
      setHandle(h);
      toast({
        title: "🔴 Broadcasting live",
        description: `${drone.name} feed is now visible to your team.`,
      });
    } catch (err: unknown) {
      const e = err as Error & { name?: string };
      let title = "Couldn't start broadcast";
      let description = e?.message ?? "Permission denied.";
      if (e?.name === "NotAllowedError") {
        title = "Permission denied";
        description =
          source === "camera"
            ? "Allow camera access in your browser settings, then try again."
            : "Allow screen sharing, then try again.";
      } else if (e?.name === "NotFoundError") {
        title = "No camera found";
        description = "Plug in a camera or USB capture device, then retry.";
      } else if (e?.name === "NotReadableError") {
        title = "Camera in use";
        description = "Another app is using the camera. Close it and try again.";
      }
      toast({ title, description, variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const stop = () => {
    handle?.stop();
    setHandle(null);
    toast({ title: "Broadcast ended", description: `${drone.name} feed is offline.` });
  };

  if (!isAssigned) return null;

  if (isLive) {
    return (
      <div className={compact ? "space-y-2" : "space-y-3"}>
        <div className="relative rounded-lg overflow-hidden bg-black">
          <video
            ref={previewRef}
            autoPlay
            muted
            playsInline
            className={compact ? "w-full h-24 object-cover" : "w-full h-32 object-cover"}
          />
          <span className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive text-white text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        </div>
        <Button onClick={stop} variant="destructive" size={compact ? "sm" : "default"} className="w-full gap-1.5">
          <Square className="w-3.5 h-3.5" /> Stop Broadcast
        </Button>
      </div>
    );
  }

  if (showPicker) {
    return (
      <div className="space-y-2 p-3 rounded-lg border border-border bg-card">
        <p className="text-xs font-medium text-foreground">Choose broadcast source</p>
        <Button
          onClick={() => start("camera")}
          variant="outline"
          size="sm"
          className="w-full gap-2 justify-start"
          disabled={starting}
        >
          <Camera className="w-4 h-4" />
          <div className="text-left flex-1">
            <p className="text-xs font-semibold">Phone Camera</p>
            <p className="text-[10px] text-muted-foreground">Use rear camera or USB capture device</p>
          </div>
        </Button>
        <Button
          onClick={() => start("screen")}
          variant="outline"
          size="sm"
          className="w-full gap-2 justify-start"
          disabled={starting}
        >
          <Monitor className="w-4 h-4" />
          <div className="text-left flex-1">
            <p className="text-xs font-semibold">Screen Share</p>
            <p className="text-[10px] text-muted-foreground">Mirror DJI Fly app or controller screen</p>
          </div>
        </Button>
        <Button onClick={() => setShowPicker(false)} variant="ghost" size="sm" className="w-full">
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => setShowPicker(true)}
      size={compact ? "sm" : "default"}
      className="w-full gap-1.5"
      disabled={starting}
    >
      {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
      {starting ? "Starting…" : "Broadcast Camera"}
    </Button>
  );
}

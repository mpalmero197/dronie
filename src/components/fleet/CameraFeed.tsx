import { Video, VideoOff, Maximize2, Volume2, VolumeX, Radio } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Drone } from "@/lib/fleet-types";
import { joinBroadcast, type ViewerHandle } from "@/lib/webrtcBroadcast";

interface CameraFeedProps {
  drone: Drone;
  compact?: boolean;
}

export default function CameraFeed({ drone, compact = false }: CameraFeedProps) {
  const [muted, setMuted] = useState(true);
  const [, setFullscreen] = useState(false);
  const [webrtcState, setWebrtcState] = useState<RTCPeerConnectionState | "waiting">("waiting");
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerRef = useRef<ViewerHandle | null>(null);

  const streamMode = (drone as any).stream_mode as string | undefined;
  const isWebRTC = streamMode === "webrtc";
  const hasStream = isWebRTC || !!drone.stream_url;

  // WebRTC subscription
  useEffect(() => {
    if (!isWebRTC) return;
    const v = joinBroadcast(drone.id);
    viewerRef.current = v;
    v.onStream((stream) => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
    v.onState((s) => setWebrtcState(s));
    return () => {
      v.stop();
      viewerRef.current = null;
    };
  }, [isWebRTC, drone.id]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setFullscreen(false);
    } else {
      containerRef.current.requestFullscreen();
      setFullscreen(true);
    }
  };

  if (!hasStream) {
    return (
      <div className={`bg-muted/50 border border-border rounded-xl flex flex-col items-center justify-center gap-2 ${compact ? "h-32" : "h-48"}`}>
        <VideoOff className="w-6 h-6 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground/60">No camera feed</p>
        <p className="text-[10px] text-muted-foreground/40">{drone.name}</p>
      </div>
    );
  }

  // Detect stream type from URL (for non-webrtc)
  const isHLS = drone.stream_url?.includes(".m3u8");
  const isDirectVideo = drone.stream_url ? /\.(mp4|webm|ogg)/.test(drone.stream_url) : false;

  return (
    <div ref={containerRef} className={`relative bg-black rounded-xl overflow-hidden group ${compact ? "h-32" : "h-48"}`}>
      {isWebRTC ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            muted={muted}
            playsInline
            className="w-full h-full object-cover"
          />
          {webrtcState !== "connected" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
              <Radio className="w-6 h-6 text-muted-foreground animate-pulse" />
              <p className="text-xs text-muted-foreground">
                {webrtcState === "waiting" || webrtcState === "new" ? "Waiting for pilot to broadcast…" : `Connecting (${webrtcState})…`}
              </p>
            </div>
          )}
        </>
      ) : (isDirectVideo || isHLS) ? (
        <video
          src={drone.stream_url!}
          autoPlay
          muted={muted}
          loop={isDirectVideo}
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <iframe
          src={drone.stream_url!}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen"
          title={`${drone.name} camera feed`}
        />
      )}

      {/* Overlay controls */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/80 text-white text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
            <span className="text-white text-[10px] font-medium">{drone.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMuted(!muted)}
              className="p-1 rounded hover:bg-white/20 text-white transition-colors"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1 rounded hover:bg-white/20 text-white transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Status indicator */}
      <div className="absolute top-2 left-2">
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur text-white text-[10px]">
          <Video className="w-3 h-3" />
          {isWebRTC ? "WebRTC" : isHLS ? "HLS" : isDirectVideo ? "Video" : "Stream"}
        </span>
      </div>
    </div>
  );
}

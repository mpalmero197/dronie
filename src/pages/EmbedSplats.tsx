import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "project-outputs";

function detectFormat(name: string): "ply" | "splat" | "ksplat" {
  const l = name.toLowerCase();
  if (l.endsWith(".ksplat")) return "ksplat";
  if (l.endsWith(".splat")) return "splat";
  return "ply";
}

export default function EmbedSplats() {
  const { token } = useParams<{ token: string }>();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!token) throw new Error("Missing share token");
        const { data: share, error: shareErr } = await supabase
          .from("splat_shares")
          .select("asset_path, asset_name, expires_at")
          .eq("token", token)
          .maybeSingle();
        if (shareErr) throw shareErr;
        if (!share) throw new Error("This link has expired or is invalid.");

        const url = supabase.storage.from(BUCKET).getPublicUrl(share.asset_path).data.publicUrl;
        setName(share.asset_name ?? share.asset_path.split("/").pop() ?? "scene");

        const GS = await import("@mkkellogg/gaussian-splats-3d");
        if (cancelled || !containerRef.current) return;

        const fmt = detectFormat(share.asset_name ?? share.asset_path);
        const formatEnum =
          fmt === "ksplat" ? GS.SceneFormat.KSplat :
          fmt === "splat"  ? GS.SceneFormat.Splat  : GS.SceneFormat.Ply;

        const viewer = new GS.Viewer({
          rootElement: containerRef.current,
          cameraUp: [0, -1, -0.6],
          initialCameraPosition: [-1, -4, 6],
          initialCameraLookAt: [0, 1, 0],
          sharedMemoryForWorkers: false,
          gpuAcceleratedSort: true,
          sphericalHarmonicsDegree: 2,
        });
        viewerRef.current = viewer;
        await viewer.addSplatScene(url, {
          format: formatEnum,
          showLoadingUI: true,
          progressiveLoad: true,
        });
        if (cancelled) return;
        viewer.start();
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      try { viewerRef.current?.dispose?.(); } catch { /* ignore */ }
      viewerRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-[hsl(220_30%_8%)] text-foreground relative">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-full bg-background/70 backdrop-blur px-3 py-1.5 text-xs">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="font-mono truncate max-w-[40vw]">{name || "splat scene"}</span>
      </div>
      <a
        href="/"
        className="absolute top-3 right-3 z-10 rounded-full bg-background/70 backdrop-blur px-3 py-1.5 text-[11px] hover:bg-background"
      >
        Powered by Dronie
      </a>

      {status === "loading" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading scene…
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
          <div className="max-w-sm rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold text-destructive mb-1">
              <AlertCircle className="w-4 h-4" /> Cannot load scene
            </div>
            <p className="text-muted-foreground text-xs break-words">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

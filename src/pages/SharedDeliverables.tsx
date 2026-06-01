import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Lock, Package, Eye, MessageSquare, Download, AlertTriangle, Map as MapIcon } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { DeliverableCard } from "@/components/project/DeliverableCard";
import { Badge } from "@/components/ui/badge";

interface SharePayload {
  share_id: string;
  project_id: string;
  project_name: string;
  owner_username: string | null;
  permission: "view" | "comment" | "download";
  deliverable_keys: string[];
  outputs_urls: Record<string, string> | null;
  outputs: string[] | null;
  expires_at: string | null;
}

const OUTPUT_META: Record<string, { ext: string; desc: string; key: string }> = {
  Orthomosaic: { ext: ".png", desc: "Georeferenced composite image", key: "orthomosaic" },
  GeoTIFF: { ext: ".tif", desc: "Georeferenced orthomosaic", key: "orthomosaic" },
  "LAZ Point Cloud": { ext: ".laz", desc: "3D dense point cloud", key: "pointcloud" },
  DSM: { ext: ".asc", desc: "Digital Surface Model", key: "dsm" },
  DTM: { ext: ".asc", desc: "Digital Terrain Model", key: "dtm" },
  "Contours GeoJSON": { ext: ".geojson", desc: "Elevation contour lines", key: "contours" },
  "Contours SHP": { ext: ".shp", desc: "Contour lines shapefile", key: "contours" },
  "Flight Report PDF": { ext: ".pdf", desc: "Processing report & accuracy", key: "report" },
  "All Assets (ZIP)": { ext: ".zip", desc: "Complete output archive", key: "all_assets" },
};

const PERM_META = {
  view: { Icon: Eye, label: "View only" },
  comment: { Icon: MessageSquare, label: "View & comment" },
  download: { Icon: Download, label: "Download enabled" },
} as const;

/**
 * Public viewer for tokens issued by DeliverableShareDialog.
 * Resolves token via SECURITY DEFINER RPC (anon-safe) and bumps view counter.
 */
export default function SharedDeliverables() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rows, error: e } = await supabase.rpc("get_share_payload", { _token: token });
      if (cancelled) return;
      if (e) {
        setError(e.message);
      } else if (!rows || rows.length === 0) {
        setError("This share link is invalid, expired, or has been revoked.");
      } else {
        setData(rows[0] as SharePayload);
        // Fire-and-forget view counter bump
        void supabase.rpc("bump_share_view", { _token: token }).then(() => {}, () => {});
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Resolving share…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md text-center rounded-2xl border border-border bg-card p-8">
          <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-xl font-display font-700 text-foreground">Share unavailable</h1>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
          <Link to="/" className="text-sm text-primary mt-4 inline-block hover:underline">Back to Dronie</Link>
        </div>
      </div>
    );
  }

  const perm = PERM_META[data.permission];
  const PermIcon = perm.Icon;
  const allowDownload = data.permission === "download";

  // Map outputs (display names) → only those whose key is in the allow-list with a URL
  const visibleOutputs = (data.outputs ?? []).filter((name) => {
    const meta = OUTPUT_META[name];
    if (!meta) return false;
    return data.deliverable_keys.includes(meta.key) && data.outputs_urls?.[meta.key];
  });

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{data.project_name} — Shared deliverables · Dronie</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-700 text-foreground text-lg">{data.project_name}</h1>
              <p className="text-xs text-muted-foreground">
                Shared by {data.owner_username ? `@${data.owner_username}` : "a Dronie pilot"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-[10px] uppercase">
              <PermIcon className="w-3 h-3" /> {perm.label}
            </Badge>
            {data.expires_at && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                Expires {new Date(data.expires_at).toLocaleDateString()}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {visibleOutputs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
            <p className="text-foreground font-semibold">No deliverables ready yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              The pilot may still be processing this project. Check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleOutputs.map((name) => {
              const meta = OUTPUT_META[name];
              const url = data.outputs_urls?.[meta.key];
              return (
                <DeliverableCard
                  key={name}
                  name={name}
                  description={meta.desc}
                  kind={meta.key as any}
                  downloadUrl={allowDownload ? url : null}
                  previewUrl={meta.key === "orthomosaic" ? url : undefined}
                />
              );
            })}
          </div>
        )}

        <div className="mt-10 rounded-xl border border-border bg-card/60 p-4 flex items-start gap-3">
          <MapIcon className="w-4 h-4 text-primary mt-0.5" />
          <div className="text-xs text-muted-foreground">
            Powered by{" "}
            <Link to="/" className="text-primary hover:underline font-semibold">Dronie</Link> —
            the all-in-one drone photogrammetry platform. This link was generated by the project owner and may be revoked at any time.
          </div>
        </div>
      </main>
    </div>
  );
}
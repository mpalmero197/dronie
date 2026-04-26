import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Grid, useGLTF } from "@react-three/drei";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import * as THREE from "three";
import {
  ArrowLeft, FolderOpen, Layers, Loader2, RefreshCw, FileBox, Eye, EyeOff,
  AlertCircle, Download, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ProjectOpt { id: string; name: string; }
interface Asset { name: string; url: string; size: number; mime: string; kind: "ply" | "glb" | "obj" | "other"; }

function detectKind(name: string): Asset["kind"] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".ply")) return "ply";
  if (lower.endsWith(".glb") || lower.endsWith(".gltf")) return "glb";
  if (lower.endsWith(".obj")) return "obj";
  return "other";
}

function PlyCloud({ url, pointSize, color }: { url: string; pointSize: number; color: string }) {
  const geom = useLoader(PLYLoader as unknown as typeof THREE.Loader, url) as unknown as THREE.BufferGeometry;
  const positions = geom.getAttribute("position");
  const hasColors = geom.hasAttribute("color");

  // recenter
  const centered = useMemo(() => {
    geom.computeBoundingBox();
    const c = new THREE.Vector3();
    geom.boundingBox?.getCenter(c);
    geom.translate(-c.x, -c.y, -c.z);
    geom.computeBoundingSphere();
    return geom;
  }, [geom]);

  if (!positions) return null;
  return (
    <points>
      <primitive object={centered} attach="geometry" />
      <pointsMaterial
        vertexColors={hasColors}
        color={hasColors ? undefined : new THREE.Color(color)}
        size={pointSize}
        sizeAttenuation
      />
    </points>
  );
}

function GlbModel({ url }: { url: string }) {
  const gltf = useGLTF(url);
  return <primitive object={gltf.scene} />;
}

export default function RealityCapture() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [pointSize, setPointSize] = useState([0.04]);
  const [showGrid, setShowGrid] = useState(true);
  const [meshColor, setMeshColor] = useState("hsl(152 52% 42%)");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Fetch user projects
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .order("created_at", { ascending: false });
      setProjects((data ?? []) as ProjectOpt[]);
      if (data && data.length > 0 && !projectId) setProjectId(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch project-outputs assets for selected project
  const refresh = async (pid: string) => {
    if (!pid) { setAssets([]); setSelectedAsset(null); return; }
    setLoading(true);
    setRenderError(null);
    const { data, error } = await supabase.storage
      .from("project-outputs")
      .list(pid, { limit: 100, sortBy: { column: "name", order: "asc" } });
    if (error || !data) {
      setAssets([]);
      setLoading(false);
      return;
    }
    const eligible = data
      .filter((f) => /\.(ply|glb|gltf|obj)$/i.test(f.name))
      .map((f): Asset => {
        const url = supabase.storage.from("project-outputs").getPublicUrl(`${pid}/${f.name}`).data.publicUrl;
        return {
          name: f.name,
          url,
          size: f.metadata?.size ?? 0,
          mime: f.metadata?.mimetype ?? "application/octet-stream",
          kind: detectKind(f.name),
        };
      });
    setAssets(eligible);
    setSelectedAsset(eligible[0] ?? null);
    setLoading(false);
  };

  useEffect(() => { refresh(projectId); }, [projectId]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) { navigate("/auth"); return null; }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-display font-700 truncate">Reality Capture · 3D Viewer</h1>
              <p className="text-xs text-muted-foreground truncate">Real point clouds and meshes from your project outputs</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => { refresh(projectId); setReloadKey((k) => k + 1); }} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Project + asset picker */}
        <div className="rounded-2xl border border-border bg-card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-primary" /> Project
            </label>
            {projects.length === 0 ? (
              <Button size="sm" variant="outline" onClick={() => navigate("/dashboard")} className="w-full">
                Create your first project
              </Button>
            ) : (
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <FileBox className="w-3.5 h-3.5 text-primary" /> 3D output
            </label>
            {assets.length === 0 ? (
              <div className="h-9 px-3 flex items-center text-sm text-muted-foreground border border-dashed border-border rounded-md">
                {loading ? "Loading…" : "No .ply / .glb / .obj outputs yet"}
              </div>
            ) : (
              <Select value={selectedAsset?.name ?? ""} onValueChange={(n) => setSelectedAsset(assets.find((a) => a.name === n) ?? null)}>
                <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                <SelectContent>
                  {assets.map((a) => (
                    <SelectItem key={a.name} value={a.name}>
                      {a.name} · {(a.size / 1024 / 1024).toFixed(1)} MB
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
          {/* 3D viewport */}
          <div className="space-y-4">
            <div className="relative rounded-2xl border border-border overflow-hidden bg-[hsl(220_30%_8%)] aspect-[16/10] sm:aspect-[16/9]">
              {!selectedAsset ? (
                <EmptyState projectId={projectId} navigate={navigate} />
              ) : (
                <Canvas key={`${selectedAsset.url}-${reloadKey}`} camera={{ position: [4, 3, 6], fov: 55 }} className="absolute inset-0">
                  <ambientLight intensity={0.6} />
                  <directionalLight position={[10, 12, 8]} intensity={1.0} />
                  <Suspense fallback={null}>
                    {selectedAsset.kind === "ply" && (
                      <ErrorBoundary onError={setRenderError}>
                        <PlyCloud url={selectedAsset.url} pointSize={pointSize[0]} color={meshColor} />
                      </ErrorBoundary>
                    )}
                    {selectedAsset.kind === "glb" && (
                      <ErrorBoundary onError={setRenderError}>
                        <GlbModel url={selectedAsset.url} />
                      </ErrorBoundary>
                    )}
                    {selectedAsset.kind !== "ply" && selectedAsset.kind !== "glb" && (
                      <PlaceholderBox color={meshColor} />
                    )}
                  </Suspense>
                  {showGrid && (
                    <Grid args={[40, 40]} cellSize={1} cellColor={"#3a4a5e"} sectionColor={"#5a7d8c"} fadeDistance={32} position={[0, -2, 0]} infiniteGrid />
                  )}
                  <OrbitControls enableDamping makeDefault />
                </Canvas>
              )}

              {selectedAsset && (
                <div className="absolute top-3 left-3 right-3 flex justify-between pointer-events-none">
                  <div className="bg-black/55 backdrop-blur text-white text-[11px] font-mono rounded-lg px-2.5 py-1.5 max-w-[60%] truncate">
                    📦 {selectedAsset.name}
                  </div>
                  <div className="bg-black/55 backdrop-blur text-white text-[11px] font-mono rounded-lg px-2.5 py-1.5 uppercase">
                    {selectedAsset.kind}
                  </div>
                </div>
              )}

              {renderError && (
                <div className="absolute bottom-3 left-3 right-3 bg-destructive/90 text-destructive-foreground text-xs rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  Couldn't render this file: {renderError}
                </div>
              )}

              {selectedAsset && !renderError && (
                <div className="absolute bottom-3 right-3 bg-black/55 backdrop-blur text-white text-[11px] font-mono rounded-lg px-2.5 py-1.5 pointer-events-none">
                  Drag to orbit · Scroll to zoom
                </div>
              )}
            </div>

            {selectedAsset && (
              <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {(selectedAsset.size / 1024 / 1024).toFixed(2)} MB · streamed from your project storage
                </div>
                <a href={selectedAsset.url} download={selectedAsset.name}>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Download className="w-4 h-4" /> Download
                  </Button>
                </a>
              </div>
            )}
          </div>

          {/* Controls */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-5">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Viewer</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm">Show ground grid</span>
                <Switch checked={showGrid} onCheckedChange={setShowGrid} />
              </div>
              {selectedAsset?.kind === "ply" && (
                <>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-muted-foreground">Point size</span>
                      <span className="font-mono font-semibold">{pointSize[0].toFixed(2)}</span>
                    </div>
                    <Slider value={pointSize} onValueChange={setPointSize} min={0.01} max={0.2} step={0.01} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Tint (when PLY has no vertex color)</p>
                    <div className="flex gap-2">
                      {[
                        ["Forest", "hsl(152 52% 42%)"],
                        ["Amber", "hsl(38 95% 52%)"],
                        ["Sky", "hsl(202 85% 48%)"],
                        ["Mono", "hsl(220 5% 75%)"],
                      ].map(([n, c]) => (
                        <button
                          key={n}
                          onClick={() => setMeshColor(c)}
                          className={`flex-1 h-8 rounded-md border-2 transition-all ${meshColor === c ? "border-foreground scale-105" : "border-transparent opacity-70"}`}
                          style={{ background: c }}
                          title={n}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-secondary/40 p-4 text-xs text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground text-sm">What's loaded</p>
              <p>This viewer reads <code>.ply</code>, <code>.glb</code>, <code>.gltf</code>, and <code>.obj</code> files from your project's <code>project-outputs</code> bucket. Run a project through processing to generate them, or drop an output file in via the Project Detail page.</p>
              <Link to={projectId ? `/project/${projectId}` : "/dashboard"} className="inline-flex items-center gap-1.5 text-primary mt-2 hover:underline">
                <Upload className="w-3.5 h-3.5" /> Open project
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ projectId, navigate }: { projectId: string; navigate: (p: string) => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-center p-6">
      <div className="space-y-3 max-w-sm">
        <FileBox className="w-12 h-12 mx-auto text-muted-foreground" />
        <h3 className="font-display font-700 text-foreground">No 3D output yet</h3>
        <p className="text-sm text-muted-foreground">
          When this project finishes processing, generated <code>.ply</code> point clouds and <code>.glb</code> meshes will appear here automatically.
        </p>
        {projectId && (
          <Button size="sm" variant="outline" onClick={() => navigate(`/project/${projectId}`)}>
            Open project
          </Button>
        )}
      </div>
    </div>
  );
}

function PlaceholderBox({ color }: { color: string }) {
  return (
    <mesh>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// Minimal error boundary to prevent the whole canvas from crashing on a bad file
import React from "react";
class ErrorBoundary extends React.Component<{ children: React.ReactNode; onError: (m: string) => void }, { failed: boolean }> {
  state = { failed: false };
  componentDidCatch(err: Error) {
    this.props.onError(err.message);
    this.setState({ failed: true });
  }
  render() { return this.state.failed ? null : this.props.children; }
}

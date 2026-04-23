import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Stats } from "@react-three/drei";
import * as THREE from "three";
import {
  ArrowLeft, Camera, Eye, EyeOff, Layers, Maximize2, RefreshCw, Sparkles, Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

// Live-growing point cloud → simulates edge meshing arriving in chunks
function GrowingCloud({ density, speed, color }: { density: number; speed: number; color: string }) {
  const ref = useRef<THREE.Points>(null);
  const totalRef = useRef(0);

  // pre-generate a deterministic terrain-like cloud
  const { positions, colors } = useMemo(() => {
    const N = 12000;
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 20;
      // gentle terrain noise
      const y =
        Math.sin(x * 0.4) * 0.6 +
        Math.cos(z * 0.5) * 0.5 +
        Math.sin((x + z) * 0.18) * 0.9;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      const shade = 0.55 + (y + 2) / 6;
      colors[i * 3] = c.r * shade;
      colors[i * 3 + 1] = c.g * shade;
      colors[i * 3 + 2] = c.b * shade;
    }
    return { positions, colors };
  }, [color]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    totalRef.current = Math.min(positions.length / 3, totalRef.current + delta * 1500 * speed);
    const target = Math.floor(totalRef.current * (density / 100));
    const geom = ref.current.geometry as THREE.BufferGeometry;
    geom.setDrawRange(0, target);
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial vertexColors size={0.06} sizeAttenuation />
    </points>
  );
}

function CameraRig({ rotate }: { rotate: boolean }) {
  useFrame(({ camera, clock }) => {
    if (!rotate) return;
    const t = clock.getElapsedTime() * 0.15;
    camera.position.x = Math.sin(t) * 18;
    camera.position.z = Math.cos(t) * 18;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function RealityCapture() {
  const [density, setDensity] = useState([85]);
  const [speed, setSpeed] = useState([1]);
  const [showGrid, setShowGrid] = useState(true);
  const [arMode, setArMode] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [reset, setReset] = useState(0);
  const [meshColor, setMeshColor] = useState("hsl(152 52% 42%)");
  const [latency, setLatency] = useState(120);

  // simulated network latency / coverage gauges
  useEffect(() => {
    const id = setInterval(() => setLatency(80 + Math.round(Math.random() * 220)), 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-display font-700 truncate">Reality Capture · Live Mesh</h1>
              <p className="text-xs text-muted-foreground truncate">Edge-computed point cloud streaming with AR verification</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => { setReset((r) => r + 1); }} className="gap-1.5">
              <RefreshCw className="w-4 h-4" /> Restart
            </Button>
            <Button size="sm" onClick={() => setArMode((v) => !v)} variant={arMode ? "default" : "outline"} className="gap-1.5">
              {arMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {arMode ? "Exit AR" : "AR View"}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* 3D + AR viewport */}
        <div className="space-y-4">
          <div className="relative rounded-2xl border border-border overflow-hidden bg-[hsl(220_30%_8%)] aspect-[16/10] sm:aspect-[16/9]">
            {/* Simulated AR camera background */}
            {arMode && <ARBackdrop />}
            <Canvas key={reset} camera={{ position: [12, 8, 14], fov: 50 }} className="absolute inset-0">
              <ambientLight intensity={0.55} />
              <directionalLight position={[10, 15, 8]} intensity={1.1} />
              <Suspense fallback={null}>
                <GrowingCloud density={density[0]} speed={speed[0]} color={meshColor} />
              </Suspense>
              {showGrid && !arMode && (
                <Grid
                  args={[40, 40]}
                  cellSize={1}
                  cellColor={"#3a4a5e"}
                  sectionColor={"#5a7d8c"}
                  fadeDistance={32}
                  position={[0, -2, 0]}
                  infiniteGrid
                />
              )}
              <CameraRig rotate={autoRotate} />
              <OrbitControls enableDamping makeDefault enabled={!autoRotate} />
            </Canvas>

            {/* HUD overlays */}
            <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none">
              <div className="bg-black/55 backdrop-blur text-white text-[11px] font-mono rounded-lg px-2.5 py-1.5 space-y-0.5">
                <p>📡 Edge link · {latency} ms</p>
                <p>📐 Cloud density · {density[0]}%</p>
              </div>
              {arMode && (
                <div className="bg-accent/90 text-accent-foreground text-[11px] font-bold rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 animate-pulse">
                  <Camera className="w-3.5 h-3.5" /> AR ACTIVE
                </div>
              )}
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none">
              <div className="bg-black/55 backdrop-blur text-white text-[11px] font-mono rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-primary" /> Signal: strong
              </div>
              <div className="bg-black/55 backdrop-blur text-white text-[11px] font-mono rounded-lg px-2.5 py-1.5">
                Drag to orbit · Scroll to zoom
              </div>
            </div>
          </div>

          {/* Coverage strip */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> Spatial coverage</h3>
              <span className="text-xs text-muted-foreground">Updates as the mesh grows</span>
            </div>
            <CoverageStrip percent={Math.min(100, density[0])} />
          </div>
        </div>

        {/* Controls */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-5">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Viewer</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm">Show ground grid</span>
              <Switch checked={showGrid} onCheckedChange={setShowGrid} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Auto-orbit</span>
              <Switch checked={autoRotate} onCheckedChange={setAutoRotate} />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground">Density</span>
                <span className="font-mono font-semibold">{density[0]}%</span>
              </div>
              <Slider value={density} onValueChange={setDensity} min={20} max={100} step={5} />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground">Stream rate</span>
                <span className="font-mono font-semibold">{speed[0].toFixed(1)}×</span>
              </div>
              <Slider value={speed} onValueChange={setSpeed} min={0.2} max={3} step={0.1} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Point color</p>
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
          </div>

          <div className="rounded-2xl border border-border bg-secondary/40 p-4 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground text-sm">Edge meshing</p>
            <p>Point chunks arrive over the air, are densified on-device, then streamed back as a low-res preview while the cloud is still being captured.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ARBackdrop() {
  // simulated camera feed: scrolling gradient bars to feel like a viewfinder
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(202_85%_30%)_0%,hsl(152_52%_22%)_60%,hsl(38_95%_22%)_100%)]" />
      <div className="absolute inset-0 opacity-40 mix-blend-overlay bg-[repeating-linear-gradient(0deg,transparent_0_3px,rgba(255,255,255,0.08)_3px_4px)]" />
      <div className="absolute inset-0 ring-2 ring-accent/40 ring-inset" />
      {/* corner brackets */}
      {[
        "top-3 left-3 border-t-2 border-l-2",
        "top-3 right-3 border-t-2 border-r-2",
        "bottom-3 left-3 border-b-2 border-l-2",
        "bottom-3 right-3 border-b-2 border-r-2",
      ].map((c) => (
        <span key={c} className={`absolute w-6 h-6 border-accent ${c}`} />
      ))}
    </div>
  );
}

function CoverageStrip({ percent }: { percent: number }) {
  const cells = 30;
  const filled = Math.round((percent / 100) * cells);
  return (
    <div className="grid grid-cols-15 sm:grid-cols-30 gap-1" style={{ gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))` }}>
      {Array.from({ length: cells }).map((_, i) => (
        <div
          key={i}
          className={`h-3 rounded-sm transition-colors ${
            i < filled ? "bg-primary" : "bg-secondary"
          }`}
        />
      ))}
    </div>
  );
}

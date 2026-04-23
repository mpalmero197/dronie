import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Battery, BatteryWarning, Pause, Play, Plane, RotateCcw,
  Shuffle, Wind, CloudRain, Sun, Layers, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Phase = "ready" | "flying" | "rtb" | "landed";

interface SwarmDrone {
  id: string;
  name: string;
  color: string;
  battery: number;
  phase: Phase;
  pathIndex: number;          // current waypoint index along its assigned segment
  segmentStart: number;       // global waypoint start index
  segmentEnd: number;         // global waypoint end index (exclusive)
  pos: { x: number; y: number };
  failoverFrom?: string | null;
}

interface Waypoint { x: number; y: number; }

// ─────────────────────────────────────────────────────────────────────────────
// Path generation – serpentine grid inside a polygon area
// ─────────────────────────────────────────────────────────────────────────────

function buildSerpentine(width: number, height: number, lines: number, padding = 24): Waypoint[] {
  const inner = { x: padding, y: padding, w: width - padding * 2, h: height - padding * 2 };
  const stepY = inner.h / (lines - 1);
  const pts: Waypoint[] = [];
  for (let i = 0; i < lines; i++) {
    const y = inner.y + i * stepY;
    const ltr = i % 2 === 0;
    const a = { x: inner.x, y };
    const b = { x: inner.x + inner.w, y };
    // sample each line into ~24 sub-points for smoother motion
    const samples = 24;
    for (let s = 0; s <= samples; s++) {
      const t = s / samples;
      pts.push({
        x: ltr ? a.x + (b.x - a.x) * t : b.x + (a.x - b.x) * t,
        y,
      });
    }
  }
  return pts;
}

const PALETTE = [
  "hsl(152 52% 32%)",      // primary green
  "hsl(38 95% 52%)",       // amber
  "hsl(202 85% 48%)",      // sky
  "hsl(280 60% 55%)",      // purple
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SwarmOrchestration() {
  const VIEW_W = 720;
  const VIEW_H = 460;

  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState([1.5]);
  const [windKts, setWindKts] = useState([8]);
  const [precip, setPrecip] = useState([10]);
  const [autoFailover, setAutoFailover] = useState(true);
  const [dynamicReplan, setDynamicReplan] = useState(true);
  const [lines, setLines] = useState([6]);

  const waypoints = useMemo(() => buildSerpentine(VIEW_W, VIEW_H, lines[0]), [lines]);

  // segment splitting per drone
  const initialDrones = (count: number): SwarmDrone[] => {
    const per = Math.floor(waypoints.length / count);
    return Array.from({ length: count }).map((_, i) => {
      const start = i * per;
      const end = i === count - 1 ? waypoints.length : start + per;
      return {
        id: `D-${i + 1}`,
        name: `Hawk-${i + 1}`,
        color: PALETTE[i % PALETTE.length],
        battery: 100 - i * 5,
        phase: "flying" as Phase,
        pathIndex: start,
        segmentStart: start,
        segmentEnd: end,
        pos: waypoints[start],
        failoverFrom: null,
      };
    });
  };

  const [drones, setDrones] = useState<SwarmDrone[]>(() => initialDrones(3));
  const dronesRef = useRef(drones);
  useEffect(() => { dronesRef.current = drones; }, [drones]);

  // re-split when waypoints change (lines slider) – preserve count
  useEffect(() => {
    setDrones((cur) => initialDrones(cur.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints]);

  // simulation tick
  useEffect(() => {
    if (!running) return;
    let raf: number;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      const windFactor = 1 + windKts[0] / 60;       // wind slows progress
      const precipFactor = 1 - precip[0] / 220;     // rain slows + drains battery faster
      const advance = Math.max(1, Math.round(speed[0] * 8 * dt / windFactor));
      const drainPerSec = (0.6 + windKts[0] / 40 + precip[0] / 80) * dt;

      setDrones((cur) => {
        let next = cur.map((d) => {
          if (d.phase !== "flying") return { ...d, battery: Math.max(0, d.battery - drainPerSec * 0.4) };
          let pi = d.pathIndex + advance;
          let phase: Phase = "flying";
          if (pi >= d.segmentEnd) {
            pi = d.segmentEnd - 1;
            phase = "rtb";
          }
          // jitter for wind realism (lateral)
          const base = waypoints[Math.min(pi, waypoints.length - 1)];
          const jitter = Math.sin(t / 400 + d.pathIndex) * (windKts[0] / 8);
          const newBat = Math.max(0, d.battery - drainPerSec * (1 / Math.max(0.4, precipFactor)));
          return {
            ...d,
            pathIndex: pi,
            phase,
            battery: newBat,
            pos: { x: base.x + jitter, y: base.y + jitter * 0.4 },
          };
        });

        // failover: if a drone <22% battery, hand its remaining segment to the highest-battery flying peer
        if (autoFailover) {
          const low = next.find((d) => d.phase === "flying" && d.battery < 22);
          if (low) {
            const helpers = next
              .filter((d) => d.id !== low.id && d.phase === "flying" && d.battery > 55)
              .sort((a, b) => b.battery - a.battery);
            if (helpers[0]) {
              const helper = helpers[0];
              const remaining = low.segmentEnd - low.pathIndex;
              if (remaining > 4) {
                next = next.map((d) => {
                  if (d.id === low.id) return { ...d, phase: "rtb" as Phase, segmentEnd: d.pathIndex + 1 };
                  if (d.id === helper.id) {
                    return {
                      ...d,
                      segmentEnd: helper.segmentEnd + remaining,
                      failoverFrom: low.id,
                    };
                  }
                  return d;
                });
              }
            }
          }
        }

        // dynamic replan: redistribute when one drone falls way behind progress
        if (dynamicReplan) {
          const flyers = next.filter((d) => d.phase === "flying");
          if (flyers.length >= 2) {
            const progresses = flyers.map((d) => (d.pathIndex - d.segmentStart) / Math.max(1, d.segmentEnd - d.segmentStart));
            const max = Math.max(...progresses);
            const min = Math.min(...progresses);
            if (max - min > 0.55) {
              const slow = flyers[progresses.indexOf(min)];
              const fast = flyers[progresses.indexOf(max)];
              const giveBack = Math.floor((slow.segmentEnd - slow.pathIndex) * 0.25);
              if (giveBack > 6) {
                next = next.map((d) => {
                  if (d.id === slow.id) return { ...d, segmentEnd: d.segmentEnd - giveBack };
                  if (d.id === fast.id) return { ...d, segmentEnd: d.segmentEnd + giveBack };
                  return d;
                });
              }
            }
          }
        }

        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, windKts, precip, autoFailover, dynamicReplan, waypoints]);

  function reset() {
    setDrones(initialDrones(drones.length));
  }

  function addDrone() {
    if (drones.length >= 4) return;
    setDrones(initialDrones(drones.length + 1));
  }

  function removeDrone() {
    if (drones.length <= 1) return;
    setDrones(initialDrones(drones.length - 1));
  }

  // path SVG segments per drone
  function segmentPath(d: SwarmDrone) {
    const slice = waypoints.slice(d.segmentStart, Math.min(d.segmentEnd, waypoints.length));
    return slice.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }
  function flownPath(d: SwarmDrone) {
    const slice = waypoints.slice(d.segmentStart, Math.min(d.pathIndex + 1, waypoints.length));
    return slice.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-display font-700 truncate">Swarm Orchestration</h1>
              <p className="text-xs text-muted-foreground truncate">Multi-drone autonomy with live failover</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={reset} className="gap-1.5"><RotateCcw className="w-4 h-4" /> Reset</Button>
            <Button size="sm" onClick={() => setRunning((r) => !r)} className="gap-1.5">
              {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {running ? "Pause" : "Resume"}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        {/* Map / Mission visualization */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm">Mission Map · Live Coordination</h2>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Wind className="w-3.5 h-3.5" /> {windKts[0]} kt</span>
                <span className="flex items-center gap-1"><CloudRain className="w-3.5 h-3.5" /> {precip[0]}%</span>
                <span className="flex items-center gap-1"><Sun className="w-3.5 h-3.5" /> Day VFR</span>
              </div>
            </div>
            <div className="bg-[hsl(var(--secondary))] relative">
              <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto block">
                {/* grid background */}
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />
                  </pattern>
                  <linearGradient id="aoi" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary) / 0.04)" />
                    <stop offset="100%" stopColor="hsl(var(--primary) / 0.12)" />
                  </linearGradient>
                </defs>
                <rect width={VIEW_W} height={VIEW_H} fill="url(#grid)" />
                <rect x="20" y="20" width={VIEW_W - 40} height={VIEW_H - 40} rx="14" fill="url(#aoi)" stroke="hsl(var(--primary) / 0.4)" strokeDasharray="6 4" />

                {/* segment plans (faded full path per drone) */}
                {drones.map((d) => (
                  <path key={`plan-${d.id}`} d={segmentPath(d)} fill="none" stroke={d.color} strokeOpacity="0.25" strokeWidth="2" strokeDasharray="4 4" />
                ))}
                {/* flown path */}
                {drones.map((d) => (
                  <path key={`flown-${d.id}`} d={flownPath(d)} fill="none" stroke={d.color} strokeWidth="2.5" strokeLinecap="round" />
                ))}
                {/* drones */}
                {drones.map((d) => (
                  <g key={d.id} transform={`translate(${d.pos.x} ${d.pos.y})`}>
                    {d.battery < 25 && (
                      <circle r="14" fill="none" stroke="hsl(var(--destructive))" strokeOpacity="0.8" strokeWidth="1.5">
                        <animate attributeName="r" values="10;18;10" dur="1.4s" repeatCount="indefinite" />
                        <animate attributeName="stroke-opacity" values="0.8;0;0.8" dur="1.4s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle r="9" fill={d.color} stroke="white" strokeWidth="2" />
                    <text y="-14" textAnchor="middle" fontSize="10" fontWeight="700" fill="hsl(var(--foreground))">{d.name}</text>
                    <text y="22" textAnchor="middle" fontSize="9" fill={d.color} fontWeight="600">{Math.round(d.battery)}%</text>
                  </g>
                ))}
              </svg>
              {/* environmental overlay shimmer (rain) */}
              {precip[0] > 30 && (
                <div className="pointer-events-none absolute inset-0 opacity-30 bg-[repeating-linear-gradient(110deg,transparent_0_6px,hsl(var(--highlight)/0.4)_6px_7px)]" />
              )}
            </div>
          </div>

          {/* Drone roster */}
          <div className="rounded-2xl border border-border bg-card">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2"><Plane className="w-4 h-4 text-primary" /> Active Fleet</h2>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={removeDrone} disabled={drones.length <= 1}>−</Button>
                <span className="text-xs w-8 text-center font-mono">{drones.length}</span>
                <Button size="sm" variant="outline" onClick={addDrone} disabled={drones.length >= 4}>+</Button>
              </div>
            </div>
            <div className="divide-y divide-border">
              {drones.map((d) => {
                const progress = ((d.pathIndex - d.segmentStart) / Math.max(1, d.segmentEnd - d.segmentStart)) * 100;
                const lowBat = d.battery < 25;
                return (
                  <div key={d.id} className="px-4 py-3 grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto] gap-3 items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full ring-2 ring-background" style={{ background: d.color }} />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{d.name}</p>
                        <p className="text-[11px] text-muted-foreground">{d.id}</p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                        <span className="capitalize">{d.failoverFrom ? `Took over ${d.failoverFrom}` : d.phase}</span>
                        <span>{Math.min(100, Math.round(progress))}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${Math.min(100, progress)}%`, background: d.color }} />
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-semibold ${lowBat ? "text-destructive" : d.battery < 50 ? "text-accent-foreground" : "text-primary"}`}>
                      {lowBat ? <BatteryWarning className="w-4 h-4" /> : <Battery className="w-4 h-4" />}
                      {Math.round(d.battery)}%
                    </div>
                    <div className="hidden sm:block">
                      <Badge variant="outline" className="text-[10px]">
                        {d.failoverFrom ? "Failover" : d.phase === "rtb" ? "RTB" : "Active"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar controls */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-accent" /> Autonomy</h3>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Auto failover</p>
                <p className="text-[11px] text-muted-foreground">Reassign segments on low battery</p>
              </div>
              <Switch checked={autoFailover} onCheckedChange={setAutoFailover} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Dynamic replan</p>
                <p className="text-[11px] text-muted-foreground">Rebalance lagging segments</p>
              </div>
              <Switch checked={dynamicReplan} onCheckedChange={setDynamicReplan} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-5">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Shuffle className="w-4 h-4 text-primary" /> Mission tuning</h3>
            <Labeled label="Sim speed" value={`${speed[0].toFixed(1)}×`}>
              <Slider value={speed} onValueChange={setSpeed} min={0.5} max={4} step={0.1} />
            </Labeled>
            <Labeled label="Survey lines" value={`${lines[0]}`}>
              <Slider value={lines} onValueChange={setLines} min={3} max={10} step={1} />
            </Labeled>
            <Labeled label="Wind" value={`${windKts[0]} kt`}>
              <Slider value={windKts} onValueChange={setWindKts} min={0} max={25} step={1} />
            </Labeled>
            <Labeled label="Precipitation" value={`${precip[0]}%`}>
              <Slider value={precip} onValueChange={setPrecip} min={0} max={90} step={5} />
            </Labeled>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/40 p-4 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground text-sm">How it works</p>
            <p>Waypoints are split per drone. As wind/rain rise, motion slows and battery drains faster. Below 22% battery, segments transfer to the strongest peer.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Labeled({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold">{value}</span>
      </div>
      {children}
    </div>
  );
}

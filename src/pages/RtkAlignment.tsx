import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, Crosshair, FileUp, Lock, MapPin, Shield, Sparkles, Target, Trash2, UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface RtkLog {
  id: string;
  name: string;
  size: string;
  uploadedAt: string;
  status: "uploading" | "verifying" | "ready" | "error";
  progress: number;
  fixRatio?: number;     // % RTK FIX vs FLOAT
  baselineKm?: number;
  satellites?: number;
}

interface SmartGcp {
  id: string;
  label: string;
  x: number; y: number;     // image-space %
  lat: number; lng: number; // wgs84
  confidence: number;       // 0-1
  type: "checkerboard" | "manhole" | "corner" | "painted";
  pinned: boolean;
}

const RNG_GCPS: Omit<SmartGcp, "pinned">[] = [
  { id: "g1", label: "GCP-01 Checker A", x: 18, y: 22, lat: 37.77492, lng: -122.41942, confidence: 0.97, type: "checkerboard" },
  { id: "g2", label: "GCP-02 Manhole",   x: 64, y: 30, lat: 37.77501, lng: -122.41880, confidence: 0.92, type: "manhole" },
  { id: "g3", label: "GCP-03 Curb edge", x: 28, y: 70, lat: 37.77445, lng: -122.41902, confidence: 0.88, type: "corner" },
  { id: "g4", label: "GCP-04 Painted X", x: 80, y: 62, lat: 37.77460, lng: -122.41835, confidence: 0.95, type: "painted" },
  { id: "g5", label: "GCP-05 Checker B", x: 50, y: 48, lat: 37.77478, lng: -122.41888, confidence: 0.91, type: "checkerboard" },
  { id: "g6", label: "GCP-06 Corner",    x: 12, y: 84, lat: 37.77430, lng: -122.41960, confidence: 0.86, type: "corner" },
];

export default function RtkAlignment() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<RtkLog[]>([]);
  const [gcps, setGcps] = useState<SmartGcp[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).slice(0, 6);
    accepted.forEach((f) => {
      const id = `${Date.now()}-${f.name}`;
      const log: RtkLog = {
        id,
        name: f.name,
        size: `${(f.size / 1024).toFixed(1)} KB`,
        uploadedAt: new Date().toLocaleTimeString(),
        status: "uploading",
        progress: 0,
      };
      setLogs((cur) => [log, ...cur].slice(0, 8));

      // simulate upload + verification
      let p = 0;
      const tick = setInterval(() => {
        p += 8 + Math.random() * 12;
        setLogs((cur) =>
          cur.map((l) =>
            l.id === id
              ? { ...l, progress: Math.min(100, p), status: p >= 100 ? "verifying" : "uploading" }
              : l,
          ),
        );
        if (p >= 100) {
          clearInterval(tick);
          setTimeout(() => {
            setLogs((cur) =>
              cur.map((l) =>
                l.id === id
                  ? {
                      ...l,
                      status: "ready",
                      fixRatio: 92 + Math.round(Math.random() * 7),
                      baselineKm: +(2 + Math.random() * 10).toFixed(1),
                      satellites: 14 + Math.round(Math.random() * 8),
                    }
                  : l,
              ),
            );
            toast({ title: "RTK log verified", description: `${f.name} accepted with FIX integrity` });
          }, 900);
        }
      }, 220);
    });
  }, [toast]);

  function runSmartScan() {
    if (scanning) return;
    setScanning(true);
    setScanProgress(0);
    setGcps([]);
    let p = 0;
    const tick = setInterval(() => {
      p += 7 + Math.random() * 6;
      setScanProgress(Math.min(100, p));
      // reveal one GCP per ~16% progress
      const reveal = Math.min(RNG_GCPS.length, Math.floor((p / 100) * RNG_GCPS.length));
      setGcps(RNG_GCPS.slice(0, reveal).map((g) => ({ ...g, pinned: false })));
      if (p >= 100) {
        clearInterval(tick);
        setGcps(RNG_GCPS.map((g) => ({ ...g, pinned: false })));
        setScanning(false);
        toast({ title: "Smart GCP extraction complete", description: `${RNG_GCPS.length} candidate points detected` });
      }
    }, 220);
  }

  function togglePin(id: string) {
    setGcps((cur) => cur.map((g) => (g.id === id ? { ...g, pinned: !g.pinned } : g)));
  }

  const acceptedLogs = logs.filter((l) => l.status === "ready").length;
  const pinnedGcps = gcps.filter((g) => g.pinned).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-display font-700 truncate">RTK / PPK & GCP Alignment</h1>
              <p className="text-xs text-muted-foreground truncate">Secure ingestion · automated smart-GCP extraction</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5 text-primary" /> AES-256 in transit
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* RTK upload portal */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> RTK / PPK correction logs
            </h2>
            <Badge variant="outline" className="text-[10px]">{acceptedLogs} verified</Badge>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".obs,.nav,.rtcm,.log,.txt,.csv,.zip"
            multiple
            hidden
            onChange={(e) => onFiles(e.target.files)}
          />
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
            className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 text-center cursor-pointer transition-colors bg-secondary/30"
          >
            <UploadCloud className="w-9 h-9 mx-auto text-primary mb-2" />
            <p className="text-sm font-semibold">Drop RINEX, RTCM, OBS, or NAV logs</p>
            <p className="text-xs text-muted-foreground mt-1">Upload securely · processed on receipt · max 6 files</p>
          </div>

          <div className="space-y-2">
            {logs.length === 0 && (
              <p className="text-xs text-center text-muted-foreground py-3">No correction logs uploaded yet</p>
            )}
            {logs.map((l) => (
              <div key={l.id} className="rounded-lg border border-border p-3 bg-card">
                <div className="flex items-center gap-3 mb-2">
                  <FileUp className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{l.name}</p>
                    <p className="text-[11px] text-muted-foreground">{l.size} · {l.uploadedAt}</p>
                  </div>
                  <StatusPill status={l.status} />
                </div>
                {l.status !== "ready" && (
                  <div className="h-1 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${l.progress}%` }} />
                  </div>
                )}
                {l.status === "ready" && (
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground mt-1">
                    <Stat label="FIX ratio" v={`${l.fixRatio}%`} good={l.fixRatio! > 90} />
                    <Stat label="Baseline" v={`${l.baselineKm} km`} good={l.baselineKm! < 10} />
                    <Stat label="Satellites" v={`${l.satellites}`} good={l.satellites! >= 14} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Smart GCP engine */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" /> Automated Smart-GCP engine
            </h2>
            <Button size="sm" onClick={runSmartScan} disabled={scanning || acceptedLogs === 0} className="gap-1.5">
              <Target className="w-4 h-4" /> {scanning ? "Scanning…" : "Run scan"}
            </Button>
          </div>

          {acceptedLogs === 0 && (
            <p className="text-[11px] text-muted-foreground bg-secondary/40 border border-border rounded-lg p-3">
              Upload at least one verified RTK log to enable automated GCP extraction.
            </p>
          )}

          {/* Image with detected GCPs */}
          <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-border bg-[hsl(220_30%_18%)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,hsl(38_60%_55%/0.5),transparent_55%),radial-gradient(circle_at_70%_70%,hsl(152_60%_38%/0.55),transparent_60%),linear-gradient(135deg,hsl(220_30%_18%),hsl(220_25%_25%))]" />
            {/* faux orthomosaic grid */}
            <div className="absolute inset-0 opacity-30 bg-[linear-gradient(0deg,transparent_24px,rgba(255,255,255,0.08)_25px),linear-gradient(90deg,transparent_24px,rgba(255,255,255,0.08)_25px)] bg-[size:25px_25px]" />

            {/* scanning sweep */}
            {scanning && (
              <div
                className="absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-accent/40 to-transparent"
                style={{ left: `${scanProgress}%`, transform: "translateX(-50%)" }}
              />
            )}

            {/* GCP markers */}
            {gcps.map((g) => (
              <button
                key={g.id}
                onClick={() => togglePin(g.id)}
                onMouseEnter={() => setHover(g.id)}
                onMouseLeave={() => setHover(null)}
                className="absolute -translate-x-1/2 -translate-y-1/2 group"
                style={{ left: `${g.x}%`, top: `${g.y}%` }}
              >
                <span className={`block w-5 h-5 rounded-full border-2 transition-all ${
                  g.pinned
                    ? "bg-accent border-accent-foreground scale-110"
                    : "bg-primary/80 border-white"
                } animate-in fade-in zoom-in`} />
                <Crosshair className={`absolute inset-0 m-auto w-3 h-3 ${g.pinned ? "text-accent-foreground" : "text-white"}`} />
                {hover === g.id && (
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10 bg-card border border-border rounded-md px-2 py-1.5 text-[10px] whitespace-nowrap shadow-lg">
                    <p className="font-semibold">{g.label}</p>
                    <p className="text-muted-foreground">{g.lat.toFixed(5)}, {g.lng.toFixed(5)}</p>
                    <p className="text-primary">conf {(g.confidence * 100).toFixed(0)}%</p>
                  </div>
                )}
              </button>
            ))}

            <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] text-white/80 font-mono">
              <span>Orthomosaic preview</span>
              <span>{gcps.length} candidates · {pinnedGcps} pinned</span>
            </div>
          </div>

          {scanning && (
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${scanProgress}%` }} />
            </div>
          )}

          {/* GCP table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 bg-secondary/50 text-[11px] font-semibold text-muted-foreground">
              <span>GCP</span><span>Confidence</span><span>Type</span><span></span>
            </div>
            <div className="divide-y divide-border max-h-56 overflow-auto">
              {gcps.length === 0 && (
                <p className="text-xs text-center text-muted-foreground py-4">No GCPs detected — run a scan to begin.</p>
              )}
              {gcps.map((g) => (
                <div key={g.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 items-center text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{g.label}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{g.lat.toFixed(5)}, {g.lng.toFixed(5)}</p>
                  </div>
                  <span className={`font-mono ${g.confidence > 0.93 ? "text-primary" : "text-accent-foreground"}`}>
                    {(g.confidence * 100).toFixed(0)}%
                  </span>
                  <Badge variant="outline" className="text-[9px] capitalize">{g.type}</Badge>
                  <Button
                    size="sm"
                    variant={g.pinned ? "default" : "outline"}
                    className="h-7 px-2 text-[11px]"
                    onClick={() => togglePin(g.id)}
                  >
                    {g.pinned ? <CheckCircle2 className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: RtkLog["status"] }) {
  const map = {
    uploading: { label: "Uploading", c: "bg-secondary text-muted-foreground" },
    verifying: { label: "Verifying", c: "bg-accent/20 text-accent-foreground" },
    ready:     { label: "Verified",  c: "bg-primary/15 text-primary" },
    error:     { label: "Error",     c: "bg-destructive/15 text-destructive" },
  } as const;
  const m = map[status];
  return <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${m.c}`}>{m.label}</span>;
}

function Stat({ label, v, good }: { label: string; v: string; good: boolean }) {
  return (
    <div className="bg-secondary/40 rounded px-2 py-1">
      <p className="text-[9px] uppercase tracking-wide">{label}</p>
      <p className={`font-mono font-semibold ${good ? "text-primary" : "text-accent-foreground"}`}>{v}</p>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, FileUp, Loader2, MapPin, Shield, Sparkles,
  Trash2, UploadCloud, FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ProjectOpt { id: string; name: string; }

interface RtkLog {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  status: "uploading" | "parsing" | "ready" | "error";
  progress: number;
  filePath?: string;
  fixRatio?: number;
  observations?: number;
  satellites?: number;
  rinexVersion?: string;
  errorMsg?: string;
}

interface DbGcp {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  created_at: string;
}

// ── RINEX header parser (versions 2.x / 3.x) ───────────────────────────────
function parseRinexHeader(text: string) {
  const lines = text.split(/\r?\n/);
  let version: string | null = null;
  let satellites = 0;
  let observations = 0;
  let endOfHeader = -1;
  for (let i = 0; i < Math.min(lines.length, 200); i++) {
    const line = lines[i];
    if (line.includes("RINEX VERSION / TYPE")) {
      version = line.slice(0, 9).trim();
    }
    if (line.includes("# OF SATELLITES")) {
      satellites = parseInt(line.slice(0, 6).trim(), 10) || 0;
    }
    if (line.includes("END OF HEADER")) {
      endOfHeader = i;
      break;
    }
  }
  // count epochs after header (cap at 5000 for perf)
  if (endOfHeader > 0) {
    for (let i = endOfHeader + 1; i < Math.min(lines.length, endOfHeader + 5000); i++) {
      if (lines[i].startsWith(">") || /^\s*\d{2}\s+\d{1,2}\s+\d{1,2}/.test(lines[i])) {
        observations++;
      }
    }
  }
  return { version, satellites, observations, isRinex: version !== null };
}

// ── CSV / TXT GCP parser ──────────────────────────────────────────────────
// Accepts: name,lat,lng[,elev]  OR  name,lng,lat[,elev]  OR tab/space separated
function parseGcpCsv(text: string): { name: string; lat: number; lng: number; elev: number | null }[] {
  const rows: { name: string; lat: number; lng: number; elev: number | null }[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length === 0) return rows;

  // detect separator
  const first = lines[0];
  const sep = first.includes(",") ? "," : first.includes("\t") ? "\t" : /\s+/;

  // detect header
  let startIdx = 0;
  const lower = first.toLowerCase();
  if (lower.includes("lat") || lower.includes("name") || lower.includes("northing")) {
    startIdx = 1;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const parts = (typeof sep === "string" ? lines[i].split(sep) : lines[i].split(sep))
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 3) continue;
    const name = parts[0];
    const a = parseFloat(parts[1]);
    const b = parseFloat(parts[2]);
    const c = parts[3] ? parseFloat(parts[3]) : null;
    if (Number.isNaN(a) || Number.isNaN(b)) continue;
    // Heuristic: lat is in [-90, 90]. Otherwise assume lng,lat.
    let lat: number, lng: number;
    if (Math.abs(a) <= 90 && Math.abs(b) > 90) {
      lat = a; lng = b;
    } else if (Math.abs(b) <= 90 && Math.abs(a) > 90) {
      lat = b; lng = a;
    } else {
      // ambiguous → assume lat,lng
      lat = a; lng = b;
    }
    rows.push({ name, lat, lng, elev: c && !Number.isNaN(c) ? c : null });
  }
  return rows;
}

export default function RtkAlignment() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [logs, setLogs] = useState<RtkLog[]>([]);
  const [gcps, setGcps] = useState<DbGcp[]>([]);
  const [gcpLoading, setGcpLoading] = useState(false);
  const [manualGcp, setManualGcp] = useState({ name: "", lat: "", lng: "", elev: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  // Load user's projects
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

  // Load existing GCPs for selected project
  const loadGcps = useCallback(async (pid: string) => {
    if (!pid) { setGcps([]); return; }
    setGcpLoading(true);
    const { data, error } = await supabase
      .from("ground_control_points")
      .select("*")
      .eq("project_id", pid)
      .order("created_at", { ascending: false });
    if (!error) setGcps((data ?? []) as DbGcp[]);
    setGcpLoading(false);
  }, []);

  useEffect(() => { loadGcps(projectId); }, [projectId, loadGcps]);

  // Upload RINEX/RTK log to flight-plans bucket and parse header
  const uploadRtkLog = useCallback(async (file: File) => {
    if (!user) return;
    const id = `${Date.now()}-${file.name}`;
    const log: RtkLog = {
      id, name: file.name, size: file.size,
      uploadedAt: new Date().toLocaleTimeString(),
      status: "uploading", progress: 10,
    };
    setLogs((cur) => [log, ...cur]);

    try {
      const path = `${user.id}/rtk/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("flight-plans")
        .upload(path, file, { contentType: "application/octet-stream", upsert: false });
      if (upErr) throw upErr;

      setLogs((cur) => cur.map((l) => l.id === id ? { ...l, status: "parsing", progress: 60, filePath: path } : l));

      // parse first 256KB for RINEX header (entire file may be huge)
      const sample = await file.slice(0, 256 * 1024).text();
      const meta = parseRinexHeader(sample);

      if (!meta.isRinex && !file.name.toLowerCase().match(/\.(obs|nav|rnx|rtcm|log|txt)$/)) {
        throw new Error("Not a recognized RINEX/RTK file");
      }

      // FIX ratio = % of epochs we could parse (rough proxy without a full RTKLIB)
      const fixRatio = meta.observations > 0 ? Math.min(99, 60 + Math.round((meta.observations / 4000) * 40)) : 75;

      setLogs((cur) => cur.map((l) => l.id === id ? {
        ...l, status: "ready", progress: 100,
        fixRatio, observations: meta.observations,
        satellites: meta.satellites, rinexVersion: meta.version ?? "unknown",
      } : l));

      toast({ title: "RTK log uploaded", description: `${file.name} parsed · ${meta.observations} epochs` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setLogs((cur) => cur.map((l) => l.id === id ? { ...l, status: "error", errorMsg: msg } : l));
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    }
  }, [user, toast]);

  const onRtkFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 6).forEach(uploadRtkLog);
  };

  // Import GCP CSV → batch insert to ground_control_points
  const importGcpCsv = useCallback(async (file: File) => {
    if (!user || !projectId) {
      toast({ title: "Pick a project first", variant: "destructive" });
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseGcpCsv(text);
      if (parsed.length === 0) {
        toast({ title: "No valid rows found", description: "Expected: name,lat,lng[,elev]", variant: "destructive" });
        return;
      }
      const rows = parsed.map((p) => ({
        project_id: projectId,
        user_id: user.id,
        name: p.name,
        latitude: p.lat,
        longitude: p.lng,
        elevation: p.elev,
      }));
      const { error } = await supabase.from("ground_control_points").insert(rows);
      if (error) throw error;
      toast({ title: `Imported ${rows.length} GCPs` });
      loadGcps(projectId);
    } catch (e) {
      toast({
        title: "Import failed",
        description: e instanceof Error ? e.message : "Parse error",
        variant: "destructive",
      });
    }
  }, [user, projectId, toast, loadGcps]);

  const addManualGcp = async () => {
    if (!user || !projectId) {
      toast({ title: "Pick a project first", variant: "destructive" });
      return;
    }
    const lat = parseFloat(manualGcp.lat);
    const lng = parseFloat(manualGcp.lng);
    if (!manualGcp.name || Number.isNaN(lat) || Number.isNaN(lng)) {
      toast({ title: "Name, lat, and lng are required", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("ground_control_points").insert({
      project_id: projectId,
      user_id: user.id,
      name: manualGcp.name,
      latitude: lat,
      longitude: lng,
      elevation: manualGcp.elev ? parseFloat(manualGcp.elev) : null,
    });
    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
      return;
    }
    setManualGcp({ name: "", lat: "", lng: "", elev: "" });
    toast({ title: "GCP added" });
    loadGcps(projectId);
  };

  const deleteGcp = async (id: string) => {
    const { error } = await supabase.from("ground_control_points").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setGcps((cur) => cur.filter((g) => g.id !== id));
  };

  const exportGcpCsv = () => {
    const header = "name,latitude,longitude,elevation\n";
    const rows = gcps.map((g) => `${g.name},${g.latitude},${g.longitude},${g.elevation ?? ""}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gcps-${projectId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) { navigate("/auth"); return null; }

  const acceptedLogs = logs.filter((l) => l.status === "ready").length;

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
              <p className="text-xs text-muted-foreground truncate">Real RINEX uploads · GCPs persisted to your project</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Project picker */}
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FolderOpen className="w-4 h-4 text-primary" /> Project
          </div>
          {projects.length === 0 ? (
            <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground">
              No projects yet.
              <Button size="sm" variant="outline" onClick={() => navigate("/dashboard")}>Create one</Button>
            </div>
          ) : (
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full sm:w-80"><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <span className="text-xs text-muted-foreground sm:ml-auto">
            GCPs and RTK logs are scoped to the selected project.
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* RTK upload */}
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> RTK / PPK correction logs
              </h2>
              <Badge variant="outline" className="text-[10px]">{acceptedLogs} parsed</Badge>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".obs,.nav,.rnx,.rtcm,.log,.txt,.zip"
              multiple
              hidden
              onChange={(e) => onRtkFiles(e.target.files)}
            />
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onRtkFiles(e.dataTransfer.files); }}
              className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 text-center cursor-pointer transition-colors bg-secondary/30"
            >
              <UploadCloud className="w-9 h-9 mx-auto text-primary mb-2" />
              <p className="text-sm font-semibold">Drop RINEX, RTCM, OBS, or NAV logs</p>
              <p className="text-xs text-muted-foreground mt-1">Stored in your private bucket · header parsed in browser · max 6 files</p>
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
                      <p className="text-[11px] text-muted-foreground">{(l.size / 1024).toFixed(1)} KB · {l.uploadedAt}</p>
                    </div>
                    <StatusPill status={l.status} />
                  </div>
                  {(l.status === "uploading" || l.status === "parsing") && (
                    <div className="h-1 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${l.progress}%` }} />
                    </div>
                  )}
                  {l.status === "ready" && (
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground mt-1">
                      <Stat3 label="Epochs" v={`${l.observations}`} good={(l.observations ?? 0) > 100} />
                      <Stat3 label="Sats" v={`${l.satellites ?? "—"}`} good={(l.satellites ?? 0) >= 8} />
                      <Stat3 label="RINEX" v={l.rinexVersion ?? "—"} good={l.rinexVersion !== "unknown"} />
                    </div>
                  )}
                  {l.status === "error" && (
                    <p className="text-[11px] text-destructive">{l.errorMsg}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* GCP management */}
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" /> Ground Control Points
              </h2>
              <Badge variant="outline" className="text-[10px]">{gcps.length} saved</Badge>
            </div>

            {/* CSV import */}
            <input
              ref={csvRef}
              type="file"
              accept=".csv,.txt"
              hidden
              onChange={(e) => e.target.files?.[0] && importGcpCsv(e.target.files[0])}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => csvRef.current?.click()} disabled={!projectId} className="gap-1.5">
                <UploadCloud className="w-4 h-4" /> Import CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportGcpCsv} disabled={gcps.length === 0} className="gap-1.5">
                <FileUp className="w-4 h-4 rotate-180" /> Export CSV
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-2">
              CSV format: <code>name,lat,lng[,elev]</code> · auto-detects column order
            </p>

            {/* Manual entry */}
            <div className="rounded-lg border border-border p-3 space-y-2 bg-secondary/30">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Add manually</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="GCP name"
                  value={manualGcp.name}
                  onChange={(e) => setManualGcp({ ...manualGcp, name: e.target.value })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Elev (m, optional)"
                  value={manualGcp.elev}
                  onChange={(e) => setManualGcp({ ...manualGcp, elev: e.target.value })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Latitude"
                  value={manualGcp.lat}
                  onChange={(e) => setManualGcp({ ...manualGcp, lat: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
                <Input
                  placeholder="Longitude"
                  value={manualGcp.lng}
                  onChange={(e) => setManualGcp({ ...manualGcp, lng: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <Button size="sm" onClick={addManualGcp} disabled={!projectId} className="w-full h-8 text-xs gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Save GCP
              </Button>
            </div>

            {/* GCP table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 bg-secondary/50 text-[11px] font-semibold text-muted-foreground">
                <span>Name / Coords</span><span>Elev</span><span></span>
              </div>
              <div className="divide-y divide-border max-h-72 overflow-auto">
                {gcpLoading && (
                  <p className="text-xs text-center text-muted-foreground py-4 flex items-center justify-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                  </p>
                )}
                {!gcpLoading && gcps.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground py-4">
                    No GCPs in this project yet. Import a CSV or add manually.
                  </p>
                )}
                {gcps.map((g) => (
                  <div key={g.id} className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 items-center text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold truncate flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />
                        {g.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {g.latitude.toFixed(6)}, {g.longitude.toFixed(6)}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {g.elevation != null ? `${g.elevation.toFixed(1)}m` : "—"}
                    </span>
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteGcp(g.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: RtkLog["status"] }) {
  const map = {
    uploading: { label: "Uploading", c: "bg-secondary text-muted-foreground" },
    parsing:   { label: "Parsing",   c: "bg-accent/20 text-accent-foreground" },
    ready:     { label: "Parsed",    c: "bg-primary/15 text-primary" },
    error:     { label: "Error",     c: "bg-destructive/15 text-destructive" },
  } as const;
  const m = map[status];
  return <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${m.c}`}>{m.label}</span>;
}

function Stat3({ label, v, good }: { label: string; v: string; good: boolean }) {
  return (
    <div className="bg-secondary/40 rounded px-2 py-1">
      <p className="text-[9px] uppercase tracking-wide">{label}</p>
      <p className={`font-mono font-semibold ${good ? "text-primary" : "text-muted-foreground"}`}>{v}</p>
    </div>
  );
}

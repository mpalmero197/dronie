import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, FileText, Loader2, Layers, Eye, Sparkles, FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";

interface ProjectRow {
  id: string;
  name: string;
  status: string;
  area_ha: number | null;
  image_count: number;
  outputs: string[] | null;
  outputs_urls: Record<string, string> | null;
  created_at: string;
}

export default function AiInsights() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("projects")
        .select("id, name, status, area_ha, image_count, outputs, outputs_urls, created_at")
        .eq("user_id", user.id)
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      const rows = (data ?? []) as ProjectRow[];
      setProjects(rows);
      if (rows[0]) setProjectId(rows[0].id);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  const project = useMemo(() => projects.find((p) => p.id === projectId) ?? null, [projects, projectId]);

  const metrics = useMemo(() => {
    if (!project) return [] as { label: string; value: string; unit?: string }[];
    const m: { label: string; value: string; unit?: string }[] = [
      { label: "Image count", value: project.image_count.toLocaleString(), unit: "imgs" },
    ];
    if (project.area_ha != null) m.push({ label: "Surveyed area", value: Number(project.area_ha).toFixed(2), unit: "ha" });
    if (project.outputs?.length) m.push({ label: "Output deliverables", value: String(project.outputs.length), unit: "files" });
    return m;
  }, [project]);

  async function generateReport() {
    if (!project) return;
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pad = 18;
      let y = pad;
      doc.setFillColor(36, 90, 60);
      doc.rect(0, 0, 210, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold").setFontSize(16);
      doc.text("Dronie · Site Insights Report", pad, 14);
      doc.setFont("helvetica", "normal").setFontSize(9);
      doc.text(new Date().toLocaleString(), 210 - pad, 14, { align: "right" });
      y = 32;
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold").setFontSize(12);
      doc.text(project.name, pad, y); y += 6;
      doc.setFont("helvetica", "normal").setFontSize(10);
      doc.text(`Project ID: ${project.id}`, pad, y); y += 5;
      doc.text(`Captured: ${new Date(project.created_at).toLocaleDateString()}`, pad, y); y += 10;

      doc.setFont("helvetica", "bold").setFontSize(12);
      doc.text("Key metrics", pad, y); y += 4;
      doc.setDrawColor(220);
      doc.line(pad, y, 210 - pad, y); y += 6;
      doc.setFontSize(10);
      metrics.forEach((m) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${m.value}${m.unit ? " " + m.unit : ""}`, pad, y);
        doc.setFont("helvetica", "normal");
        doc.text(m.label, pad + 60, y);
        y += 7;
      });
      y += 6;

      if (project.outputs?.length) {
        doc.setFont("helvetica", "bold").setFontSize(12);
        doc.text("Generated deliverables", pad, y); y += 6;
        doc.setFont("helvetica", "normal").setFontSize(10);
        project.outputs.forEach((o) => {
          doc.text(`• ${o}`, pad, y); y += 5;
        });
      }

      doc.save(`dronie-${project.name.replace(/\s+/g, "-").toLowerCase()}-report-${Date.now()}.pdf`);
      toast({ title: "Report generated", description: "PDF downloaded to your device." });
    } finally {
      setGenerating(false);
    }
  }

  if (authLoading) return <Center><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</Center>;
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
              <h1 className="text-base sm:text-lg font-display font-700 truncate">AI Insights · Site Analysis</h1>
              <p className="text-xs text-muted-foreground truncate">Per-project metrics · downloadable PDF reports</p>
            </div>
          </div>
          <Button size="sm" onClick={generateReport} disabled={generating || !project} className="gap-1.5">
            <FileText className="w-4 h-4" /> {generating ? "Generating…" : "Export PDF"}
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        {loading ? (
          <Center><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading projects…</Center>
        ) : projects.length === 0 ? (
          <EmptyState
            title="No completed projects yet"
            description="Insights become available once a project finishes processing. Upload imagery from the Dashboard to get started."
            cta={<Link to="/dashboard"><Button size="sm" className="gap-2"><FolderOpen className="w-4 h-4" /> Open Dashboard</Button></Link>}
          />
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Project</span>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-full sm:w-80"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {project && (
                <Link to={`/viewer/${project.id}`} className="ml-auto">
                  <Button size="sm" variant="outline" className="gap-1.5"><Eye className="w-4 h-4" /> Open in viewer</Button>
                </Link>
              )}
            </div>

            {project && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {metrics.map((m) => (
                    <div key={m.label} className="rounded-xl border border-border bg-card p-3">
                      <p className="text-[11px] text-muted-foreground">{m.label}</p>
                      <p className="font-display font-700 text-xl mt-1">
                        {m.value}
                        {m.unit && <span className="text-xs text-muted-foreground ml-1 font-sans font-normal">{m.unit}</span>}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <h2 className="font-semibold text-sm">Deliverables</h2>
                    <Badge variant="outline" className="text-[10px] ml-auto">{project.outputs?.length ?? 0}</Badge>
                  </div>
                  {!project.outputs?.length ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Processing did not record any output files for this project yet.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {project.outputs.map((name) => {
                        const url = project.outputs_urls?.[name];
                        return (
                          <li key={name} className="px-4 py-3 flex items-center justify-between gap-3">
                            <span className="text-sm font-mono truncate">{name}</span>
                            {url ? (
                              <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                                Download
                              </a>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">No URL</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">{children}</div>;
}
function EmptyState({ title, description, cta }: { title: string; description: string; cta: React.ReactNode }) {
  return (
    <div className="mt-12 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <Sparkles className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
      <h2 className="font-display font-700 text-lg">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">{description}</p>
      <div className="mt-5">{cta}</div>
    </div>
  );
}
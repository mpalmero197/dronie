import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Map,
  Plus,
  UploadCloud,
  MoreVertical,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderOpen,
  Download,
  Eye,
  Trash2,
  BarChart3,
  HardDrive,
  Zap,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Status = "complete" | "processing" | "queued" | "failed";

interface Project {
  id: string;
  name: string;
  date: string;
  images: number;
  areaha: number;
  status: Status;
  progress?: number;
  outputs: string[];
  thumbnail?: string;
}

const projects: Project[] = [
  {
    id: "p1",
    name: "Greenfield Farm — Block 4",
    date: "Mar 21, 2026",
    images: 847,
    areaha: 143.2,
    status: "complete",
    outputs: ["Orthomosaic", "DSM", "Point Cloud", "Contours"],
    progress: 100,
  },
  {
    id: "p2",
    name: "Site_Survey_March23",
    date: "Mar 23, 2026",
    images: 312,
    areaha: 31.7,
    status: "processing",
    outputs: ["Orthomosaic", "DSM"],
    progress: 59,
  },
  {
    id: "p3",
    name: "Highway_ROW_Corridor",
    date: "Mar 23, 2026",
    images: 1204,
    areaha: 287.9,
    status: "queued",
    outputs: ["Orthomosaic", "Point Cloud", "DTM"],
    progress: 0,
  },
  {
    id: "p4",
    name: "Quarry Volume Assessment",
    date: "Mar 20, 2026",
    images: 533,
    areaha: 58.4,
    status: "complete",
    outputs: ["Orthomosaic", "DSM", "DTM", "Point Cloud"],
    progress: 100,
  },
  {
    id: "p5",
    name: "Coastal_Erosion_Survey_Feb",
    date: "Feb 28, 2026",
    images: 291,
    areaha: 19.6,
    status: "failed",
    outputs: [],
    progress: 32,
  },
  {
    id: "p6",
    name: "Orchard NDVI Analysis",
    date: "Mar 18, 2026",
    images: 718,
    areaha: 94.1,
    status: "complete",
    outputs: ["Orthomosaic", "NDVI Map", "DSM"],
    progress: 100,
  },
];

const statusConfig: Record<Status, { label: string; icon: typeof CheckCircle2; classes: string }> = {
  complete: {
    label: "Complete",
    icon: CheckCircle2,
    classes: "bg-primary/10 text-primary border-primary/20",
  },
  processing: {
    label: "Processing",
    icon: Loader2,
    classes: "bg-accent/15 text-accent border-accent/20",
  },
  queued: {
    label: "Queued",
    icon: Clock,
    classes: "bg-muted text-muted-foreground border-border",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    classes: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

function StatusBadge({ status }: { status: Status }) {
  const cfg = statusConfig[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.classes}`}>
      <Icon className={`w-3 h-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {cfg.label}
    </span>
  );
}

function StorageBar({ used, total }: { used: number; total: number }) {
  const pct = Math.round((used / total) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
        <span>{used} GB used</span>
        <span>{total} GB</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [dragging, setDragging] = useState(false);

  const completeCount = projects.filter((p) => p.status === "complete").length;
  const processingCount = projects.filter((p) => p.status === "processing" || p.status === "queued").length;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border min-h-screen sticky top-0">
        {/* Logo */}
        <div className="p-5 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow">
              <Map className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-700 text-sidebar-foreground">MapForge</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {[
            { icon: FolderOpen, label: "Projects", active: true },
            { icon: Map, label: "Map Viewer", active: false },
            { icon: BarChart3, label: "Analytics", active: false },
            { icon: HardDrive, label: "Storage", active: false },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Storage */}
        <div className="p-4 border-t border-sidebar-border">
          <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-widest mb-3">Storage</p>
          <StorageBar used={23.4} total={50} />
          <Button size="sm" className="w-full mt-3 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 text-xs transition-all active:scale-[0.97]">
            <Zap className="w-3 h-3 mr-1.5" />
            Upgrade Plan
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="lg:hidden flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-display font-700 text-foreground">Projects</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {completeCount} complete · {processingCount} in queue
              </p>
            </div>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 shadow-sm hover:shadow-md transition-all active:scale-[0.97]">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </header>

        <div className="flex-1 p-6 space-y-6">
          {/* Quick stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Projects", value: projects.length.toString(), icon: FolderOpen, color: "text-primary", bg: "bg-secondary" },
              { label: "Processing", value: processingCount.toString(), icon: Loader2, color: "text-accent", bg: "bg-accent/10" },
              { label: "Images Processed", value: "3,905", icon: BarChart3, color: "text-highlight", bg: "bg-highlight/10" },
              { label: "Total Area", value: "635 ha", icon: Map, color: "text-primary", bg: "bg-secondary" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-card rounded-xl p-4 border border-border flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xl font-display font-700 text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Upload drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); }}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
              dragging
                ? "border-accent bg-accent/5"
                : "border-border hover:border-primary/40 hover:bg-secondary/50"
            }`}
          >
            <UploadCloud className={`w-10 h-10 mx-auto mb-3 transition-colors ${dragging ? "text-accent" : "text-muted-foreground"}`} />
            <p className="font-semibold text-foreground text-sm">
              {dragging ? "Drop images to start" : "Drop drone images here"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              JPEG, TIFF, DNG accepted · Folders OK · Up to 5,000 images
            </p>
            <Button variant="outline" size="sm" className="mt-4 hover:border-primary transition-colors active:scale-[0.97]">
              Browse Files
            </Button>
          </div>

          {/* Project list */}
          <div className="space-y-3">
            <h2 className="font-display font-600 text-foreground text-sm">Recent Projects</h2>
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-card border border-border rounded-xl p-4 hover:border-primary/20 hover:shadow-md transition-all duration-200 group"
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                      <Map className="w-5 h-5 text-primary" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-foreground text-sm truncate">{project.name}</h3>
                        <StatusBadge status={project.status} />
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>{project.date}</span>
                        <span>{project.images.toLocaleString()} images</span>
                        <span>{project.areaha} ha</span>
                        {project.outputs.length > 0 && (
                          <span className="text-primary">{project.outputs.join(" · ")}</span>
                        )}
                      </div>

                      {/* Progress bar for processing */}
                      {(project.status === "processing" || project.status === "failed") && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                project.status === "failed" ? "bg-destructive" : "bg-accent"
                              }`}
                              style={{ width: `${project.progress ?? 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{project.progress}%</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {project.status === "complete" && (
                        <>
                          <Button variant="ghost" size="sm" className="hidden sm:flex gap-1.5 text-xs hover:text-primary transition-colors active:scale-[0.97]">
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </Button>
                          <Button variant="ghost" size="sm" className="hidden sm:flex gap-1.5 text-xs hover:text-primary transition-colors active:scale-[0.97]">
                            <Download className="w-3.5 h-3.5" />
                            Export
                          </Button>
                        </>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-8 h-8 p-0 hover:bg-muted transition-colors">
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Eye className="w-3.5 h-3.5" /> View Map
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Download className="w-3.5 h-3.5" /> Export
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

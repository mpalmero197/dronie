import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Map, Plus, UploadCloud, MoreVertical, Clock,
  CheckCircle2, AlertCircle, Loader2, FolderOpen,
  Eye, Trash2, BarChart3, HardDrive, FileArchive, ImageIcon,
  Play, Share2, Lock, Plane, Plus as PlusIcon,
  Bookmark, Workflow, Radar, Boxes, Satellite, Brain, ShieldCheck, Sparkles, Camera,
  ChevronRight,
} from "lucide-react";
import ProjectDetailDialog from "@/components/ProjectDetailDialog";
import PilotVerificationBanner from "@/components/PilotVerificationBanner";
import Part107Prompt from "@/components/Part107Prompt";
import MyDronesPanel from "@/components/fleet/MyDronesPanel";
import { Button } from "@/components/ui/button";
import AppShell from "@/components/shell/AppShell";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Project } from "@/lib/supabase";
import { getTierLimits, canCreateProject, getProjectsRemaining, TierLimits } from "@/lib/subscription-limits";
import UpgradePrompt from "@/components/UpgradePrompt";
import { useToast } from "@/hooks/use-toast";

type Status = "complete" | "processing" | "queued" | "failed";
type SidebarView = "projects" | "analytics" | "storage";

const statusConfig: Record<Status, { label: string; icon: typeof CheckCircle2; classes: string }> = {
  complete: { label: "Complete", icon: CheckCircle2, classes: "bg-primary/10 text-primary border-primary/20" },
  processing: { label: "Processing", icon: Loader2, classes: "bg-accent/15 text-accent border-accent/20" },
  queued: { label: "Queued", icon: Clock, classes: "bg-muted text-muted-foreground border-border" },
  failed: { label: "Failed", icon: AlertCircle, classes: "bg-destructive/10 text-destructive border-destructive/20" },
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

function AnalyticsPanel({ projects }: { projects: Project[] }) {
  const statusCounts = {
    complete: projects.filter((p) => p.status === "complete").length,
    processing: projects.filter((p) => p.status === "processing").length,
    queued: projects.filter((p) => p.status === "queued").length,
    failed: projects.filter((p) => p.status === "failed").length,
  };
  const totalImages = projects.reduce((sum, p) => sum + (p.image_count || 0), 0);
  const totalArea = projects.reduce((sum, p) => sum + (Number(p.area_ha) || 0), 0);
  const maxCount = Math.max(...Object.values(statusCounts), 1);

  const bars = [
    { label: "Complete", count: statusCounts.complete, color: "bg-primary" },
    { label: "Processing", count: statusCounts.processing, color: "bg-accent" },
    { label: "Queued", count: statusCounts.queued, color: "bg-muted-foreground" },
    { label: "Failed", count: statusCounts.failed, color: "bg-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-700 text-foreground">Analytics</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Overview of your processing activity</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Total Projects", value: projects.length },
          { label: "Images Uploaded", value: totalImages.toLocaleString() },
          { label: "Total Area Mapped", value: totalArea > 0 ? `${totalArea.toFixed(1)} ha` : "—" },
          { label: "Completed", value: statusCounts.complete },
          { label: "In Queue", value: statusCounts.processing + statusCounts.queued },
          { label: "Success Rate", value: projects.length > 0 ? `${Math.round((statusCounts.complete / projects.length) * 100)}%` : "—" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-4 border border-border">
            <p className="text-2xl font-display font-700 text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl p-5 border border-border">
        <h3 className="font-semibold text-sm text-foreground mb-4">Projects by Status</h3>
        <div className="space-y-3">
          {bars.map((bar) => (
            <div key={bar.label} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{bar.label}</span>
              <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden">
                <div
                  className={`h-full ${bar.color} rounded-lg transition-all duration-700 flex items-center justify-end pr-2`}
                  style={{ width: `${(bar.count / maxCount) * 100}%`, minWidth: bar.count > 0 ? "2rem" : "0" }}
                >
                  {bar.count > 0 && <span className="text-xs font-bold text-primary-foreground">{bar.count}</span>}
                </div>
              </div>
              {bar.count === 0 && <span className="text-xs text-muted-foreground">0</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StoragePanel({ projects, tierLimits }: { projects: Project[]; tierLimits: TierLimits }) {
  const totalImages = projects.reduce((sum, p) => sum + (p.image_count || 0), 0);
  // Estimate: avg 8MB per image
  const estimatedMB = totalImages * 8;
  const usedGB = (estimatedMB / 1024).toFixed(2);
  const limitGB = tierLimits.storageGB === Infinity ? 9999 : tierLimits.storageGB;
  const pct = Math.min((parseFloat(usedGB) / limitGB) * 100, 100);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-700 text-foreground">Storage</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Your storage usage and quotas</p>
      </div>

      <div className="bg-card rounded-xl p-5 border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-foreground">{usedGB} GB <span className="text-muted-foreground font-normal text-sm">of {tierLimits.storageGB === Infinity ? "∞" : `${limitGB} GB`} used</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">{tierLimits.tierLabel} plan · {Math.round(pct)}% used</p>
          </div>
          <HardDrive className="w-8 h-8 text-primary opacity-60" />
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${pct > 80 ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${Math.max(pct, 1)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Drone Images", icon: ImageIcon, value: `${totalImages.toLocaleString()} files`, sub: `~${usedGB} GB` },
          { label: "Flight Plans", icon: FileArchive, value: `${projects.length} KML/KMZ`, sub: "< 1 MB" },
          { label: "Output Files", icon: FolderOpen, value: `${projects.filter(p => p.status === "complete").length} projects`, sub: "GeoTIFF · LAZ · SHP" },
          { label: "Available", icon: HardDrive, value: tierLimits.storageGB === Infinity ? "∞" : `${(limitGB - parseFloat(usedGB)).toFixed(1)} GB`, sub: "Free space" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">{item.label}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.sub}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isAdmin, signOut, loading: authLoading, checkSubscription, subscriptionTier, isSubscribed } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [sidebarView, setSidebarView] = useState<SidebarView>("projects");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState({ feature: "", description: "" });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const tierLimits = getTierLimits(subscriptionTier, isAdmin);

  // Count projects created this month
  const monthlyProjectCount = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return projects.filter((p) => new Date(p.created_at) >= startOfMonth).length;
  }, [projects]);

  const projectsRemaining = getProjectsRemaining(subscriptionTier, monthlyProjectCount, isAdmin);
  const hasPaidAccess = isAdmin || isSubscribed;
  const canCreate = hasPaidAccess && canCreateProject(subscriptionTier, monthlyProjectCount, isAdmin);

  // Handle checkout redirect
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      toast({ title: '🎉 Subscription activated!', description: 'Your plan has been upgraded. Enjoy your new features!' });
      checkSubscription();
    } else if (checkout === 'cancelled') {
      toast({ title: 'Checkout cancelled', description: 'No changes were made to your plan.' });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  async function fetchProjects() {
    if (!user) return;
    setLoadingProjects(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error loading projects', description: error.message, variant: 'destructive' });
    } else {
      setProjects((data as Project[]) || []);
    }
    setLoadingProjects(false);
  }

  useEffect(() => {
    if (user) fetchProjects();
  }, [user]);

  // Realtime subscription for project updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('projects-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projects' },
        (payload) => {
          const updated = payload.new as Project;
          setProjects((prev) => prev.map((p) => p.id === updated.id ? updated : p));
          setDetailProject((prev) => prev?.id === updated.id ? updated : prev);

          if (updated.status === 'complete') {
            toast({
              title: '✅ Processing complete!',
              description: `"${updated.name}" is ready. Open the Outputs tab to download your maps.`,
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function createProject() {
    if (!user || !newProjectName.trim()) return;
    if (!canCreate) {
      setNewProjectOpen(false);
      setUpgradeFeature(!hasPaidAccess ? {
        feature: "Subscription Required",
        description: "DronieApp is a paid platform. Choose a plan to create projects and run processing.",
      } : {
        feature: "Project Limit Reached",
        description: `You've used all ${tierLimits.projectsPerMonth} projects this month on the ${tierLimits.tierLabel} plan. Upgrade to Professional for unlimited projects.`,
      });
      setUpgradeOpen(true);
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name: newProjectName.trim(), status: 'queued' })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setProjects([data as Project, ...projects]);
      setNewProjectOpen(false);
      setNewProjectName('');
      toast({ title: 'Project created', description: `"${data.name}" is ready for images.` });
    }
    setCreating(false);
  }

  function handleNewProject() {
    if (!canCreate) {
      setUpgradeFeature(!hasPaidAccess ? {
        feature: "Subscription Required",
        description: "DronieApp is a paid platform. Choose a plan to create projects and run processing.",
      } : {
        feature: "Project Limit Reached",
        description: `You've used all ${tierLimits.projectsPerMonth} projects this month on the ${tierLimits.tierLabel} plan. Upgrade to Professional for unlimited projects.`,
      });
      setUpgradeOpen(true);
      return;
    }
    setNewProjectOpen(true);
  }

  function handleShareProject(project: Project) {
    if (!isSubscribed && subscriptionTier !== "professional" && subscriptionTier !== "enterprise") {
      setUpgradeFeature({
        feature: "Share Links",
        description: "Shareable map links are available on the Professional plan and above. Upgrade to share your maps with clients and colleagues.",
      });
      setUpgradeOpen(true);
      return;
    }
    shareProject(project);
  }

  async function deleteProject(id: string) {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setProjects(projects.filter((p) => p.id !== id));
      toast({ title: 'Project deleted' });
    }
  }

  function shareProject(project: Project) {
    if (project.status !== 'complete') {
      toast({ title: 'Not ready', description: 'Project must be complete before sharing.', variant: 'destructive' });
      return;
    }
    const url = `${window.location.origin}/viewer/${project.id}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Share link copied!', description: 'Anyone with this link can view the map — no login required.' });
  }

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const completeCount = projects.filter((p) => p.status === "complete").length;
  const processingCount = projects.filter((p) => p.status === "processing" || p.status === "queued").length;
  const totalImages = projects.reduce((sum, p) => sum + (p.image_count || 0), 0);
  const totalArea = projects.reduce((sum, p) => sum + (Number(p.area_ha) || 0), 0);

  const latestComplete = projects.find((p) => p.status === "complete");


  const subview = (searchParams.get("view") as SidebarView) || sidebarView;
  const viewTitle = subview === "projects" ? "Overview" : subview === "analytics" ? "Analytics" : "Storage";
  const viewSubtitle = subview === "projects"
    ? `${completeCount} complete · ${processingCount} in queue`
    : subview === "analytics"
    ? "Overview of your processing activity"
    : "Your storage usage and quotas";

  const headerActions = (
    <>
      <Tabs
        value={subview}
        onValueChange={(v) => setSidebarView(v as SidebarView)}
        className="hidden md:block"
      >
        <TabsList className="h-8">
          <TabsTrigger value="projects" className="text-xs">Projects</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs">Analytics</TabsTrigger>
          <TabsTrigger value="storage" className="text-xs">Storage</TabsTrigger>
        </TabsList>
      </Tabs>
      <Button
        onClick={handleNewProject}
        size="sm"
        className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 shadow-sm"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">New Project</span>
      </Button>
    </>
  );

  return (
    <AppShell title={viewTitle} subtitle={viewSubtitle} actions={headerActions}>
      {/* Mobile subview switcher */}
      <Tabs
        value={subview}
        onValueChange={(v) => setSidebarView(v as SidebarView)}
        className="md:hidden"
      >
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
        </TabsList>
      </Tabs>

      <Part107Prompt />
      <PilotVerificationBanner hideWhenUnverified />

      {subview === "analytics" && <AnalyticsPanel projects={projects} />}
      {subview === "storage" && <StoragePanel projects={projects} tierLimits={tierLimits} />}

      {subview === "projects" && (
        <>
          {/* Welcome hero */}
          <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary via-primary to-primary/85 text-primary-foreground p-6 sm:p-7">
            <div className="absolute inset-0 opacity-[0.08] pointer-events-none" aria-hidden>
              <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-primary-foreground blur-3xl" />
              <div className="absolute -left-10 bottom-0 w-48 h-48 rounded-full bg-accent blur-3xl" />
            </div>
            <div className="relative flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-primary-foreground/70">
                  Welcome back
                </p>
                <h2 className="font-display font-700 text-2xl sm:text-3xl leading-tight mt-1.5">
                  {user?.user_metadata?.full_name?.split(" ")[0] || "Pilot"}, ready to fly
                </h2>
                <p className="text-sm text-primary-foreground/80 mt-2 max-w-xl">
                  Plan a mission, review live drones, or process new imagery — all from one cockpit.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => navigate(latestComplete ? `/plan?project=${latestComplete.id}` : "/plan")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-foreground text-primary font-display font-700 text-sm shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Plane className="w-4 h-4" /> Plan a flight
                </button>
                <button
                  onClick={() => navigate("/map")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-foreground/15 hover:bg-primary-foreground/25 backdrop-blur text-primary-foreground font-display font-700 text-sm transition-colors"
                >
                  <Map className="w-4 h-4" /> Open map
                </button>
                <button
                  onClick={handleNewProject}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-foreground/15 hover:bg-primary-foreground/25 backdrop-blur text-primary-foreground font-display font-700 text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" /> New project
                </button>
              </div>
            </div>
          </section>

          {/* Metric row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: "Total Projects", value: projects.length.toString(), icon: FolderOpen, color: "text-primary", bg: "bg-primary/10" },
              { label: "In Progress", value: processingCount.toString(), icon: Loader2, color: "text-accent", bg: "bg-accent/10", spin: processingCount > 0 },
              { label: "Images Uploaded", value: totalImages.toLocaleString() || "0", icon: ImageIcon, color: "text-highlight", bg: "bg-highlight/10" },
              { label: "Total Area", value: totalArea > 0 ? `${totalArea.toFixed(1)} ha` : "—", icon: Map, color: "text-primary", bg: "bg-primary/10" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="group bg-card rounded-xl p-4 border border-border hover:border-primary/30 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${stat.color} ${stat.spin ? "animate-spin" : ""}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-display font-700 text-foreground leading-none tracking-tight">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1.5 uppercase tracking-wide">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* Workspace grid: projects (2/3) + activity/quick actions (1/3) */}
          <div className="grid lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Workspace</p>
                  <h2 className="font-display font-700 text-foreground text-lg">
                    {isAdmin ? "All projects" : "Recent projects"}
                  </h2>
                </div>
                {projects.length > 0 && (
                  <span className="text-xs text-muted-foreground">{projects.length} total</span>
                )}
              </div>

              {loadingProjects ? (
                <div className="flex items-center justify-center py-16 bg-card rounded-2xl border border-border">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : projects.length === 0 ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); handleNewProject(); }}
                  onClick={handleNewProject}
                  className={`text-center py-16 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                    dragging ? "border-accent bg-accent/5" : "border-border bg-card hover:border-primary/40 hover:bg-secondary/40"
                  }`}
                >
                  <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center ${dragging ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary"}`}>
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <p className="font-display font-700 text-foreground">
                    {dragging ? "Drop images to create a project" : "Start your first project"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Drop JPEG, TIFF, or DNG imagery to process — up to {tierLimits.imagesPerProject === Infinity ? "∞" : tierLimits.imagesPerProject.toLocaleString()} images per project
                  </p>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                    <Plus className="w-3.5 h-3.5" /> New Project
                  </Button>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
                  {projects.slice(0, 8).map((project) => (
                    <div
                      key={project.id}
                      className="p-4 hover:bg-secondary/40 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                          <Map className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-foreground text-sm truncate">{project.name}</h3>
                            <StatusBadge status={project.status as Status} />
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>{new Date(project.created_at).toLocaleDateString()}</span>
                            {project.image_count > 0 && (
                              <span className="flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />{project.image_count.toLocaleString()} images
                              </span>
                            )}
                            {project.area_ha && <span>{project.area_ha} ha</span>}
                            {project.outputs && project.outputs.length > 0 && (
                              <span className="text-primary font-medium">{project.outputs.length} outputs</span>
                            )}
                          </div>
                          {project.status === "processing" && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${project.progress ?? 0}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground">{project.progress}%</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          {project.status === "complete" && (
                            <Button variant="ghost" size="sm" className="hidden sm:flex gap-1.5 text-xs" onClick={() => navigate(`/viewer/${project.id}`)}>
                              <Eye className="w-3.5 h-3.5" /> View
                            </Button>
                          )}
                          {project.status === "queued" && (
                            <Button variant="ghost" size="sm" className="hidden sm:flex gap-1.5 text-xs" onClick={() => setDetailProject(project)}>
                              <Play className="w-3.5 h-3.5" /> Process
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setDetailProject(project)}>
                                <FileArchive className="w-3.5 h-3.5" /> Manage Files
                              </DropdownMenuItem>
                              {project.status === "complete" && (
                                <>
                                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate(`/viewer/${project.id}`)}>
                                    <Eye className="w-3.5 h-3.5" /> View Map
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleShareProject(project)}>
                                    <Share2 className="w-3.5 h-3.5" /> Copy Share Link {!tierLimits.shareLinks && <Lock className="w-3 h-3 text-muted-foreground ml-auto" />}
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                                onClick={() => deleteProject(project.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Quick actions</p>
                <div className="mt-3 space-y-2">
                  {[
                    { to: "/missions", title: "Saved Missions", desc: "Re-export flight plans", Icon: Bookmark, tone: "bg-primary/10 text-primary" },
                    { to: "/workflow", title: "Workflow Pipeline", desc: "Plan → capture → process", Icon: Workflow, tone: "bg-accent/15 text-accent-foreground" },
                    { to: "/fleet", title: "Fleet & Telemetry", desc: "Live drone status", Icon: Plane, tone: "bg-highlight/15 text-highlight" },
                  ].map(({ to, title, desc, Icon, tone }) => (
                    <button
                      key={to}
                      onClick={() => navigate(to)}
                      className="group w-full flex items-center gap-3 rounded-xl p-2.5 hover:bg-secondary/60 transition-colors text-left"
                    >
                      <div className={`w-9 h-9 rounded-lg ${tone} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Plan usage</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-display font-700 text-foreground">
                    {monthlyProjectCount}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {tierLimits.projectsPerMonth === Infinity ? "∞" : tierLimits.projectsPerMonth} projects
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tierLimits.tierLabel} plan · resets monthly
                </p>
                <Button asChild variant="outline" size="sm" className="w-full mt-4 gap-2">
                  <Link to="/subscription">Manage plan</Link>
                </Button>
              </div>
            </aside>
          </div>

          {/* Live drone telemetry */}
          <MyDronesPanel />

          {/* Modules bento */}
          <section className="space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Advanced</p>
              <h2 className="font-display font-700 text-foreground text-lg">Modules</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {[
                { to: "/swarm",      title: "Swarm Ops",       desc: "Multi-drone autonomy",      Icon: Boxes,       tone: "bg-primary/10 text-primary" },
                { to: "/reality",    title: "Reality Capture", desc: "Live 3D mesh + AR",         Icon: Radar,       tone: "bg-highlight/15 text-highlight" },
                { to: "/rtk",        title: "RTK / GCP",       desc: "Smart alignment",            Icon: Satellite,   tone: "bg-accent/15 text-accent-foreground" },
                { to: "/insights",   title: "AI Insights",     desc: "Auto metrics + PDF",         Icon: Brain,       tone: "bg-primary/10 text-primary" },
                { to: "/compliance", title: "Compliance",      desc: "Part 107 + LAANC",           Icon: ShieldCheck, tone: "bg-secondary text-foreground" },
                { to: "/splats",     title: "Gaussian Splats", desc: "Photoreal 3D scenes",        Icon: Sparkles,    tone: "bg-primary/10 text-primary" },
                { to: "/portfolio",  title: "Portfolio",       desc: "Public photo + video site",  Icon: Camera,      tone: "bg-accent/15 text-accent-foreground" },
                { to: "/portfolio/edit", title: "Video Editor",desc: "Cinematic reels + captions", Icon: Sparkles,    tone: "bg-highlight/15 text-highlight" },
              ].map((m) => {
                const Icon = m.Icon;
                return (
                  <button
                    key={m.to}
                    onClick={() => navigate(m.to)}
                    className="group bg-card border border-border rounded-xl p-3.5 text-left hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5 transition-all"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${m.tone}`}>
                      <Icon className="w-4 h-4" strokeWidth={2} />
                    </div>
                    <p className="font-display font-700 text-sm leading-tight text-foreground">{m.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{m.desc}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Project Detail Dialog */}
      <ProjectDetailDialog
        project={detailProject}
        open={!!detailProject}
        onClose={() => setDetailProject(null)}
        onProjectUpdated={(updated) => {
          setProjects((prev) => prev.map((p) => p.id === updated.id ? updated : p));
          setDetailProject(updated);
        }}
      />

      {/* New Project Dialog */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="projectName">Project name</Label>
              <Input
                id="projectName"
                placeholder="e.g. Farm Survey Block 4"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createProject()}
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              You can add imagery and configure processing settings after creation.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProjectOpen(false)}>Cancel</Button>
            <Button
              onClick={createProject}
              disabled={creating || !newProjectName.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : <><Plus className="w-4 h-4" />Create Project</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpgradePrompt
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature={upgradeFeature.feature}
        description={upgradeFeature.description}
      />
    </AppShell>
  );
}

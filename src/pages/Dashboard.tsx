import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Map, Plus, UploadCloud, MoreVertical, Clock,
  CheckCircle2, AlertCircle, Loader2, FolderOpen,
  Eye, Trash2, BarChart3, HardDrive,
  ArrowLeft, LogOut, Shield, User as UserIcon, FileArchive, ImageIcon,
  Play, Share2, Zap, Lock, CreditCard, Plane, Briefcase, Menu,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import ProjectDetailDialog from "@/components/ProjectDetailDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
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
  const canCreate = canCreateProject(subscriptionTier, monthlyProjectCount, isAdmin);

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
      setUpgradeFeature({
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
      setUpgradeFeature({
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

  const navItems = [
    { id: "projects" as SidebarView, icon: FolderOpen, label: "Projects" },
    { id: "analytics" as SidebarView, icon: BarChart3, label: "Analytics" },
    { id: "storage" as SidebarView, icon: HardDrive, label: "Storage" },
  ];

  // Gallery link in sidebar nav items (rendered separately below)

  const closeMobileNav = () => setMobileNavOpen(false);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-5 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2.5 group" onClick={closeMobileNav}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow">
            <Map className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-700 text-sidebar-foreground">Dronie</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = sidebarView === item.id;
          return (
            <button key={item.id}
              onClick={() => { setSidebarView(item.id); closeMobileNav(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </button>
          );
        })}

        <button
          onClick={() => { closeMobileNav(); navigate(latestComplete ? `/viewer/${latestComplete.id}` : '/gallery'); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <Eye className="w-4 h-4 flex-shrink-0" />
          Map Viewer
        </button>

        <button
          onClick={() => { closeMobileNav(); navigate('/gallery'); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <Map className="w-4 h-4 flex-shrink-0" />
          Sample Gallery
        </button>

        <button
          onClick={() => { closeMobileNav(); navigate('/fleet'); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <Plane className="w-4 h-4 flex-shrink-0" />
          Fleet
        </button>

        <button
          onClick={() => { closeMobileNav(); navigate('/jobs'); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <Briefcase className="w-4 h-4 flex-shrink-0" />
          Active Jobs
        </button>

        <button
          onClick={() => { closeMobileNav(); navigate('/subscription'); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <CreditCard className="w-4 h-4 flex-shrink-0" />
          Subscription
        </button>

        {isAdmin && (
          <button
            onClick={() => { closeMobileNav(); navigate('/admin'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <Shield className="w-4 h-4 flex-shrink-0" />
            User Management
          </button>
        )}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isSubscribed ? "bg-accent/15 border border-accent/20" : "bg-secondary border border-border"}`}>
          <Zap className={`w-3.5 h-3.5 flex-shrink-0 ${isSubscribed ? "text-accent" : "text-muted-foreground"}`} />
          <span className={`text-xs font-semibold ${isSubscribed ? "text-accent" : "text-muted-foreground"}`}>
            {tierLimits.tierLabel}
          </span>
          {tierLimits.priorityProcessing && (
            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-bold uppercase">Priority</span>
          )}
        </div>
        {isSubscribed && (
          <button
            onClick={async () => {
              closeMobileNav();
              try {
                const { data, error } = await supabase.functions.invoke('customer-portal');
                if (error) throw error;
                if (data?.url) window.open(data.url, '_blank');
              } catch {
                toast({ title: 'Unable to open subscription portal', variant: 'destructive' });
              }
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Manage Subscription
          </button>
        )}
        {isAdmin && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/15 border border-accent/20">
            <Shield className="w-3.5 h-3.5 text-accent flex-shrink-0" />
            <span className="text-xs font-semibold text-accent">Admin</span>
          </div>
        )}
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <UserIcon className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">
              {user?.user_metadata?.full_name || 'Pilot'}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => { closeMobileNav(); handleSignOut(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-sidebar-border min-h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile nav drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-secondary transition-colors flex-shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
            {/* Mobile tier badge */}
            <div className={`hidden sm:flex lg:hidden items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 ${isSubscribed ? "bg-accent/15 text-accent border border-accent/20" : "bg-secondary text-muted-foreground border border-border"}`}>
              <Zap className="w-3 h-3" />
              {tierLimits.tierLabel}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="font-display font-700 text-foreground text-base sm:text-lg truncate">
                  {sidebarView === "projects" ? "Projects" : sidebarView === "analytics" ? "Analytics" : "Storage"}
                </h1>
                {isAdmin && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-accent text-accent-foreground flex-shrink-0">
                    <Shield className="w-2.5 h-2.5" />
                    Admin
                  </span>
                )}
              </div>
              {sidebarView === "projects" && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {completeCount} complete · {processingCount} in queue
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {sidebarView === "projects" && (
              <>
                {/* Compact icon-only button on mobile */}
                <Button
                  onClick={handleNewProject}
                  size="icon"
                  className="sm:hidden bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm active:scale-[0.97]"
                  aria-label="New project"
                >
                  <Plus className="w-5 h-5" />
                </Button>
                <Button
                  onClick={handleNewProject}
                  className="hidden sm:inline-flex bg-primary text-primary-foreground hover:bg-primary/90 gap-2 shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
                >
                  <Plus className="w-4 h-4" />
                  New Project
                  {projectsRemaining !== Infinity && (
                    <span className="ml-1 text-[10px] opacity-70">({projectsRemaining} left)</span>
                  )}
                </Button>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 space-y-6 min-w-0">
          <PilotVerificationBanner hideWhenUnverified />
          {sidebarView === "analytics" && <AnalyticsPanel projects={projects} />}
          {sidebarView === "storage" && <StoragePanel projects={projects} tierLimits={tierLimits} />}

          {sidebarView === "projects" && (
            <>
              {/* Quick stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Projects", value: projects.length.toString(), icon: FolderOpen, color: "text-primary", bg: "bg-secondary" },
                  { label: "In Progress", value: processingCount.toString(), icon: Loader2, color: "text-accent", bg: "bg-accent/10" },
                  { label: "Images Uploaded", value: totalImages.toLocaleString() || "0", icon: BarChart3, color: "text-highlight", bg: "bg-highlight/10" },
                  { label: "Total Area", value: totalArea > 0 ? `${totalArea.toFixed(1)} ha` : "—", icon: Map, color: "text-primary", bg: "bg-secondary" },
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

              {/* Quick actions: Plan a Flight */}
              <button
                onClick={() => navigate(latestComplete ? `/plan?project=${latestComplete.id}` : '/plan')}
                className="w-full bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground rounded-2xl p-5 flex items-center gap-4 hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.005] active:scale-[0.99] transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-foreground/15 backdrop-blur flex items-center justify-center flex-shrink-0">
                  <Plane className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-700 text-base">Plan a Flight</h3>
                  <p className="text-xs text-primary-foreground/80 mt-0.5">
                    Step-by-step wizard: search address → outline area → export KMZ for DJI Fly and a PDF briefing.
                  </p>
                </div>
                <svg className="w-5 h-5 flex-shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>

              {/* Saved missions shortcut */}
              <button
                onClick={() => navigate('/missions')}
                className="w-full bg-card border border-border text-foreground rounded-2xl p-4 flex items-center gap-3 hover:border-primary/40 hover:bg-secondary/40 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-700 text-sm">Saved Missions</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Browse, re-export, or edit your flight plans.</p>
                </div>
                <svg className="w-4 h-4 flex-shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>

              {/* Workflow pipeline shortcut */}
              <button
                onClick={() => navigate('/workflow')}
                className="w-full bg-card border border-border text-foreground rounded-2xl p-4 flex items-center gap-3 hover:border-primary/40 hover:bg-secondary/40 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-accent-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-700 text-sm">Workflow Pipeline</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Plan → capture → process → analyze in one guided flow.</p>
                </div>
                <svg className="w-4 h-4 flex-shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>

              {/* Advanced modules grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { to: "/swarm",      title: "Swarm Ops",     desc: "Multi-drone autonomy",  emoji: "🛰️", tone: "bg-primary/10 text-primary" },
                  { to: "/reality",    title: "Reality Capture", desc: "Live 3D mesh + AR",   emoji: "🎯", tone: "bg-highlight/15 text-highlight" },
                  { to: "/rtk",        title: "RTK / GCP",     desc: "Smart alignment",        emoji: "📡", tone: "bg-accent/15 text-accent-foreground" },
                  { to: "/insights",   title: "AI Insights",   desc: "Auto metrics + PDF",     emoji: "🧠", tone: "bg-primary/10 text-primary" },
                  { to: "/compliance", title: "Compliance",    desc: "Part 107 + LAANC",       emoji: "🛡️", tone: "bg-secondary text-foreground" },
                  { to: "/splats",     title: "Gaussian Splats", desc: "Photoreal 3D scenes",  emoji: "✨", tone: "bg-primary/10 text-primary" },
                  { to: "/portfolio",  title: "Portfolio",     desc: "Public photo + video site", emoji: "📸", tone: "bg-accent/15 text-accent-foreground" },
                ].map((m) => (
                  <button
                    key={m.to}
                    onClick={() => navigate(m.to)}
                    className="bg-card border border-border rounded-xl p-3 text-left hover:border-primary/40 hover:bg-secondary/40 transition-all"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base mb-2 ${m.tone}`}>
                      <span aria-hidden>{m.emoji}</span>
                    </div>
                    <p className="font-display font-700 text-sm leading-tight">{m.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{m.desc}</p>
                  </button>
                ))}
              </div>

              {/* Upload drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handleNewProject();
                }}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                  dragging ? "border-accent bg-accent/5" : "border-border hover:border-primary/40 hover:bg-secondary/50"
                }`}
                onClick={handleNewProject}
              >
                <UploadCloud className={`w-10 h-10 mx-auto mb-3 transition-colors ${dragging ? "text-accent" : "text-muted-foreground"}`} />
                <p className="font-semibold text-foreground text-sm">
                  {dragging ? "Drop images to create a project" : "Drop drone images here to start a new project"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPEG, TIFF, DNG accepted · Up to {tierLimits.imagesPerProject === Infinity ? "∞" : tierLimits.imagesPerProject.toLocaleString()} images
                </p>
              </div>

              {/* Project list */}
              <div className="space-y-3">
                <h2 className="font-display font-600 text-foreground text-sm">
                  {isAdmin ? 'All Projects' : 'Your Projects'}
                </h2>

                {loadingProjects ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : projects.length === 0 ? (
                  <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border">
                    <Map className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="font-semibold text-foreground text-sm">No projects yet</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">Create your first project to start processing drone imagery</p>
                    <Button size="sm" onClick={handleNewProject} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                      <Plus className="w-3.5 h-3.5" /> New Project
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="bg-card border border-border rounded-xl p-4 hover:border-primary/20 hover:shadow-md transition-all duration-200 group cursor-pointer"
                        onClick={() => navigate(`/project/${project.id}`)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
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
                                <span className="text-primary font-medium">{project.outputs.length} outputs ready</span>
                              )}
                            </div>
                            {(project.status === "processing") && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-700 bg-accent"
                                    style={{ width: `${project.progress ?? 0}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">{project.progress}%</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            {project.status === "complete" && (
                              <Button
                                variant="ghost" size="sm"
                                className="hidden sm:flex gap-1.5 text-xs hover:text-primary transition-colors active:scale-[0.97]"
                                onClick={() => navigate(`/viewer/${project.id}`)}
                              >
                                <Eye className="w-3.5 h-3.5" /> View Map
                              </Button>
                            )}
                            {project.status === "queued" && (
                              <Button
                                variant="ghost" size="sm"
                                className="hidden sm:flex gap-1.5 text-xs hover:text-accent transition-colors active:scale-[0.97]"
                                onClick={() => setDetailProject(project)}
                              >
                                <Play className="w-3.5 h-3.5" /> Process
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="w-8 h-8 p-0 hover:bg-muted transition-colors">
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
              </div>
            </>
          )}
        </div>
      </main>

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
                onKeyDown={(e) => e.key === 'Enter' && createProject()}
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

      {/* Upgrade Prompt */}
      <UpgradePrompt
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature={upgradeFeature.feature}
        description={upgradeFeature.description}
      />
    </div>
  );
}

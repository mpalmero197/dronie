import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, ScaleControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import html2canvas from "html2canvas";
import {
  Map, ArrowLeft, Share2, CheckCircle2, Loader2, Plane,
} from "lucide-react";
import { Columns } from "lucide-react";
import { BeforeAfterSlider } from "@/components/project/BeforeAfterSlider";
import { Button } from "@/components/ui/button";
import { supabase, Project } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { canUseFeature } from "@/lib/subscription-limits";
import UpgradePrompt from "@/components/UpgradePrompt";
import MapToolbar, { DrawTool, KEYBOARD_SHORTCUT_MAP } from "@/components/map/MapToolbar";
import MapDrawingLayer, { MapDrawingLayerRef } from "@/components/map/MapDrawingLayer";
import MapInfoPanel from "@/components/map/MapInfoPanel";
import LayerSwitcher, { BaseLayer } from "@/components/map/LayerSwitcher";
import EmbedModal from "@/components/map/EmbedModal";
import OverlayLegend from "@/components/map/OverlayLegend";
import AddressSearch from "@/components/map/AddressSearch";
import PropertyLines from "@/components/map/PropertyLines";
import ParcelFetcher from "@/components/map/ParcelFetcher";
import FlightPlanner from "@/components/map/FlightPlanner";
import AirspaceOverlay from "@/components/map/AirspaceOverlay";
import LaancChecker from "@/components/map/LaancChecker";
import type { LaancResult } from "@/components/map/LaancChecker";
import MousePositionDisplay from "@/components/map/MousePositionDisplay";
import MapContextMenu from "@/components/map/MapContextMenu";
import WeatherWidget from "@/components/map/WeatherWidget";
import SunPositionWidget from "@/components/map/SunPosition";
import GeolocationButton from "@/components/map/GeolocationButton";
import BookmarksPanel from "@/components/map/BookmarksPanel";
import PlanCoachmark from "@/components/map/PlanCoachmark";

// Fix Leaflet default marker icon issue with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const TILE_URLS: Record<BaseLayer, { url: string; attribution: string }> = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  },
  terrain: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
  hybrid: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
};

// Inject geolocation pulse animation
const style = document.createElement("style");
style.textContent = `@keyframes pulse-geo{0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0.5)}70%{box-shadow:0 0 0 12px rgba(59,130,246,0)}}`;
if (!document.head.querySelector("[data-geo-pulse]")) {
  style.setAttribute("data-geo-pulse", "");
  document.head.appendChild(style);
}

export default function MapViewer() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const drawingLayerRef = useRef<MapDrawingLayerRef>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTool, setActiveTool] = useState<DrawTool>(null);
  const [showInfo, setShowInfo] = useState(true);
  const [baseLayer, setBaseLayer] = useState<BaseLayer>("satellite");
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);
  const [measurement, setMeasurement] = useState<string | null>(null);
  const [surveyPolygon, setSurveyPolygon] = useState<[number, number][] | null>(null);
  const [corridorLine, setCorridorLine] = useState<[number, number][] | null>(null);
  const [flightPlannerOpen, setFlightPlannerOpen] = useState(false);
  const [flightPlannerDrawing, setFlightPlannerDrawing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [undoRedoTick, setUndoRedoTick] = useState(0);
  const [laancResult, setLaancResult] = useState<LaancResult | null>(null);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState<{ feature: string; description: string } | null>(null);
  const [showCoachmark, setShowCoachmark] = useState(false);
  const [coachmarkForce, setCoachmarkForce] = useState(0);
  const [compareOpen, setCompareOpen] = useState(false);

  const { subscriptionTier, isAdmin } = useAuth();
  const hasPro = isAdmin || canUseFeature(subscriptionTier, "priorityProcessing");

  const gatedToolActivate = useCallback((tool: DrawTool) => {
    if ((tool === "flight-plan" || tool === "laanc-check") && !hasPro) {
      setUpgradePrompt({
        feature: tool === "flight-plan" ? "Flight Planner" : "LAANC Checker",
        description: tool === "flight-plan"
          ? "The Flight Planner lets you design automated survey patterns, export mission files, and generate PDF briefings. Upgrade to Professional to unlock this feature."
          : "The LAANC Checker verifies FAA airspace authorization at any location on the map. Upgrade to Professional to unlock this feature.",
      });
      return;
    }
    if (tool === "flight-plan") {
      setFlightPlannerOpen(v => {
        const next = !v;
        // When opening the planner, clear any other active tool so map clicks are
        // dedicated to flight-path editing only.
        if (next) setActiveTool(null);
        return next;
      });
      return;
    }
    // Don't allow activating other tools while the flight planner is open.
    if (flightPlannerOpen) return;
    setActiveTool(tool);
  }, [hasPro, flightPlannerOpen]);

  const launchPlanner = useCallback(() => {
    setActiveTool(null);
    setFlightPlannerOpen(true);
    setCoachmarkForce((n) => n + 1);
    setShowCoachmark(true);
  }, []);

  const prevOverlayRef = useRef<string | null>(null);

  // Old /viewer/demo links now route back to the dashboard.
  useEffect(() => {
    if (projectId === "demo") {
      navigate("/dashboard", { replace: true });
    }
  }, [projectId, navigate]);

  // Auto-launch planner when arriving with ?mode=plan
  useEffect(() => {
    if (searchParams.get("mode") === "plan" && hasPro) {
      launchPlanner();
      searchParams.delete("mode");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPro]);

  // Auto-enable airspace overlay when LAANC check is active
  useEffect(() => {
    if (activeTool === "laanc-check") {
      prevOverlayRef.current = activeOverlay;
      if (activeOverlay !== "airspace") {
        setActiveOverlay("airspace");
        sonnerToast("Airspace overlay enabled", {
          description: "Airspace zones are now visible on the map for your LAANC check.",
        });
      }
    } else {
      if (activeOverlay === "airspace" && prevOverlayRef.current !== "airspace") {
        setActiveOverlay(prevOverlayRef.current);
      }
    }
  }, [activeTool]);

  useEffect(() => {
    if (!projectId || projectId === "demo") return;
    async function fetchProject() {
      const { data, error } = await supabase
        .from("projects").select("*").eq("id", projectId!).single();
      if (error || !data) { setLoading(false); return; }
      setProject(data as Project);
      setLoading(false);
    }
    fetchProject();
  }, [projectId]);

  // Standalone /map mode (no projectId) — skip loading state.
  useEffect(() => {
    if (!projectId) setLoading(false);
  }, [projectId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === "escape") {
        setActiveTool(null);
        setBookmarksOpen(false);
        return;
      }
      if (key === "b") {
        setBookmarksOpen(prev => !prev);
        return;
      }
      const tool = KEYBOARD_SHORTCUT_MAP[key];
      if (tool) {
        setActiveTool(prev => prev === tool ? null : tool);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Fullscreen listeners
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!mapContainerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      mapContainerRef.current.requestFullscreen();
    }
  }, []);

  const shareLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied!", description: "Share this URL for public access." });
  }, [toast]);

  const exportPng = useCallback(async () => {
    if (!mapContainerRef.current) return;
    try {
      toast({ title: "Capturing…", description: "Generating map screenshot" });
      const canvas = await html2canvas(mapContainerRef.current, { useCORS: true, allowTaint: true });
      const link = document.createElement("a");
      link.download = `${project?.name || "map"}-export.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Exported!", description: "PNG saved to downloads." });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  }, [project, toast]);

  const handleUndo = useCallback(() => {
    drawingLayerRef.current?.undo();
    setUndoRedoTick(t => t + 1);
  }, []);

  const handleRedo = useCallback(() => {
    drawingLayerRef.current?.redo();
    setUndoRedoTick(t => t + 1);
  }, []);

  const handleDropPin = useCallback((pos: [number, number]) => {
    drawingLayerRef.current?.addMarkerAt(pos);
  }, []);

  const center: [number, number] = [37.7749, -122.4194];
  const tile = TILE_URLS[baseLayer];

  if (loading && projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Project route was requested but lookup failed — show not found.
  if (projectId && projectId !== "demo" && !project && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Map className="w-12 h-12 text-muted-foreground/40" />
        <h2 className="font-display font-700 text-foreground">Project not found</h2>
        <p className="text-sm text-muted-foreground max-w-md text-center px-6">
          This project doesn't exist or hasn't been shared with you. You can still open the standalone map viewer to plan a mission.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/dashboard")} variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Button>
          <Button onClick={() => navigate("/map")} className="gap-2">
            <Map className="w-4 h-4" /> Open Map Viewer
          </Button>
        </div>
      </div>
    );
  }

  if (project && project.status !== "complete") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <h2 className="font-display font-700 text-foreground">Processing in Progress</h2>
        <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${project.progress}%` }} />
        </div>
        <p className="text-sm font-semibold text-accent">{project.progress}%</p>
        <Button onClick={() => navigate("/dashboard")} variant="outline" className="gap-2 mt-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="z-[1000] bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate("/dashboard")} className="p-1.5 rounded-lg hover:bg-secondary transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Map className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-700 text-foreground text-sm truncate">{project?.name ?? "Map Viewer"}</p>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {project ? "Interactive map viewer" : "Plan missions, measure, and explore airspace"}
            </p>
          </div>
          {project?.status === "complete" && (
            <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <CheckCircle2 className="w-3 h-3" /> Complete
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {measurement && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-xs font-semibold text-accent">
              📐 {measurement}
            </div>
          )}
          <Button
            variant="outline" size="sm"
            onClick={() => setShowInfo(v => !v)}
            className="gap-1.5 text-xs"
          >
            Info
          </Button>
          {project?.outputs_urls?.orthomosaic && (
            <Button
              variant={compareOpen ? "default" : "outline"}
              size="sm"
              onClick={() => setCompareOpen(v => !v)}
              className="gap-1.5 text-xs"
            >
              <Columns className="w-3.5 h-3.5" /> Compare
            </Button>
          )}
          <Button
            size="sm" onClick={shareLink}
            className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Share2 className="w-3.5 h-3.5" /> Share
          </Button>
        </div>
      </header>

      {/* Illustrator-style workspace: tool rail | canvas | properties panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden bg-muted/30">
        {/* Left tool rail (docked) */}
        <MapToolbar
          variant="docked"
          activeTool={activeTool}
          onToolChange={gatedToolActivate}
          onExportPng={exportPng}
          onEmbedCode={() => setShowEmbed(true)}
          activeOverlay={activeOverlay}
          onOverlayChange={setActiveOverlay}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={drawingLayerRef.current?.canUndo ?? false}
          canRedo={drawingLayerRef.current?.canRedo ?? false}
          onFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
          onToggleBookmarks={() => setBookmarksOpen(v => !v)}
          bookmarksOpen={bookmarksOpen}
        />

        {/* Canvas — the map itself, inset with a subtle frame */}
        <div className="flex-1 relative overflow-hidden p-2 min-w-0">
          <div className="w-full h-full relative rounded-lg overflow-hidden border border-border shadow-inner" ref={mapContainerRef}>
        <MapContainer center={center} zoom={12} className="w-full h-full" zoomControl={true}>
          <TileLayer attribution={tile.attribution} url={tile.url} />
          {baseLayer === "hybrid" && (
            <TileLayer
              attribution='&copy; OSM'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              opacity={0.25}
            />
          )}
          <ScaleControl position="bottomleft" imperial metric />
          <MapDrawingLayer
            ref={drawingLayerRef}
            activeTool={flightPlannerOpen ? null : activeTool}
            onMeasurement={setMeasurement}
            onPolygonComplete={undefined}
            onPolylineComplete={undefined}
          />
          <LaancChecker active={!flightPlannerOpen && activeTool === "laanc-check"} onResult={setLaancResult} />
          <AddressSearch />
          <PropertyLines />
          <ParcelFetcher active={!flightPlannerOpen && activeTool === "fetch-parcels"} />
          <FlightPlanner
            active={flightPlannerOpen}
            surveyPolygon={surveyPolygon}
            corridorLine={corridorLine}
            projectId={projectId}
            mapContainerRef={mapContainerRef}
            onPolygonEdit={setSurveyPolygon}
            onCorridorEdit={setCorridorLine}
            laancResult={laancResult}
            onDrawingStateChange={setFlightPlannerDrawing}
            onClose={() => {
              setFlightPlannerOpen(false);
              setSurveyPolygon(null);
              setCorridorLine(null);
              setActiveTool(null);
              setFlightPlannerDrawing(false);
            }}
          />
          <MousePositionDisplay />
          {!flightPlannerOpen && <MapContextMenu onDropPin={handleDropPin} />}
          <GeolocationButton />
          <WeatherWidget />
          <SunPositionWidget />
          <BookmarksPanel projectId={projectId} open={bookmarksOpen} onClose={() => setBookmarksOpen(false)} />
        </MapContainer>

        {/* Upgrade Prompt */}
        <UpgradePrompt
          open={!!upgradePrompt}
          onClose={() => setUpgradePrompt(null)}
          feature={upgradePrompt?.feature ?? ""}
          description={upgradePrompt?.description ?? ""}
          requiredTier="professional"
        />

        {/* Overlay Legend */}
        {activeOverlay && <OverlayLegend type={activeOverlay as "elevation" | "ndvi" | "airspace"} />}

        {/* Sticky Plan Mission FAB — always visible */}
        {!flightPlannerOpen && (
          <button
            onClick={launchPlanner}
            className="absolute bottom-3 right-3 z-[950] bg-primary text-primary-foreground rounded-full pl-4 pr-5 py-3 shadow-2xl hover:shadow-primary/40 hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-2 font-semibold text-sm border-2 border-primary-foreground/10"
            aria-label="Plan a drone mission"
          >
            <Plane className="w-4 h-4" />
            Plan Mission
          </button>
        )}

        {/* Onboarding coachmark */}
        {showCoachmark && (
          <PlanCoachmark
            forceShow
            key={coachmarkForce}
            onClose={() => setShowCoachmark(false)}
          />
        )}

        {/* Embed Modal */}
        {showEmbed && projectId && <EmbedModal projectId={projectId} onClose={() => setShowEmbed(false)} />}

        {/* Before/After compare overlay */}
        {compareOpen && project?.outputs_urls?.orthomosaic && (
          <div className="absolute inset-0 z-[1100] bg-background/95 backdrop-blur p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display font-700 text-foreground text-sm">Before / After</p>
                <p className="text-[11px] text-muted-foreground">Drag the handle to wipe between satellite basemap and the processed orthomosaic.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setCompareOpen(false)}>Close</Button>
            </div>
            <div className="flex-1 min-h-0">
              <BeforeAfterSlider
                beforeUrl={`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1583/655`}
                afterUrl={project.outputs_urls.orthomosaic as string}
                beforeLabel="Satellite"
                afterLabel="Orthomosaic"
                className="h-full !aspect-auto"
              />
            </div>
          </div>
        )}
          </div>
        </div>

        {/* Right properties panel (docked) */}
        {showInfo && (
          <aside className="hidden md:flex w-64 flex-col bg-card border-l border-border overflow-y-auto">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Properties</p>
            </div>
            <div className="p-3 space-y-4">
              {project && <MapInfoPanel variant="docked" project={project} pinCount={0} measurement={measurement} />}
              <div className="h-px bg-border/60" />
              <LayerSwitcher variant="docked" activeLayer={baseLayer} onChange={setBaseLayer} />
              {activeOverlay && (
                <>
                  <div className="h-px bg-border/60" />
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70 pb-1.5">Active overlay</p>
                    <p className="text-xs font-semibold text-foreground capitalize">{activeOverlay}</p>
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Bottom status bar — Illustrator-style */}
      <div className="flex-shrink-0 h-7 bg-card border-t border-border px-3 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${activeTool ? "bg-primary animate-pulse" : "bg-muted-foreground/40"}`} />
            {activeTool
              ? (activeTool === "measure-distance" ? "Measure distance · click, dbl-click to finish" :
                 activeTool === "measure-area" ? "Measure area · click, dbl-click to finish" :
                 activeTool === "polyline" ? "Line · click, dbl-click to finish" :
                 activeTool === "polygon" ? "Polygon · click, dbl-click to finish" :
                 activeTool === "rectangle" ? "Rectangle · click two corners" :
                 activeTool === "circle" ? "Circle · click center then edge" :
                 activeTool === "fetch-parcels" ? "Fetch parcels · click a location" :
                 activeTool === "laanc-check" ? "LAANC · click to check authorization" :
                 activeTool === "marker" ? "Pin · click to place" :
                 activeTool === "bearing" ? "Bearing · click two points" :
                 "Ready")
              : "Ready — select a tool or right-click the canvas"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {measurement && <span className="text-accent font-semibold">{measurement}</span>}
          <span>Base: <span className="text-foreground">{baseLayer}</span></span>
          <button onClick={() => setShowInfo(v => !v)} className="hover:text-foreground transition-colors">
            {showInfo ? "Hide panel" : "Show panel"}
          </button>
        </div>
      </div>
      </div>
  );
}

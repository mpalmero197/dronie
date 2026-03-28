import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, ScaleControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import html2canvas from "html2canvas";
import {
  Map, ArrowLeft, Share2, CheckCircle2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, Project } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import MapToolbar, { DrawTool } from "@/components/map/MapToolbar";
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

// Fix Leaflet default marker icon issue with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const DEMO_PROJECT: Project = {
  id: "demo",
  user_id: "demo",
  name: "Example: Farm Survey Block 4",
  description: "Demonstration orthomosaic — Rio Grande Valley, TX",
  image_count: 842,
  area_ha: 47.3,
  status: "complete",
  progress: 100,
  outputs: ["GeoTIFF", "LAZ Point Cloud", "DSM", "DTM", "Contours SHP", "Flight Report PDF"],
  outputs_urls: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_CENTER: [number, number] = [26.2034, -98.2300];

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [undoRedoTick, setUndoRedoTick] = useState(0);
  const [laancResult, setLaancResult] = useState<LaancResult | null>(null);

  const isDemo = projectId === "demo";
  const prevOverlayRef = useRef<string | null>(null);

  // Auto-enable airspace overlay when LAANC check is active
  useEffect(() => {
    if (activeTool === "laanc-check") {
      prevOverlayRef.current = activeOverlay;
      setActiveOverlay("airspace");
    } else {
      if (activeOverlay === "airspace" && prevOverlayRef.current !== "airspace") {
        setActiveOverlay(prevOverlayRef.current);
      }
    }
  }, [activeTool]);

  useEffect(() => {
    if (isDemo) {
      setProject(DEMO_PROJECT);
      setLoading(false);
      return;
    }
    async function fetchProject() {
      const { data, error } = await supabase
        .from("projects").select("*").eq("id", projectId!).single();
      if (error || !data) { setLoading(false); return; }
      setProject(data as Project);
      setLoading(false);
    }
    fetchProject();
  }, [projectId, isDemo]);

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

  const center: [number, number] = isDemo ? DEMO_CENTER : [37.7749, -122.4194];
  const tile = TILE_URLS[baseLayer];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Map className="w-12 h-12 text-muted-foreground/40" />
        <h2 className="font-display font-700 text-foreground">Project not found</h2>
        <Button onClick={() => navigate("/dashboard")} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  if (project.status !== "complete" && !isDemo) {
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
            <p className="font-display font-700 text-foreground text-sm truncate">{project.name}</p>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {isDemo ? "Demo · Public viewer" : "Interactive map viewer"}
            </p>
          </div>
          {project.status === "complete" && (
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
            className="gap-1.5 text-xs hidden sm:flex"
          >
            Info
          </Button>
          <Button
            size="sm" onClick={shareLink}
            className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Share2 className="w-3.5 h-3.5" /> Share
          </Button>
        </div>
      </header>

      {/* Map */}
      <div className="flex-1 relative overflow-hidden" ref={mapContainerRef}>
        <MapContainer center={center} zoom={isDemo ? 14 : 12} className="w-full h-full" zoomControl={true}>
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
            activeTool={activeTool}
            onMeasurement={setMeasurement}
            onPolygonComplete={flightPlannerOpen ? (pts) => setSurveyPolygon(pts) : undefined}
            onPolylineComplete={flightPlannerOpen ? (pts) => setCorridorLine(pts) : undefined}
          />
          <LaancChecker active={activeTool === "laanc-check"} onResult={setLaancResult} />
          <AddressSearch />
          <PropertyLines />
          <ParcelFetcher active={activeTool === "fetch-parcels"} />
          <FlightPlanner
            active={flightPlannerOpen}
            surveyPolygon={surveyPolygon}
            corridorLine={corridorLine}
            projectId={projectId}
            mapContainerRef={mapContainerRef}
            onPolygonEdit={setSurveyPolygon}
            laancResult={laancResult}
            onClose={() => {
              setFlightPlannerOpen(false);
              setSurveyPolygon(null);
              setCorridorLine(null);
              setActiveTool(null);
            }}
          />
          <MousePositionDisplay />
          <MapContextMenu onDropPin={handleDropPin} />
          <GeolocationButton />
          <WeatherWidget />
          <SunPositionWidget />
        </MapContainer>

        {/* Toolbar */}
        <MapToolbar
          activeTool={activeTool}
          onToolChange={(tool) => {
            if (tool === "flight-plan") {
              setFlightPlannerOpen(v => !v);
              setActiveTool(v => v === "flight-plan" ? "polygon" : "polygon");
              return;
            }
            setActiveTool(tool);
          }}
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
        />

        {/* Layer Switcher */}
        <LayerSwitcher activeLayer={baseLayer} onChange={setBaseLayer} />

        {/* Info Panel */}
        {showInfo && <MapInfoPanel project={project} pinCount={0} measurement={measurement} />}

        {/* Overlay Legend */}
        {activeOverlay && <OverlayLegend type={activeOverlay as "elevation" | "ndvi" | "airspace"} />}

        {/* Hint */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[900] pointer-events-none">
          <div className="bg-card/90 backdrop-blur rounded-full px-3 py-1.5 border border-border shadow text-[11px] text-muted-foreground flex items-center gap-2">
            {activeTool
              ? `${activeTool === "measure-distance" ? "Click to measure distance, double-click to finish" :
                  activeTool === "measure-area" ? "Click to draw area, double-click to finish" :
                  activeTool === "polyline" ? "Click to draw line, double-click to finish" :
                  activeTool === "polygon" ? (flightPlannerOpen ? "Draw survey area polygon, double-click to finish" : "Click to draw polygon, double-click to finish") :
                  activeTool === "rectangle" ? "Click two corners" :
                  activeTool === "circle" ? "Click center, then edge" :
                  activeTool === "fetch-parcels" ? "Click on the map to fetch parcel boundaries" :
                  activeTool === "laanc-check" ? "Click anywhere to check LAANC authorization status" :
                  "Click on the map to place a pin"}`
              : "Select a tool or right-click for quick actions"}
          </div>
        </div>

        {/* Embed Modal */}
        {showEmbed && projectId && <EmbedModal projectId={projectId} onClose={() => setShowEmbed(false)} />}
      </div>
    </div>
  );
}

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, Polygon as LeafletPolygon, Polyline, Marker, CircleMarker, useMap, useMapEvents, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowLeft, ArrowRight, Search, MapPin, Pentagon, Sparkles, Loader2,
  Download, FileText, Plane, Home, CheckCircle2, X, Undo2, Map as MapIcon,
  Building2, RotateCcw, CornerDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { canUseFeature } from "@/lib/subscription-limits";
import { supabase } from "@/integrations/supabase/client";
import {
  haversineDistance, polygonArea, generateLawnmowerPath, calculateGSD,
} from "@/lib/flightPathGenerators";
import { generateMissionPDF } from "@/lib/generateMissionPDF";
import { generateDJIFlyKMZ } from "@/lib/generateDJIFlyKMZ";
import { generateKML, generateGeoJSON, generateWaypointCSV, downloadBlob } from "@/lib/exportFlightPlan";
import MissionEstimateOverlay from "@/components/plan/MissionEstimateOverlay";

// Fix Leaflet icons (Vite)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface SearchResult { display_name: string; lat: string; lon: string; }
interface Step { id: 1 | 2 | 3; label: string; sub: string; icon: typeof Search; }

const STEPS: Step[] = [
  { id: 1, label: "Locate", sub: "Search address or place", icon: Search },
  { id: 2, label: "Outline", sub: "Draw or auto-suggest area", icon: Pentagon },
  { id: 3, label: "Configure", sub: "Tune & export", icon: Plane },
];

const DRONE_MODELS = [
  { name: "DJI Mavic 3", batteryMinutes: 43, maxSpeed: 15 },
  { name: "DJI Mavic Air 2S", batteryMinutes: 31, maxSpeed: 12 },
  { name: "DJI Mini 4 Pro", batteryMinutes: 34, maxSpeed: 10 },
  { name: "DJI Phantom 4 Pro", batteryMinutes: 30, maxSpeed: 14 },
  { name: "DJI Matrice 300", batteryMinutes: 55, maxSpeed: 17 },
];

const homeIcon = new L.DivIcon({
  className: "",
  html: `<div style="width:24px;height:24px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
  </div>`,
  iconSize: [24, 24], iconAnchor: [12, 12],
});

const vertexIcon = new L.DivIcon({
  className: "",
  html: `<div style="width:12px;height:12px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:grab"></div>`,
  iconSize: [12, 12], iconAnchor: [6, 6],
});

const snapIndicatorIcon = new L.DivIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:rgba(245,158,11,0.25);border:2px solid #f59e0b;pointer-events:none"></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9],
});

// ---------- Map helpers ----------

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 17, { duration: 0.8 });
  }, [target, map]);
  return null;
}

interface DrawProps {
  polygon: [number, number][];
  setPolygon: (p: [number, number][]) => void;
  drawing: boolean;
  setDrawing: (b: boolean) => void;
}

function PolygonDrawer({ polygon, setPolygon, drawing, setDrawing }: DrawProps) {
  const map = useMap();
  const [cursor, setCursor] = useState<L.LatLng | null>(null);
  const [snap, setSnap] = useState<[number, number] | null>(null);
  const SNAP = 14;

  const findSnap = useCallback((ll: L.LatLng): [number, number] | null => {
    if (polygon.length === 0) return null;
    const pt = map.latLngToContainerPoint(ll);
    let best: { p: [number, number]; d: number } | null = null;
    for (const c of polygon) {
      const cp = map.latLngToContainerPoint(L.latLng(c[0], c[1]));
      const d = pt.distanceTo(cp);
      if (d <= SNAP && (!best || d < best.d)) best = { p: c, d };
    }
    return best ? best.p : null;
  }, [polygon, map]);

  useMapEvents({
    click(e) {
      if (!drawing) return;
      const s = findSnap(e.latlng);
      // Close polygon when clicking first vertex
      if (s && polygon.length >= 3 && s[0] === polygon[0][0] && s[1] === polygon[0][1]) {
        setDrawing(false);
        setCursor(null); setSnap(null);
        return;
      }
      const pt: [number, number] = s ?? [e.latlng.lat, e.latlng.lng];
      setPolygon([...polygon, pt]);
    },
    mousemove(e) {
      if (!drawing) return;
      setCursor(e.latlng);
      setSnap(findSnap(e.latlng));
    },
  });

  // Cursor + keyboard
  useEffect(() => {
    if (!drawing) { setCursor(null); setSnap(null); return; }
    map.getContainer().style.cursor = "crosshair";
    return () => { map.getContainer().style.cursor = ""; };
  }, [drawing, map]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!drawing) return;
      if (e.key === "Escape") { setPolygon([]); setCursor(null); setSnap(null); }
      else if (e.key === "Enter" && polygon.length >= 3) { setDrawing(false); setCursor(null); setSnap(null); }
      else if ((e.key === "z" || e.key === "Z") && polygon.length > 0) setPolygon(polygon.slice(0, -1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawing, polygon, setPolygon, setDrawing]);

  return (
    <>
      {/* Closed polygon */}
      {polygon.length >= 3 && (
        <LeafletPolygon
          positions={polygon}
          pathOptions={{ color: "#2563eb", weight: 2, fillOpacity: 0.12, dashArray: drawing ? "6 4" : undefined }}
        />
      )}
      {polygon.length === 2 && drawing && (
        <Polyline positions={polygon} pathOptions={{ color: "#2563eb", weight: 2, dashArray: "6 4" }} />
      )}
      {/* Vertex handles when not drawing */}
      {!drawing && polygon.map((p, i) => (
        <Marker
          key={`v-${i}`}
          position={p}
          icon={vertexIcon}
          draggable
          eventHandlers={{
            dragend: (ev) => {
              const ll = (ev.target as L.Marker).getLatLng();
              const updated = [...polygon];
              updated[i] = [ll.lat, ll.lng];
              setPolygon(updated);
            },
          }}
        />
      ))}
      {/* Drawing-mode vertex dots */}
      {drawing && polygon.map((p, i) => (
        <CircleMarker key={`d-${i}`} center={p} radius={5}
          pathOptions={{ color: "#ffffff", fillColor: "#2563eb", fillOpacity: 1, weight: 2 }} />
      ))}
      {/* Rubber band */}
      {drawing && cursor && polygon.length > 0 && (
        <>
          <Polyline
            positions={[polygon[polygon.length - 1], snap ?? [cursor.lat, cursor.lng]]}
            pathOptions={{ color: "#2563eb", weight: 2, dashArray: "2 6", opacity: 0.7 }}
          />
          {polygon.length >= 2 && (
            <Polyline
              positions={[snap ?? [cursor.lat, cursor.lng], polygon[0]]}
              pathOptions={{ color: "#2563eb", weight: 1.5, dashArray: "2 6", opacity: 0.4 }}
            />
          )}
        </>
      )}
      {drawing && snap && (
        <Marker position={snap} icon={snapIndicatorIcon} interactive={false} />
      )}
    </>
  );
}

interface ParcelHit { id: string; name: string; type: string; coords: [number, number][]; }

// Auto-suggest: fetch parcels around center, show them, user clicks one to use as polygon
function AutoSuggestLayer({
  center, parcels, onPick,
}: {
  center: [number, number] | null;
  parcels: ParcelHit[];
  onPick: (p: ParcelHit) => void;
}) {
  if (parcels.length === 0) return null;
  return (
    <>
      {parcels.map((p) => (
        <LeafletPolygon
          key={p.id}
          positions={p.coords}
          pathOptions={{ color: "#f59e0b", weight: 2, fillOpacity: 0.12, fillColor: "#f59e0b" }}
          eventHandlers={{
            click: () => onPick(p),
            mouseover: (e) => (e.target as L.Polygon).setStyle({ fillOpacity: 0.3, weight: 3 }),
            mouseout: (e) => (e.target as L.Polygon).setStyle({ fillOpacity: 0.12, weight: 2 }),
          }}
        />
      ))}
    </>
  );
}

// ---------- Main wizard ----------

export default function PlanWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, subscriptionTier, isAdmin } = useAuth();
  const hasPro = isAdmin || canUseFeature(subscriptionTier, "priorityProcessing");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const projectId = searchParams.get("project") || null;

  // Step 1
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [locationLabel, setLocationLabel] = useState("");

  // Step 2
  const [polygon, setPolygon] = useState<[number, number][]>([]);
  const [drawing, setDrawing] = useState(false);
  const [parcels, setParcels] = useState<ParcelHit[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);

  // Step 3
  const [altitude, setAltitude] = useState(60);
  const [frontOverlap, setFrontOverlap] = useState(75);
  const [sideOverlap, setSideOverlap] = useState(65);
  const [heading, setHeading] = useState(0);
  const [speed, setSpeed] = useState(8);
  const [droneIdx, setDroneIdx] = useState(0);
  const [returnToHome, setReturnToHome] = useState(true);
  const [homePosition, setHomePosition] = useState<[number, number] | null>(null);

  // Default home to first polygon vertex
  useEffect(() => {
    if (polygon.length >= 3 && !homePosition) setHomePosition([polygon[0][0], polygon[0][1]]);
  }, [polygon, homePosition]);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 3) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`,
          { headers: { "Accept-Language": "en" } }
        );
        const data: SearchResult[] = await res.json();
        setResults(data);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);
  }, [query]);

  const pickResult = (r: SearchResult) => {
    const lat = parseFloat(r.lat); const lng = parseFloat(r.lon);
    setCenter([lat, lng]);
    setLocationLabel(r.display_name);
    setQuery(r.display_name);
    setResults([]);
  };

  const fetchParcels = useCallback(async () => {
    if (!center) return;
    setAutoLoading(true);
    setParcels([]);
    try {
      const radius = 150;
      const q = `[out:json][timeout:15];(way(around:${radius},${center[0]},${center[1]})["building"];way(around:${radius},${center[0]},${center[1]})["landuse"];);out geom;`;
      const resp = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(q)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (!resp.ok) throw new Error("Overpass API error");
      const json = await resp.json();
      const hits: ParcelHit[] = [];
      for (const el of json.elements || []) {
        if (el.type === "way" && el.geometry && el.geometry.length >= 3) {
          const coords: [number, number][] = el.geometry.map((g: any) => [g.lat, g.lon]);
          hits.push({
            id: String(el.id),
            name: el.tags?.name || el.tags?.["addr:street"] || `Boundary ${el.id}`,
            type: el.tags?.building || el.tags?.landuse || "area",
            coords,
          });
        }
      }
      setParcels(hits);
      if (hits.length === 0) {
        toast({ title: "No boundaries found", description: "Try drawing manually instead." });
      } else {
        toast({ title: `${hits.length} suggestion(s) found`, description: "Click one on the map to use it." });
      }
    } catch (err: any) {
      toast({ title: "Fetch failed", description: err.message, variant: "destructive" });
    } finally {
      setAutoLoading(false);
    }
  }, [center, toast]);

  const pickParcel = (p: ParcelHit) => {
    // Keep only every Nth point if very dense (Overpass returns 50–500+)
    const max = 60;
    const step = Math.max(1, Math.floor(p.coords.length / max));
    const simplified = p.coords.filter((_, i) => i % step === 0);
    setPolygon(simplified);
    setParcels([]);
    setHomePosition(null);
    toast({ title: `Using "${p.name}"`, description: `${simplified.length} vertices loaded.` });
  };

  const restartDraw = () => {
    setPolygon([]);
    setHomePosition(null);
    setDrawing(true);
    setParcels([]);
  };

  // ---------- Mission stats ----------
  const result = useMemo(() => {
    if (polygon.length < 3) return null;
    return generateLawnmowerPath(polygon, altitude, frontOverlap, sideOverlap, heading);
  }, [polygon, altitude, frontOverlap, sideOverlap, heading]);

  const stats = useMemo(() => {
    if (!result || result.length < 2) return null;
    let dist = 0;
    for (let i = 1; i < result.length; i++) dist += haversineDistance(result[i - 1], result[i]);
    if (homePosition && result.length > 0) {
      dist += haversineDistance(homePosition, result[0]);
      if (returnToHome) dist += haversineDistance(result[result.length - 1], homePosition);
    }
    const drone = DRONE_MODELS[droneIdx];
    const flightTime = dist / speed;
    const usable = drone.batteryMinutes * 60 * 0.85;
    const batteries = Math.ceil(flightTime / usable);
    return {
      waypoints: result.length,
      distance: dist,
      area: polygonArea(polygon),
      flightTime,
      batteries,
      gsd: calculateGSD(altitude),
      droneName: drone.name,
    };
  }, [result, polygon, altitude, speed, droneIdx, homePosition, returnToHome]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  const formatDist = (m: number) => m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(2)} km`;
  const formatArea = (m: number) => m < 10000 ? `${m.toFixed(0)} m²` : `${(m / 10000).toFixed(2)} ha`;

  // ---------- Exports ----------
  const exportKMZ = useCallback(async () => {
    if (!result) return;
    try {
      const blob = await generateDJIFlyKMZ({
        waypoints: result, altitude, speed, heading,
        name: locationLabel || "Mission",
        homePosition: homePosition ?? undefined,
      });
      downloadBlob(blob, `${(locationLabel || "mission").replace(/[^\w-]+/g, "_")}.kmz`);
      toast({ title: "KMZ exported", description: "Import into DJI Fly." });
    } catch {
      toast({ title: "KMZ export failed", variant: "destructive" });
    }
  }, [result, altitude, speed, heading, homePosition, locationLabel, toast]);

  const exportKML = useCallback(() => {
    if (!result) return;
    try {
      const blob = generateKML({
        waypoints: result, altitude, speed, heading,
        name: locationLabel || "Mission",
        homePosition, polygon,
      });
      downloadBlob(blob, `${(locationLabel || "mission").replace(/[^\w-]+/g, "_")}.kml`);
      toast({ title: "KML exported", description: "Compatible with Google Earth, QGIS, Litchi, etc." });
    } catch {
      toast({ title: "KML export failed", variant: "destructive" });
    }
  }, [result, altitude, speed, heading, homePosition, polygon, locationLabel, toast]);

  const exportGeoJSON = useCallback(() => {
    if (!result) return;
    try {
      const blob = generateGeoJSON({
        waypoints: result, altitude, speed, heading,
        name: locationLabel || "Mission",
        homePosition, polygon,
      });
      downloadBlob(blob, `${(locationLabel || "mission").replace(/[^\w-]+/g, "_")}.geojson`);
      toast({ title: "GeoJSON exported" });
    } catch {
      toast({ title: "GeoJSON export failed", variant: "destructive" });
    }
  }, [result, altitude, speed, heading, homePosition, polygon, locationLabel, toast]);

  const exportCSV = useCallback(() => {
    if (!result) return;
    try {
      const blob = generateWaypointCSV({
        waypoints: result, altitude, speed, heading,
        name: locationLabel || "Mission",
      });
      downloadBlob(blob, `${(locationLabel || "mission").replace(/[^\w-]+/g, "_")}-waypoints.csv`);
      toast({ title: "CSV waypoints exported" });
    } catch {
      toast({ title: "CSV export failed", variant: "destructive" });
    }
  }, [result, altitude, speed, heading, locationLabel, toast]);

  const exportPDF = useCallback(async () => {
    if (!result || !stats) return;
    try {
      const blob = generateMissionPDF({
        stats: {
          waypoints: stats.waypoints,
          distance: stats.distance,
          area: stats.area,
          flightTime: stats.flightTime,
          gsd: stats.gsd,
          photos: result.length,
          batteriesNeeded: stats.batteries,
          batteryPercent: Math.min(100, Math.round((stats.flightTime / (DRONE_MODELS[droneIdx].batteryMinutes * 60 * 0.85)) * 100)),
          droneName: stats.droneName,
        },
        params: {
          altitude, frontOverlap, sideOverlap, heading, speed,
          pattern: "single", crossHeadingOffset: 90,
          droneModelIdx: droneIdx, terrainFollow: false,
        },
        waypoints: result,
        mapScreenshot: "",
        projectName: locationLabel || "Mission",
        terrainData: null,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "mission-briefing.pdf"; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "PDF briefing exported" });
    } catch {
      toast({ title: "PDF export failed", variant: "destructive" });
    }
  }, [result, stats, altitude, frontOverlap, sideOverlap, heading, speed, droneIdx, locationLabel, toast]);

  const saveToProject = useCallback(async () => {
    if (!user || polygon.length < 3 || !result) return;
    if (!projectId) {
      toast({
        title: "No project selected",
        description: "Open this wizard from a project to attach the mission.",
        variant: "destructive",
      });
      return;
    }
    try {
      const baseName = (locationLabel || `Mission ${new Date().toLocaleDateString()}`).slice(0, 80);
      const safeName = baseName.replace(/[^\w-]+/g, "_");

      // 1. Save reusable copy into the planner library
      const { error: libErr } = await supabase.from("saved_flight_plans").insert({
        user_id: user.id,
        project_id: projectId,
        name: baseName,
        polygon: polygon as any,
        home_position: homePosition as any,
        params: {
          altitude, frontOverlap, sideOverlap, heading, speed,
          pattern: "single", crossHeadingOffset: 90,
          droneModelIdx: droneIdx, terrainFollow: false,
          gimbalPitchStart: -90, gimbalPitchEnd: -90,
        } as any,
      });
      if (libErr) throw libErr;

      // 2. Generate a KMZ and upload it as an actual project flight plan
      const blob = await generateDJIFlyKMZ({
        waypoints: result, altitude, speed, heading,
        name: baseName,
        homePosition: homePosition ?? undefined,
      });
      const fileName = `${safeName}_${Date.now()}.kmz`;
      const path = `${user.id}/${projectId}/${fileName}`;
      const { error: upErr } = await supabase.storage
        .from("flight-plans")
        .upload(path, blob, { contentType: "application/vnd.google-earth.kmz", upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("flight_plans").insert({
        project_id: projectId,
        user_id: user.id,
        file_name: fileName,
        file_path: path,
        file_size: blob.size,
        file_type: "kmz",
      });
      if (insErr) throw insErr;

      toast({
        title: "Mission saved to project",
        description: "Available in the project's Flight Plans tab.",
      });
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err?.message ?? "Something went wrong.",
        variant: "destructive",
      });
    }
  }, [user, polygon, result, homePosition, altitude, frontOverlap, sideOverlap, heading, speed, droneIdx, projectId, locationLabel, toast]);

  // ---------- Step gating ----------
  const canAdvance = step === 1 ? !!center : step === 2 ? polygon.length >= 3 : true;

  if (!hasPro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-4">
        <Plane className="w-12 h-12 text-primary" />
        <h2 className="font-display font-700 text-foreground text-xl">Mission Wizard is a Pro feature</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Upgrade to design automated survey flights, export KMZ for DJI Fly, and generate PDF briefings.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Back</Button>
          <Button onClick={() => navigate("/subscription")}>View plans</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between gap-3 z-[1000]">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Plane className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-700 text-foreground text-sm truncate">Mission Planner</p>
            <p className="text-xs text-muted-foreground hidden sm:block">3-step survey wizard</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="hidden sm:flex items-center gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                  active ? "bg-primary text-primary-foreground"
                    : done ? "bg-primary/15 text-primary"
                    : "bg-secondary text-muted-foreground"
                }`}>
                  {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  <span>{s.id}. {s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`h-px w-6 ${done ? "bg-primary" : "bg-border"}`} />}
              </div>
            );
          })}
        </div>

        {/* Mobile step indicator */}
        <div className="sm:hidden text-xs font-semibold text-foreground">Step {step}/3</div>
      </header>

      {/* Body: side panel + map */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left panel */}
        <aside className="w-full lg:w-[380px] lg:flex-shrink-0 bg-card border-b lg:border-b-0 lg:border-r border-border overflow-y-auto p-4 space-y-4 max-h-[40vh] lg:max-h-none">
          {step === 1 && (
            <Step1
              query={query} setQuery={setQuery}
              searching={searching} results={results}
              pickResult={pickResult}
              center={center} locationLabel={locationLabel}
            />
          )}
          {step === 2 && (
            <Step2
              center={center}
              polygon={polygon}
              drawing={drawing} setDrawing={setDrawing}
              parcels={parcels} fetchParcels={fetchParcels}
              autoLoading={autoLoading}
              restartDraw={restartDraw}
              clear={() => { setPolygon([]); setHomePosition(null); }}
            />
          )}
          {step === 3 && (
            <Step3
              stats={stats}
              altitude={altitude} setAltitude={setAltitude}
              frontOverlap={frontOverlap} setFrontOverlap={setFrontOverlap}
              sideOverlap={sideOverlap} setSideOverlap={setSideOverlap}
              heading={heading} setHeading={setHeading}
              speed={speed} setSpeed={setSpeed}
              droneIdx={droneIdx} setDroneIdx={setDroneIdx}
              returnToHome={returnToHome} setReturnToHome={setReturnToHome}
              hasHome={!!homePosition}
              exportKMZ={exportKMZ} exportKML={exportKML}
              exportGeoJSON={exportGeoJSON} exportCSV={exportCSV}
              exportPDF={exportPDF} saveToProject={saveToProject}
              hasProject={!!projectId}
              formatTime={formatTime} formatDist={formatDist} formatArea={formatArea}
              userSignedIn={!!user}
            />
          )}

          {/* Nav */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              variant="outline" size="sm"
              disabled={step === 1}
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
            {step < 3 ? (
              <Button
                size="sm" disabled={!canAdvance}
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                className="gap-1.5"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => navigate("/dashboard")}>
                Done
              </Button>
            )}
          </div>
        </aside>

        {/* Map */}
        <div className="flex-1 relative min-h-[300px]">
          <MapContainer
            center={center ?? [37.7749, -122.4194]}
            zoom={center ? 17 : 4}
            className="w-full h-full"
            zoomControl={true}
          >
            <TileLayer
              attribution="&copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            <FlyTo target={step === 1 ? center : null} />

            {/* Step 2 drawing layer */}
            {step >= 2 && (
              <PolygonDrawer
                polygon={polygon} setPolygon={setPolygon}
                drawing={drawing} setDrawing={setDrawing}
              />
            )}

            {/* Auto-suggest layer */}
            {step === 2 && (
              <AutoSuggestLayer center={center} parcels={parcels} onPick={pickParcel} />
            )}

            {/* Step 3: flight path + home + RTH */}
            {step === 3 && polygon.length >= 3 && (
              <>
                <LeafletPolygon
                  positions={polygon}
                  pathOptions={{ color: "#2563eb", weight: 2, fillOpacity: 0.08 }}
                />
                {result && result.length >= 2 && (
                  <Polyline positions={result} pathOptions={{ color: "#f59e0b", weight: 2, opacity: 0.9 }} />
                )}
                {homePosition && (
                  <>
                    <Marker
                      position={homePosition}
                      icon={homeIcon}
                      draggable
                      eventHandlers={{ dragend: (e) => setHomePosition([(e.target as L.Marker).getLatLng().lat, (e.target as L.Marker).getLatLng().lng]) }}
                    />
                    {result && result.length >= 1 && (
                      <Polyline positions={[homePosition, result[0]]}
                        pathOptions={{ color: "#22c55e", weight: 2, dashArray: "4 6", opacity: 0.85 }} />
                    )}
                    {returnToHome && result && result.length >= 1 && (
                      <Polyline positions={[result[result.length - 1], homePosition]}
                        pathOptions={{ color: "#22c55e", weight: 2, dashArray: "4 6", opacity: 0.85 }} />
                    )}
                  </>
                )}
              </>
            )}
          </MapContainer>

          {/* Floating help on step 2 */}
          {step === 2 && drawing && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[900] bg-card/95 backdrop-blur border border-border rounded-full px-3 py-1.5 shadow text-[11px] text-muted-foreground">
              Click to place vertices · <kbd className="px-1 rounded border border-border bg-secondary/50 font-mono">Z</kbd> undo · <kbd className="px-1 rounded border border-border bg-secondary/50 font-mono">Enter</kbd> finish · <kbd className="px-1 rounded border border-border bg-secondary/50 font-mono">Esc</kbd> cancel
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Step components ----------

function Step1({ query, setQuery, searching, results, pickResult, center, locationLabel }: any) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display font-700 text-foreground text-base flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" /> Where are you flying?
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Search an address, place, or coordinates to center the map.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          autoFocus
          placeholder="123 Main St, City, State"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>

      {results.length > 0 && (
        <ul className="space-y-1 max-h-72 overflow-y-auto">
          {results.map((r: SearchResult, i: number) => (
            <li key={i}>
              <button
                onClick={() => pickResult(r)}
                className="w-full text-left px-3 py-2 rounded-lg border border-border hover:bg-secondary transition-colors flex items-start gap-2"
              >
                <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-xs text-foreground line-clamp-2">{r.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {center && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] uppercase font-semibold text-primary tracking-wide">
            <CheckCircle2 className="w-3 h-3" /> Selected
          </div>
          <p className="text-xs text-foreground line-clamp-2">{locationLabel}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{center[0].toFixed(5)}, {center[1].toFixed(5)}</p>
        </div>
      )}
    </div>
  );
}

function Step2({ center, polygon, drawing, setDrawing, parcels, fetchParcels, autoLoading, restartDraw, clear }: any) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display font-700 text-foreground text-base flex items-center gap-2">
          <Pentagon className="w-4 h-4 text-primary" /> Outline the survey area
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Draw it manually or let Dronie suggest one from nearby parcels.</p>
      </div>

      {!center && (
        <p className="text-xs text-destructive">Pick a location first (step 1).</p>
      )}

      {center && (
        <>
          {/* Two-button option grid */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={restartDraw}
              className={`p-3 rounded-lg border text-left transition-colors ${
                drawing ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"
              }`}
            >
              <Pentagon className="w-4 h-4 text-primary mb-1.5" />
              <p className="text-xs font-semibold text-foreground">Draw manually</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Click points on the map</p>
            </button>
            <button
              onClick={fetchParcels}
              disabled={autoLoading}
              className="p-3 rounded-lg border border-border hover:bg-secondary text-left transition-colors disabled:opacity-50"
            >
              {autoLoading ? <Loader2 className="w-4 h-4 text-primary mb-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary mb-1.5" />}
              <p className="text-xs font-semibold text-foreground">Auto-suggest</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">From parcel boundaries</p>
            </button>
          </div>

          {parcels.length > 0 && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-accent" />
                <p className="text-xs font-semibold text-foreground">{parcels.length} suggestion(s)</p>
              </div>
              <p className="text-[11px] text-muted-foreground">Click an orange shape on the map to use it.</p>
            </div>
          )}

          {polygon.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  {polygon.length >= 3 ? `${polygon.length} vertices` : `${polygon.length} of 3 minimum`}
                </div>
                <Button size="sm" variant="ghost" onClick={clear}
                  className="h-6 text-[10px] gap-1 px-2 text-destructive hover:text-destructive">
                  <X className="w-3 h-3" /> Clear
                </Button>
              </div>
              {drawing && (
                <p className="text-[10px] text-muted-foreground">
                  Keep clicking to add points. Press <kbd className="px-1 rounded border border-border bg-secondary/50 font-mono">Enter</kbd> when done, or click the first vertex (orange ring) to close.
                </p>
              )}
              {!drawing && polygon.length >= 3 && (
                <p className="text-[10px] text-muted-foreground">Drag the blue handles to reshape, or proceed to step 3.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Step3({
  stats, altitude, setAltitude, frontOverlap, setFrontOverlap, sideOverlap, setSideOverlap,
  heading, setHeading, speed, setSpeed, droneIdx, setDroneIdx,
  returnToHome, setReturnToHome, hasHome,
  exportKMZ, exportKML, exportGeoJSON, exportCSV, exportPDF,
  saveToProject, hasProject, formatTime, formatDist, formatArea, userSignedIn,
}: any) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display font-700 text-foreground text-base flex items-center gap-2">
          <Plane className="w-4 h-4 text-primary" /> Configure & export
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Tune the mission, then download for your drone.</p>
      </div>

      {/* Live stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label="Waypoints" value={stats.waypoints.toString()} />
          <Stat label="Flight time" value={formatTime(stats.flightTime)} />
          <Stat label="Distance" value={formatDist(stats.distance)} />
          <Stat label="Area" value={formatArea(stats.area)} />
          <Stat label="GSD" value={`${stats.gsd.toFixed(1)} cm/px`} />
          <Stat label="Batteries" value={stats.batteries.toString()} />
        </div>
      )}

      {/* Drone */}
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Drone model</span>
        <select value={droneIdx} onChange={(e) => setDroneIdx(Number(e.target.value))}
          className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs text-foreground">
          {DRONE_MODELS.map((d, i) => <option key={d.name} value={i}>{d.name} ({d.batteryMinutes}min)</option>)}
        </select>
      </div>

      <SliderRow label="Altitude" unit="m" value={altitude} onChange={setAltitude} min={20} max={150} step={5} />
      <SliderRow label="Front overlap" unit="%" value={frontOverlap} onChange={setFrontOverlap} min={50} max={95} step={5} />
      <SliderRow label="Side overlap" unit="%" value={sideOverlap} onChange={setSideOverlap} min={50} max={95} step={5} />
      <SliderRow label="Heading" unit="°" value={heading} onChange={setHeading} min={0} max={359} step={5} />
      <SliderRow label="Speed" unit="m/s" value={speed} onChange={setSpeed} min={2} max={15} step={1} />

      {/* RTH */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2.5">
        <div className="flex items-center gap-1.5">
          <CornerDownLeft className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs text-foreground">Return to Home</span>
        </div>
        <Switch checked={returnToHome} onCheckedChange={setReturnToHome} />
      </div>
      {hasHome && (
        <p className="text-[10px] text-muted-foreground -mt-1.5 px-1">Drag the green pin on the map to fine-tune the takeoff point.</p>
      )}

      {/* Exports */}
      <div className="space-y-1.5 pt-2 border-t border-border">
        <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">Export</p>
        <Button onClick={exportKMZ} className="w-full gap-2" size="sm">
          <Download className="w-3.5 h-3.5" /> KMZ for DJI Fly
        </Button>
        <div className="grid grid-cols-3 gap-1.5">
          <Button onClick={exportKML} variant="outline" size="sm" className="gap-1 text-[11px] px-2">
            <Download className="w-3 h-3" /> KML
          </Button>
          <Button onClick={exportGeoJSON} variant="outline" size="sm" className="gap-1 text-[11px] px-2">
            <Download className="w-3 h-3" /> GeoJSON
          </Button>
          <Button onClick={exportCSV} variant="outline" size="sm" className="gap-1 text-[11px] px-2">
            <Download className="w-3 h-3" /> CSV
          </Button>
        </div>
        <Button onClick={exportPDF} variant="outline" className="w-full gap-2" size="sm">
          <FileText className="w-3.5 h-3.5" /> PDF briefing
        </Button>
        {userSignedIn && hasProject && (
          <Button onClick={saveToProject} variant="outline" className="w-full gap-2" size="sm">
            <MapIcon className="w-3.5 h-3.5" /> Attach to project
          </Button>
        )}
        {userSignedIn && !hasProject && (
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            Open this wizard from a project to attach the mission to it.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-2 py-1.5">
      <p className="text-[9px] uppercase font-semibold text-muted-foreground tracking-wide">{label}</p>
      <p className="text-xs font-semibold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function SliderRow({ label, unit, value, onChange, min, max, step }: any) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}{unit}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
    </div>
  );
}

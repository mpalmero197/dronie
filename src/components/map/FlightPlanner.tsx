import { useState, useMemo, useCallback, useEffect } from "react";
import { useMap, Polyline, Marker, Polygon as LeafletPolygon, CircleMarker } from "react-leaflet";
import L from "leaflet";
import {
  Plane, X, Download, RotateCcw, Battery, MapPin, Grid3X3,
  Mountain, Save, FolderOpen, Trash2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FlightPlannerProps {
  active: boolean;
  surveyPolygon: [number, number][] | null;
  onClose: () => void;
  projectId?: string;
}

type FlightPattern = "single" | "crosshatch";

interface DroneModel {
  name: string;
  batteryMinutes: number;
  maxSpeed: number;
}

const DRONE_MODELS: DroneModel[] = [
  { name: "DJI Mavic 3", batteryMinutes: 43, maxSpeed: 15 },
  { name: "DJI Mavic Air 2S", batteryMinutes: 31, maxSpeed: 12 },
  { name: "DJI Phantom 4 Pro", batteryMinutes: 30, maxSpeed: 14 },
  { name: "DJI Mini 4 Pro", batteryMinutes: 34, maxSpeed: 10 },
  { name: "DJI Matrice 300", batteryMinutes: 55, maxSpeed: 17 },
];

interface FlightParams {
  altitude: number;
  frontOverlap: number;
  sideOverlap: number;
  heading: number;
  speed: number;
  pattern: FlightPattern;
  crossHeadingOffset: number;
  droneModelIdx: number;
  terrainFollow: boolean;
}

const DEFAULT_PARAMS: FlightParams = {
  altitude: 60,
  frontOverlap: 75,
  sideOverlap: 65,
  heading: 0,
  speed: 8,
  pattern: "single",
  crossHeadingOffset: 90,
  droneModelIdx: 0,
  terrainFollow: false,
};

interface SavedPlan {
  id: string;
  name: string;
  polygon: [number, number][];
  home_position: [number, number] | null;
  params: FlightParams;
  created_at: string;
}

interface TerrainData {
  elevations: number[];
  minElev: number;
  maxElev: number;
}

const SENSOR_WIDTH = 13.2;
const SENSOR_HEIGHT = 8.8;
const FOCAL_LENGTH = 8.8;
const IMAGE_WIDTH = 5472;

function toRad(d: number) { return (d * Math.PI) / 180; }

function haversineDistance(p1: [number, number], p2: [number, number]): number {
  const R = 6371000;
  const dLat = toRad(p2[0] - p1[0]);
  const dLng = toRad(p2[1] - p1[1]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p1[0])) * Math.cos(toRad(p2[0])) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function polygonArea(pts: [number, number][]): number {
  if (pts.length < 3) return 0;
  const R = 6371000;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += toRad(pts[j][1] - pts[i][1]) * (2 + Math.sin(toRad(pts[i][0])) + Math.sin(toRad(pts[j][0])));
  }
  return Math.abs((area * R * R) / 2);
}

function rotatePoint(p: [number, number], center: [number, number], angleDeg: number): [number, number] {
  const a = toRad(angleDeg);
  const dx = p[1] - center[1];
  const dy = p[0] - center[0];
  return [
    center[0] + dy * Math.cos(a) - dx * Math.sin(a),
    center[1] + dy * Math.sin(a) + dx * Math.cos(a),
  ];
}

function clipLineToPolygon(
  y: number, xMin: number, xMax: number,
  poly: [number, number][]
): [number, number][][] {
  const intersections: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const p1 = poly[i], p2 = poly[j];
    if ((p1[0] <= y && p2[0] > y) || (p2[0] <= y && p1[0] > y)) {
      const x = p1[1] + ((y - p1[0]) / (p2[0] - p1[0])) * (p2[1] - p1[1]);
      intersections.push(x);
    }
  }
  intersections.sort((a, b) => a - b);
  const segments: [number, number][][] = [];
  for (let i = 0; i < intersections.length - 1; i += 2) {
    segments.push([[y, intersections[i]], [y, intersections[i + 1]]]);
  }
  return segments;
}

function generateLawnmowerPath(
  polygon: [number, number][],
  altitude: number,
  frontOverlap: number,
  sideOverlap: number,
  heading: number,
): [number, number][] {
  const gsdX = (altitude * SENSOR_WIDTH) / FOCAL_LENGTH;
  const gsdY = (altitude * SENSOR_HEIGHT) / FOCAL_LENGTH;
  const lineSpacing = gsdX * (1 - sideOverlap / 100);
  const photoSpacing = gsdY * (1 - frontOverlap / 100);

  const cx = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
  const cy = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
  const center: [number, number] = [cx, cy];

  const rotated = polygon.map(p => rotatePoint(p, center, -heading));
  const lats = rotated.map(p => p[0]);
  const lngs = rotated.map(p => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latPerMeter = 1 / 111320;
  const lineSpacingDeg = lineSpacing * latPerMeter;
  const photoSpacingDeg = photoSpacing * (1 / (111320 * Math.cos(toRad(cx))));

  const waypoints: [number, number][] = [];
  let lineIdx = 0;
  for (let lat = minLat; lat <= maxLat; lat += lineSpacingDeg) {
    const segments = clipLineToPolygon(lat, minLng, maxLng, rotated);
    for (const seg of segments) {
      const [start, end] = lineIdx % 2 === 0 ? [seg[0], seg[1]] : [seg[1], seg[0]];
      const segLen = Math.abs(end[1] - start[1]);
      const numPoints = Math.max(2, Math.ceil(segLen / photoSpacingDeg) + 1);
      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        const pt: [number, number] = [
          start[0] + t * (end[0] - start[0]),
          start[1] + t * (end[1] - start[1]),
        ];
        waypoints.push(rotatePoint(pt, center, heading));
      }
    }
    if (segments.length > 0) lineIdx++;
  }
  return waypoints;
}

function generateKML(
  waypoints: [number, number][],
  altitude: number,
  name: string,
  homePos?: [number, number],
  perWpAltitudes?: number[],
): string {
  const coords = waypoints.map((w, i) => {
    const alt = perWpAltitudes ? perWpAltitudes[i] : altitude;
    return `${w[1]},${w[0]},${alt}`;
  }).join("\n            ");

  const altMode = perWpAltitudes ? "absolute" : "relativeToGround";

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name}</name>${homePos ? `
    <Placemark>
      <name>Home / Takeoff</name>
      <Point>
        <coordinates>${homePos[1]},${homePos[0]},0</coordinates>
      </Point>
    </Placemark>` : ""}
    <Placemark>
      <name>Flight Path</name>
      <LineString>
        <altitudeMode>${altMode}</altitudeMode>
        <coordinates>
            ${coords}
        </coordinates>
      </LineString>
    </Placemark>
    ${waypoints.map((w, i) => {
      const alt = perWpAltitudes ? perWpAltitudes[i] : altitude;
      return `
    <Placemark>
      <name>WP${i + 1}</name>
      <Point>
        <altitudeMode>${altMode}</altitudeMode>
        <coordinates>${w[1]},${w[0]},${alt}</coordinates>
      </Point>
    </Placemark>`;
    }).join("")}
  </Document>
</kml>`;
}

function generateCSV(
  waypoints: [number, number][],
  altitude: number,
  perWpAltitudes?: number[],
): string {
  let csv = "wp,lat,lng,alt_m,heading,speed,action\n";
  waypoints.forEach((w, i) => {
    const alt = perWpAltitudes ? perWpAltitudes[i] : altitude;
    csv += `${i + 1},${w[0].toFixed(7)},${w[1].toFixed(7)},${alt.toFixed(1)},0,0,take_photo\n`;
  });
  return csv;
}

async function fetchTerrainElevations(waypoints: [number, number][]): Promise<number[]> {
  // Batch in groups of 100
  const BATCH = 100;
  const elevations: number[] = [];
  for (let i = 0; i < waypoints.length; i += BATCH) {
    const batch = waypoints.slice(i, i + BATCH);
    const locations = batch.map(w => ({ latitude: w[0], longitude: w[1] }));
    try {
      const resp = await fetch("https://api.open-elevation.com/api/v1/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locations }),
      });
      if (!resp.ok) throw new Error("Elevation API error");
      const data = await resp.json();
      elevations.push(...data.results.map((r: any) => r.elevation as number));
    } catch {
      // Fallback: assume 0 elevation
      elevations.push(...batch.map(() => 0));
    }
  }
  return elevations;
}

function getElevationColor(elev: number, min: number, max: number): string {
  if (max === min) return "#22c55e";
  const t = (elev - min) / (max - min);
  if (t < 0.33) return "#22c55e"; // green
  if (t < 0.66) return "#eab308"; // yellow
  return "#ef4444"; // red
}

const homeIcon = new L.DivIcon({
  className: "home-marker",
  html: `<div style="width:24px;height:24px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function FlightPlanner({ active, surveyPolygon, onClose, projectId }: FlightPlannerProps) {
  const map = useMap();
  const { toast } = useToast();
  const [params, setParams] = useState<FlightParams>(DEFAULT_PARAMS);
  const [homePosition, setHomePosition] = useState<[number, number] | null>(null);
  const [terrainData, setTerrainData] = useState<TerrainData | null>(null);
  const [terrainLoading, setTerrainLoading] = useState(false);

  // Save/Load state
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showLoadList, setShowLoadList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);

  useEffect(() => {
    if (surveyPolygon && surveyPolygon.length >= 3 && !homePosition) {
      setHomePosition([surveyPolygon[0][0], surveyPolygon[0][1]]);
    }
  }, [surveyPolygon, homePosition]);

  const result = useMemo(() => {
    if (!surveyPolygon || surveyPolygon.length < 3) return null;
    const { altitude, frontOverlap, sideOverlap, heading, pattern, crossHeadingOffset } = params;
    const primaryWps = generateLawnmowerPath(surveyPolygon, altitude, frontOverlap, sideOverlap, heading);
    if (pattern === "crosshatch") {
      const secondaryWps = generateLawnmowerPath(
        surveyPolygon, altitude, frontOverlap, sideOverlap,
        (heading + crossHeadingOffset) % 360
      );
      return { waypoints: [...primaryWps, ...secondaryWps], primaryWps, secondaryWps };
    }
    return { waypoints: primaryWps, primaryWps, secondaryWps: [] as [number, number][] };
  }, [surveyPolygon, params]);

  // Fetch terrain data when terrain follow is enabled
  useEffect(() => {
    if (!params.terrainFollow || !result || result.waypoints.length === 0) {
      setTerrainData(null);
      return;
    }
    let cancelled = false;
    setTerrainLoading(true);
    fetchTerrainElevations(result.waypoints).then(elevations => {
      if (cancelled) return;
      const minElev = Math.min(...elevations);
      const maxElev = Math.max(...elevations);
      setTerrainData({ elevations, minElev, maxElev });
      setTerrainLoading(false);
    });
    return () => { cancelled = true; };
  }, [params.terrainFollow, result]);

  const perWpAltitudes = useMemo(() => {
    if (!terrainData || !params.terrainFollow || !result) return undefined;
    return terrainData.elevations.map(elev => params.altitude + elev);
  }, [terrainData, params.terrainFollow, params.altitude, result]);

  const stats = useMemo(() => {
    if (!result || !surveyPolygon) return null;
    const { waypoints, primaryWps, secondaryWps } = result;
    let totalDist = 0;
    for (let i = 1; i < primaryWps.length; i++) totalDist += haversineDistance(primaryWps[i - 1], primaryWps[i]);
    for (let i = 1; i < secondaryWps.length; i++) totalDist += haversineDistance(secondaryWps[i - 1], secondaryWps[i]);
    if (homePosition && waypoints.length > 0) {
      totalDist += haversineDistance(homePosition, waypoints[0]);
      totalDist += haversineDistance(waypoints[waypoints.length - 1], homePosition);
    }
    const area = polygonArea(surveyPolygon);
    const flightTime = totalDist / params.speed;
    const gsd = (params.altitude * SENSOR_WIDTH) / (FOCAL_LENGTH * IMAGE_WIDTH) * 100;
    const drone = DRONE_MODELS[params.droneModelIdx];
    const usableBatterySeconds = drone.batteryMinutes * 60 * 0.85;
    const batteriesNeeded = Math.ceil(flightTime / usableBatterySeconds);
    const batteryPercent = Math.min(100, Math.round((flightTime / usableBatterySeconds) * 100));
    return {
      waypoints: waypoints.length, distance: totalDist, area, flightTime, gsd,
      photos: waypoints.length, batteriesNeeded, batteryPercent, droneName: drone.name,
    };
  }, [result, surveyPolygon, params, homePosition]);

  const downloadKML = useCallback(() => {
    if (!result) return;
    const kml = generateKML(result.waypoints, params.altitude, "Flight Plan", homePosition ?? undefined, perWpAltitudes);
    const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "flight-plan.kml"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "KML exported" });
  }, [result, params.altitude, homePosition, perWpAltitudes, toast]);

  const downloadCSV = useCallback(() => {
    if (!result) return;
    const csv = generateCSV(result.waypoints, params.altitude, perWpAltitudes);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "flight-plan-waypoints.csv"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported" });
  }, [result, params.altitude, perWpAltitudes, toast]);

  const resetParams = () => { setParams(DEFAULT_PARAMS); setHomePosition(null); setTerrainData(null); };

  // Save/Load functions
  const loadSavedPlans = useCallback(async () => {
    setLoadingPlans(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Login required", description: "Save & load requires authentication.", variant: "destructive" });
      setLoadingPlans(false);
      return;
    }
    let query = supabase.from("saved_flight_plans").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (projectId && projectId !== "demo") {
      query = query.eq("project_id", projectId);
    }
    const { data, error } = await query;
    if (error) {
      toast({ title: "Failed to load plans", variant: "destructive" });
    } else {
      setSavedPlans((data || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        polygon: d.polygon as [number, number][],
        home_position: d.home_position as [number, number] | null,
        params: d.params as FlightParams,
        created_at: d.created_at,
      })));
    }
    setLoadingPlans(false);
  }, [projectId, toast]);

  const savePlan = useCallback(async () => {
    if (!surveyPolygon || !saveName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Login required", description: "Save requires authentication.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("saved_flight_plans").insert({
      user_id: user.id,
      project_id: projectId && projectId !== "demo" ? projectId : null,
      name: saveName.trim(),
      polygon: surveyPolygon as any,
      home_position: homePosition as any,
      params: params as any,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", variant: "destructive" });
    } else {
      toast({ title: "Plan saved!" });
      setSaveName("");
      setShowSaveInput(false);
    }
  }, [surveyPolygon, saveName, homePosition, params, projectId, toast]);

  const deletePlan = useCallback(async (planId: string) => {
    const { error } = await supabase.from("saved_flight_plans").delete().eq("id", planId);
    if (error) {
      toast({ title: "Delete failed", variant: "destructive" });
    } else {
      setSavedPlans(prev => prev.filter(p => p.id !== planId));
      toast({ title: "Plan deleted" });
    }
  }, [toast]);

  if (!active) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const hasPoly = surveyPolygon && surveyPolygon.length >= 3;

  return (
    <>
      {/* Survey polygon */}
      {hasPoly && (
        <LeafletPolygon
          positions={surveyPolygon}
          pathOptions={{ color: "#2563eb", weight: 2, fillOpacity: 0.08, dashArray: "6 4" }}
        />
      )}

      {/* Primary flight path */}
      {result && result.primaryWps.length >= 2 && (
        <>
          <Polyline
            positions={result.primaryWps}
            pathOptions={{ color: "#f59e0b", weight: 2, opacity: 0.9 }}
          />
          {result.primaryWps.filter((_, i) => i % Math.max(1, Math.floor(result.primaryWps.length / 30)) === 0).map((wp, i) => {
            const globalIdx = i * Math.max(1, Math.floor(result.primaryWps.length / 30));
            const color = terrainData && params.terrainFollow
              ? getElevationColor(terrainData.elevations[globalIdx] ?? 0, terrainData.minElev, terrainData.maxElev)
              : "#f59e0b";
            return (
              <CircleMarker
                key={`p-${i}`}
                center={wp}
                radius={3}
                pathOptions={{ color: "#ffffff", fillColor: color, fillOpacity: 1, weight: 1.5 }}
              />
            );
          })}
        </>
      )}

      {/* Secondary (crosshatch) flight path */}
      {result && result.secondaryWps.length >= 2 && (
        <>
          <Polyline
            positions={result.secondaryWps}
            pathOptions={{ color: "#8b5cf6", weight: 2, opacity: 0.8 }}
          />
          {result.secondaryWps.filter((_, i) => i % Math.max(1, Math.floor(result.secondaryWps.length / 30)) === 0).map((wp, i) => {
            const globalIdx = result.primaryWps.length + i * Math.max(1, Math.floor(result.secondaryWps.length / 30));
            const color = terrainData && params.terrainFollow
              ? getElevationColor(terrainData.elevations[globalIdx] ?? 0, terrainData.minElev, terrainData.maxElev)
              : "#8b5cf6";
            return (
              <CircleMarker
                key={`s-${i}`}
                center={wp}
                radius={3}
                pathOptions={{ color: "#ffffff", fillColor: color, fillOpacity: 1, weight: 1.5 }}
              />
            );
          })}
        </>
      )}

      {/* Home / Takeoff marker */}
      {homePosition && (
        <Marker
          position={homePosition}
          icon={homeIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const latlng = e.target.getLatLng();
              setHomePosition([latlng.lat, latlng.lng]);
            },
          }}
        />
      )}

      {/* Control panel */}
      <div className="absolute top-4 right-4 z-[950] w-72 bg-card/95 backdrop-blur border border-border rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-primary/5">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground">Flight Planner</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setShowLoadList(v => !v); if (!showLoadList) loadSavedPlans(); }}
              className="p-1 rounded hover:bg-secondary transition-colors" title="Load plan"
            >
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-secondary transition-colors">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Load plans list */}
          {showLoadList && (
            <div className="space-y-1.5 pb-2 border-b border-border">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Saved Plans</h4>
              {loadingPlans ? (
                <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
              ) : savedPlans.length === 0 ? (
                <p className="text-[10px] text-muted-foreground py-2">No saved plans found.</p>
              ) : (
                savedPlans.map(plan => (
                  <div key={plan.id} className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-md bg-secondary/50 hover:bg-secondary transition-colors">
                    <button
                      onClick={() => {
                        setParams(plan.params);
                        if (plan.home_position) setHomePosition(plan.home_position);
                        setShowLoadList(false);
                        toast({ title: `Loaded: ${plan.name}` });
                      }}
                      className="flex-1 text-left"
                    >
                      <p className="text-xs font-medium text-foreground truncate">{plan.name}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {new Date(plan.created_at).toLocaleDateString()}
                      </p>
                    </button>
                    <button
                      onClick={() => deletePlan(plan.id)}
                      className="p-1 rounded hover:bg-destructive/20 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {!hasPoly ? (
            <div className="text-center py-6 space-y-2">
              <Plane className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                Draw a polygon on the map to define your survey area.
              </p>
            </div>
          ) : (
            <>
              {/* Drone Model */}
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Drone Model</span>
                <select
                  value={params.droneModelIdx}
                  onChange={(e) => setParams(p => ({ ...p, droneModelIdx: Number(e.target.value) }))}
                  className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                >
                  {DRONE_MODELS.map((d, i) => (
                    <option key={d.name} value={i}>{d.name} ({d.batteryMinutes}min)</option>
                  ))}
                </select>
              </div>

              {/* Flight Pattern */}
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Flight Pattern</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setParams(p => ({ ...p, pattern: "single" }))}
                    className={`flex-1 h-8 rounded-md border text-xs font-medium transition-colors ${
                      params.pattern === "single"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    Single Grid
                  </button>
                  <button
                    onClick={() => setParams(p => ({ ...p, pattern: "crosshatch" }))}
                    className={`flex-1 h-8 rounded-md border text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                      params.pattern === "crosshatch"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Grid3X3 className="w-3 h-3" /> Crosshatch
                  </button>
                </div>
              </div>

              {/* Terrain Following */}
              <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-accent/10 border border-accent/20">
                <div className="flex items-center gap-2">
                  <Mountain className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <span className="text-xs font-medium text-foreground">Terrain Following</span>
                </div>
                <Switch
                  checked={params.terrainFollow}
                  onCheckedChange={(v) => setParams(p => ({ ...p, terrainFollow: v }))}
                />
              </div>

              {terrainLoading && (
                <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Fetching elevation data…
                </div>
              )}

              {terrainData && params.terrainFollow && (
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <div className="px-2 py-1 rounded bg-green-500/10 text-center">
                    <span className="text-muted-foreground block">Min</span>
                    <span className="font-semibold text-foreground">{terrainData.minElev.toFixed(0)}m</span>
                  </div>
                  <div className="px-2 py-1 rounded bg-yellow-500/10 text-center">
                    <span className="text-muted-foreground block">Max</span>
                    <span className="font-semibold text-foreground">{terrainData.maxElev.toFixed(0)}m</span>
                  </div>
                  <div className="px-2 py-1 rounded bg-red-500/10 text-center">
                    <span className="text-muted-foreground block">Δ</span>
                    <span className="font-semibold text-foreground">{(terrainData.maxElev - terrainData.minElev).toFixed(0)}m</span>
                  </div>
                </div>
              )}

              {/* Altitude */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Altitude {params.terrainFollow ? "(AGL)" : ""}</span>
                  <span className="font-semibold text-foreground">{params.altitude}m</span>
                </div>
                <Slider value={[params.altitude]} onValueChange={([v]) => setParams(p => ({ ...p, altitude: v }))} min={20} max={150} step={5} />
              </div>

              {/* Front Overlap */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Front Overlap</span>
                  <span className="font-semibold text-foreground">{params.frontOverlap}%</span>
                </div>
                <Slider value={[params.frontOverlap]} onValueChange={([v]) => setParams(p => ({ ...p, frontOverlap: v }))} min={50} max={95} step={5} />
              </div>

              {/* Side Overlap */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Side Overlap</span>
                  <span className="font-semibold text-foreground">{params.sideOverlap}%</span>
                </div>
                <Slider value={[params.sideOverlap]} onValueChange={([v]) => setParams(p => ({ ...p, sideOverlap: v }))} min={50} max={95} step={5} />
              </div>

              {/* Heading */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Heading</span>
                  <span className="font-semibold text-foreground">{params.heading}°</span>
                </div>
                <Slider value={[params.heading]} onValueChange={([v]) => setParams(p => ({ ...p, heading: v }))} min={0} max={355} step={5} />
              </div>

              {/* Cross heading offset */}
              {params.pattern === "crosshatch" && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Cross Angle</span>
                    <span className="font-semibold text-foreground">{params.crossHeadingOffset}°</span>
                  </div>
                  <Slider value={[params.crossHeadingOffset]} onValueChange={([v]) => setParams(p => ({ ...p, crossHeadingOffset: v }))} min={45} max={90} step={5} />
                </div>
              )}

              {/* Speed */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Speed</span>
                  <span className="font-semibold text-foreground">{params.speed} m/s</span>
                </div>
                <Slider value={[params.speed]} onValueChange={([v]) => setParams(p => ({ ...p, speed: v }))} min={2} max={15} step={1} />
              </div>

              {/* Home position info */}
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                <MapPin className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                <p className="text-[10px] text-green-700 dark:text-green-400">
                  Drag the green marker to set takeoff/landing point
                </p>
              </div>

              {/* Stats */}
              {stats && (
                <div className="bg-secondary/50 rounded-lg p-2.5 space-y-2">
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Flight Stats</h4>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GSD</span>
                      <span className="font-semibold text-foreground">{stats.gsd.toFixed(1)} cm/px</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Area</span>
                      <span className="font-semibold text-foreground">
                        {stats.area < 10000 ? `${stats.area.toFixed(0)} m²` : `${(stats.area / 10000).toFixed(2)} ha`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Distance</span>
                      <span className="font-semibold text-foreground">
                        {stats.distance < 1000 ? `${stats.distance.toFixed(0)} m` : `${(stats.distance / 1000).toFixed(1)} km`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time</span>
                      <span className="font-semibold text-foreground">{formatTime(stats.flightTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Photos</span>
                      <span className="font-semibold text-foreground">{stats.photos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pattern</span>
                      <span className="font-semibold text-foreground">{params.pattern === "crosshatch" ? "Crosshatch" : "Single"}</span>
                    </div>
                  </div>

                  {/* Battery estimation */}
                  <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Battery className={`w-3.5 h-3.5 ${stats.batteryPercent > 100 ? "text-destructive" : stats.batteryPercent > 75 ? "text-yellow-500" : "text-green-500"}`} />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Battery ({stats.droneName})</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          stats.batteryPercent > 100 ? "bg-destructive" : stats.batteryPercent > 75 ? "bg-yellow-500" : "bg-green-500"
                        }`}
                        style={{ width: `${Math.min(100, stats.batteryPercent)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">{stats.batteryPercent}% of single battery</span>
                      <span className="font-semibold text-foreground">
                        {stats.batteriesNeeded} batter{stats.batteriesNeeded === 1 ? "y" : "ies"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={resetParams} className="flex-1 h-8 text-xs gap-1.5">
                  <RotateCcw className="w-3 h-3" /> Reset
                </Button>
                <Button size="sm" variant="outline" onClick={downloadCSV} className="flex-1 h-8 text-xs gap-1.5">
                  <Download className="w-3 h-3" /> CSV
                </Button>
                <Button size="sm" onClick={downloadKML} className="flex-1 h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Download className="w-3 h-3" /> KML
                </Button>
              </div>

              {/* Save plan */}
              {showSaveInput ? (
                <div className="flex gap-1.5">
                  <Input
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    placeholder="Plan name…"
                    className="h-8 text-xs flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={savePlan}
                    disabled={saving || !saveName.trim()}
                    className="h-8 text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSaveInput(true)}
                  className="w-full h-8 text-xs gap-1.5"
                >
                  <Save className="w-3 h-3" /> Save Plan
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

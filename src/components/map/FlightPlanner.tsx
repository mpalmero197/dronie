import { useState, useMemo, useCallback, useEffect } from "react";
import { useMap, Polyline, Marker, Polygon as LeafletPolygon, CircleMarker, Circle } from "react-leaflet";
import L from "leaflet";
import {
  Plane, X, Download, RotateCcw, Battery, MapPin, Grid3X3,
  Mountain, Save, FolderOpen, Trash2, Loader2, FileText,
  CircleDot, Route, Compass,
} from "lucide-react";
import ElevationProfileChart from "@/components/map/ElevationProfileChart";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import html2canvas from "html2canvas";
import { generateMissionPDF } from "@/lib/generateMissionPDF";
import { generateDJIFlyKMZ } from "@/lib/generateDJIFlyKMZ";
import {
  haversineDistance, polygonArea, generateLawnmowerPath,
  generatePerimeterPath, generateOrbitPath, generateCorridorPath, calculateGSD,
} from "@/lib/flightPathGenerators";

import type { LaancResult } from "@/components/map/LaancChecker";

interface FlightPlannerProps {
  active: boolean;
  surveyPolygon: [number, number][] | null;
  onClose: () => void;
  projectId?: string;
  mapContainerRef?: React.RefObject<HTMLDivElement>;
  corridorLine?: [number, number][] | null;
  orbitCenter?: [number, number] | null;
  onPolygonEdit?: (polygon: [number, number][]) => void;
  laancResult?: LaancResult | null;
}

type FlightMode = "grid" | "perimeter" | "orbit" | "corridor";
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
  gimbalPitchStart: number;
  gimbalPitchEnd: number;
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
  gimbalPitchStart: -90,
  gimbalPitchEnd: -90,
};
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

async function fetchTerrainElevations(waypoints: [number, number][]): Promise<number[]> {
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
      elevations.push(...batch.map(() => 0));
    }
  }
  return elevations;
}

function getElevationColor(elev: number, min: number, max: number): string {
  if (max === min) return "#22c55e";
  const t = (elev - min) / (max - min);
  if (t < 0.33) return "#22c55e";
  if (t < 0.66) return "#eab308";
  return "#ef4444";
}

function generateKML(
  waypoints: [number, number][], altitude: number, name: string,
  homePos?: [number, number], perWpAltitudes?: number[],
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
      <Point><coordinates>${homePos[1]},${homePos[0]},0</coordinates></Point>
    </Placemark>` : ""}
    <Placemark>
      <name>Flight Path</name>
      <LineString>
        <altitudeMode>${altMode}</altitudeMode>
        <coordinates>${coords}</coordinates>
      </LineString>
    </Placemark>
    ${waypoints.map((w, i) => {
      const alt = perWpAltitudes ? perWpAltitudes[i] : altitude;
      return `<Placemark><name>WP${i + 1}</name><Point><altitudeMode>${altMode}</altitudeMode><coordinates>${w[1]},${w[0]},${alt}</coordinates></Point></Placemark>`;
    }).join("\n    ")}
  </Document>
</kml>`;
}

function generateCSV(waypoints: [number, number][], altitude: number, perWpAltitudes?: number[]): string {
  let csv = "wp,lat,lng,alt_m,heading,speed,action\n";
  waypoints.forEach((w, i) => {
    const alt = perWpAltitudes ? perWpAltitudes[i] : altitude;
    csv += `${i + 1},${w[0].toFixed(7)},${w[1].toFixed(7)},${alt.toFixed(1)},0,0,take_photo\n`;
  });
  return csv;
}

function generateLitchiCSV(
  waypoints: [number, number][],
  altitude: number,
  speed: number,
  heading: number,
  perWpAltitudes?: number[],
  gimbalPitchStart: number = -90,
  gimbalPitchEnd: number = -90,
): string {
  // DJI Litchi waypoint CSV format
  // Reference: https://flylitchi.com/hub (Mission Hub CSV export)
  const header = [
    "latitude", "longitude", "altitude(m)", "heading(deg)", "curvesize(m)",
    "rotationdir", "gimbalmode", "gimbalpitchangle", "actiontype1",
    "actionparam1", "actiontype2", "actionparam2", "actiontype3",
    "actionparam3", "actiontype4", "actionparam4", "actiontype5",
    "actionparam5", "actiontype6", "actionparam6", "actiontype7",
    "actionparam7", "actiontype8", "actionparam8", "actiontype9",
    "actionparam9", "actiontype10", "actionparam10", "actiontype11",
    "actionparam11", "actiontype12", "actionparam12", "actiontype13",
    "actionparam13", "actiontype14", "actionparam14", "actiontype15",
    "actionparam15", "altitudemode", "speed(m/s)", "poi_latitude",
    "poi_longitude", "poi_altitude(m)", "poi_altitudemode",
    "photo_timeinterval", "photo_distinterval",
  ].join(",");

  // gimbalmode: 0 = disabled, 1 = focus POI, 2 = interpolate
  const useInterpolation = gimbalPitchStart !== gimbalPitchEnd;
  const gimbalMode = useInterpolation ? 2 : 2; // always use interpolate for smooth transitions

  const rows = waypoints.map((w, i) => {
    const alt = perWpAltitudes ? perWpAltitudes[i] : altitude;
    const altMode = perWpAltitudes ? 1 : 0; // 0 = relative (AGL), 1 = absolute (MSL)
    // Linearly interpolate gimbal pitch from start to end across all waypoints
    const t = waypoints.length > 1 ? i / (waypoints.length - 1) : 0;
    const pitch = gimbalPitchStart + t * (gimbalPitchEnd - gimbalPitchStart);
    return [
      w[0].toFixed(7), w[1].toFixed(7), alt.toFixed(1), heading.toFixed(0), "0.2",
      "0", gimbalMode.toString(), pitch.toFixed(1),
      "1", "0",   // action1: take photo
      "-1", "0", "-1", "0", "-1", "0", "-1", "0",
      "-1", "0", "-1", "0", "-1", "0", "-1", "0",
      "-1", "0", "-1", "0", "-1", "0", "-1", "0",
      "-1", "0",
      altMode.toString(), speed.toFixed(1),
      "0", "0", "0", "0",
      "-1", "-1",
    ].join(",");
  });

  return header + "\n" + rows.join("\n") + "\n";
}

const homeIcon = new L.DivIcon({
  className: "home-marker",
  html: `<div style="width:24px;height:24px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const vertexIcon = new L.DivIcon({
  className: "",
  html: `<div style="width:12px;height:12px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:grab"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

export default function FlightPlanner({
  active, surveyPolygon, onClose, projectId, mapContainerRef,
  corridorLine, orbitCenter, onPolygonEdit, laancResult,
}: FlightPlannerProps) {
  const map = useMap();
  const { toast } = useToast();
  const [params, setParams] = useState<FlightParams>(DEFAULT_PARAMS);
  const [homePosition, setHomePosition] = useState<[number, number] | null>(null);
  const [terrainData, setTerrainData] = useState<TerrainData | null>(null);
  const [terrainLoading, setTerrainLoading] = useState(false);
  const [flightMode, setFlightMode] = useState<FlightMode>("grid");

  // Orbit-specific state
  const [orbitPos, setOrbitPos] = useState<[number, number] | null>(orbitCenter || null);
  const [orbitRadius, setOrbitRadius] = useState(50);
  const [orbitPoints, setOrbitPoints] = useState(36);
  const [orbitLoops, setOrbitLoops] = useState(1);

  // Corridor-specific state
  const [corridorWidth, setCorridorWidth] = useState(30);

  // Perimeter-specific state
  const [perimeterLoops, setPerimeterLoops] = useState(1);
  const [perimeterInset, setPerimeterInset] = useState(0);

  // Save/Load state
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showLoadList, setShowLoadList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Set orbit center when map is clicked in orbit mode
  useEffect(() => {
    if (!active || flightMode !== "orbit") return;
    const handler = (e: L.LeafletMouseEvent) => {
      if (!orbitPos) setOrbitPos([e.latlng.lat, e.latlng.lng]);
    };
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [active, flightMode, orbitPos, map]);

  useEffect(() => {
    if (surveyPolygon && surveyPolygon.length >= 3 && !homePosition) {
      setHomePosition([surveyPolygon[0][0], surveyPolygon[0][1]]);
    }
  }, [surveyPolygon, homePosition]);

  // Generate waypoints based on flight mode
  const result = useMemo(() => {
    if (flightMode === "orbit") {
      if (!orbitPos) return null;
      const wps = generateOrbitPath(orbitPos, orbitRadius, params.altitude, orbitPoints, orbitLoops);
      return { waypoints: wps, primaryWps: wps, secondaryWps: [] as [number, number][] };
    }

    if (flightMode === "corridor") {
      if (!corridorLine || corridorLine.length < 2) return null;
      const wps = generateCorridorPath(corridorLine, params.altitude, params.frontOverlap, params.sideOverlap, corridorWidth);
      return { waypoints: wps, primaryWps: wps, secondaryWps: [] as [number, number][] };
    }

    if (!surveyPolygon || surveyPolygon.length < 3) return null;

    if (flightMode === "perimeter") {
      const wps = generatePerimeterPath(surveyPolygon, params.altitude, params.frontOverlap, perimeterLoops, perimeterInset);
      return { waypoints: wps, primaryWps: wps, secondaryWps: [] as [number, number][] };
    }

    // Grid mode
    const { altitude, frontOverlap, sideOverlap, heading, pattern, crossHeadingOffset } = params;
    const primaryWps = generateLawnmowerPath(surveyPolygon, altitude, frontOverlap, sideOverlap, heading);
    if (pattern === "crosshatch") {
      const secondaryWps = generateLawnmowerPath(surveyPolygon, altitude, frontOverlap, sideOverlap, (heading + crossHeadingOffset) % 360);
      return { waypoints: [...primaryWps, ...secondaryWps], primaryWps, secondaryWps };
    }
    return { waypoints: primaryWps, primaryWps, secondaryWps: [] as [number, number][] };
  }, [surveyPolygon, params, flightMode, corridorLine, orbitPos, orbitRadius, orbitPoints, orbitLoops, corridorWidth, perimeterLoops, perimeterInset]);

  // Terrain follow
  useEffect(() => {
    if (!params.terrainFollow || !result || result.waypoints.length === 0) {
      setTerrainData(null);
      return;
    }
    let cancelled = false;
    setTerrainLoading(true);
    fetchTerrainElevations(result.waypoints).then(elevations => {
      if (cancelled) return;
      setTerrainData({ elevations, minElev: Math.min(...elevations), maxElev: Math.max(...elevations) });
      setTerrainLoading(false);
    });
    return () => { cancelled = true; };
  }, [params.terrainFollow, result]);

  const perWpAltitudes = useMemo(() => {
    if (!terrainData || !params.terrainFollow || !result) return undefined;
    return terrainData.elevations.map(elev => params.altitude + elev);
  }, [terrainData, params.terrainFollow, params.altitude, result]);

  const stats = useMemo(() => {
    if (!result) return null;
    const { waypoints, primaryWps, secondaryWps } = result;
    let totalDist = 0;
    for (let i = 1; i < primaryWps.length; i++) totalDist += haversineDistance(primaryWps[i - 1], primaryWps[i]);
    for (let i = 1; i < secondaryWps.length; i++) totalDist += haversineDistance(secondaryWps[i - 1], secondaryWps[i]);
    if (homePosition && waypoints.length > 0) {
      totalDist += haversineDistance(homePosition, waypoints[0]);
      totalDist += haversineDistance(waypoints[waypoints.length - 1], homePosition);
    }
    const area = surveyPolygon ? polygonArea(surveyPolygon) : (flightMode === "orbit" ? Math.PI * orbitRadius * orbitRadius : 0);
    const flightTime = totalDist / params.speed;
    const gsd = calculateGSD(params.altitude);
    const drone = DRONE_MODELS[params.droneModelIdx];
    const usableBatterySeconds = drone.batteryMinutes * 60 * 0.85;
    const batteriesNeeded = Math.ceil(flightTime / usableBatterySeconds);
    const batteryPercent = Math.min(100, Math.round((flightTime / usableBatterySeconds) * 100));
    return {
      waypoints: waypoints.length, distance: totalDist, area, flightTime, gsd,
      photos: waypoints.length, batteriesNeeded, batteryPercent, droneName: drone.name,
    };
  }, [result, surveyPolygon, params, homePosition, flightMode, orbitRadius]);

  // Downloads
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

  const downloadLitchi = useCallback(() => {
    if (!result) return;
    const csv = generateLitchiCSV(result.waypoints, params.altitude, params.speed, params.heading, perWpAltitudes);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "litchi-waypoints.csv"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Litchi CSV exported", description: "Import into Litchi Mission Hub or app" });
  }, [result, params, perWpAltitudes, toast]);

  const downloadDJIFly = useCallback(async () => {
    if (!result) return;
    try {
      const blob = await generateDJIFlyKMZ({
        waypoints: result.waypoints,
        altitude: params.altitude,
        speed: params.speed,
        heading: params.heading,
        name: "Flight Plan",
        homePosition: homePosition ?? undefined,
        perWpAltitudes,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "dji-fly-mission.kmz"; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "DJI Fly KMZ exported", description: "Import into DJI Fly app (Mini 4 Pro, Air 3, Mavic 3)" });
    } catch {
      toast({ title: "KMZ export failed", variant: "destructive" });
    }
  }, [result, params, homePosition, perWpAltitudes, toast]);

  const downloadPDF = useCallback(async () => {
    if (!result || !stats) return;
    toast({ title: "Generating PDF…", description: "Capturing map and building report" });
    let mapScreenshot = "";
    if (mapContainerRef?.current) {
      try {
        const canvas = await html2canvas(mapContainerRef.current, { useCORS: true, allowTaint: true });
        mapScreenshot = canvas.toDataURL("image/png");
      } catch { /* proceed without */ }
    }
    try {
      const blob = generateMissionPDF({
        stats, params, waypoints: result.waypoints, mapScreenshot,
        projectName: projectId || "Flight Plan", terrainData, perWpAltitudes,
        laancData: laancResult ? {
          authorization: laancResult.authorization,
          maxAutoAltFt: laancResult.maxAutoAltFt,
          message: laancResult.message,
          details: laancResult.details,
          lat: laancResult.lat,
          lng: laancResult.lng,
          zones: laancResult.zones.map(z => ({
            name: z.name,
            classLabel: z.icaoClass !== undefined
              ? `Class ${["A","B","C","D","E","F","G"][z.icaoClass] || z.icaoClass}`
              : z.type !== undefined
                ? ({0:"Other",1:"Restricted",2:"Danger",3:"Prohibited",4:"CTR",5:"TMZ",6:"RMZ",7:"TMA",8:"TRA",9:"TSA",10:"FIR",13:"ATZ",14:"MATZ",17:"Alert",18:"Warning",19:"Protected"}[z.type] || `Type ${z.type}`)
                : "Unknown",
          })),
        } : undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "mission-summary.pdf"; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "PDF exported!" });
    } catch {
      toast({ title: "PDF export failed", variant: "destructive" });
    }
  }, [result, stats, params, mapContainerRef, projectId, terrainData, perWpAltitudes, laancResult, toast]);

  const resetParams = () => {
    setParams(DEFAULT_PARAMS);
    setHomePosition(null);
    setTerrainData(null);
    setOrbitPos(null);
  };

  // Save/Load
  const loadSavedPlans = useCallback(async () => {
    setLoadingPlans(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast({ title: "Login required", variant: "destructive" }); setLoadingPlans(false); return; }
    let query = supabase.from("saved_flight_plans").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (projectId && projectId !== "demo") query = query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) { toast({ title: "Failed to load plans", variant: "destructive" }); }
    else {
      setSavedPlans((data || []).map((d: any) => ({
        id: d.id, name: d.name, polygon: d.polygon as [number, number][],
        home_position: d.home_position as [number, number] | null,
        params: d.params as FlightParams, created_at: d.created_at,
      })));
    }
    setLoadingPlans(false);
  }, [projectId, toast]);

  const savePlan = useCallback(async () => {
    if (!saveName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("saved_flight_plans").insert({
      user_id: user.id,
      project_id: projectId && projectId !== "demo" ? projectId : null,
      name: saveName.trim(),
      polygon: (surveyPolygon || []) as any,
      home_position: homePosition as any,
      params: params as any,
    });
    setSaving(false);
    if (error) { toast({ title: "Save failed", variant: "destructive" }); }
    else { toast({ title: "Plan saved!" }); setSaveName(""); setShowSaveInput(false); }
  }, [surveyPolygon, saveName, homePosition, params, projectId, toast]);

  const deletePlan = useCallback(async (planId: string) => {
    const { error } = await supabase.from("saved_flight_plans").delete().eq("id", planId);
    if (error) { toast({ title: "Delete failed", variant: "destructive" }); }
    else { setSavedPlans(prev => prev.filter(p => p.id !== planId)); toast({ title: "Plan deleted" }); }
  }, [toast]);

  const handleVertexDrag = useCallback((index: number, latlng: L.LatLng) => {
    if (!surveyPolygon || !onPolygonEdit) return;
    const updated = [...surveyPolygon];
    updated[index] = [latlng.lat, latlng.lng];
    onPolygonEdit(updated);
  }, [surveyPolygon, onPolygonEdit]);

  if (!active) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const hasPoly = surveyPolygon && surveyPolygon.length >= 3;
  const hasLine = corridorLine && corridorLine.length >= 2;
  const hasInput = flightMode === "orbit" ? !!orbitPos : flightMode === "corridor" ? hasLine : hasPoly;

  const MODES: { id: FlightMode; icon: typeof Grid3X3; label: string; short: string }[] = [
    { id: "grid", icon: Grid3X3, label: "Grid Survey", short: "Grid" },
    { id: "perimeter", icon: Compass, label: "Perimeter", short: "Edge" },
    { id: "orbit", icon: CircleDot, label: "Orbit / POI", short: "Orbit" },
    { id: "corridor", icon: Route, label: "Corridor", short: "Line" },
  ];

  return (
    <>
      {/* Survey polygon with draggable vertices */}
      {hasPoly && flightMode !== "orbit" && (
        <>
          <LeafletPolygon
            positions={surveyPolygon}
            pathOptions={{ color: "#2563eb", weight: 2, fillOpacity: 0.08, dashArray: "6 4" }}
          />
          {/* Vertex handles */}
          {onPolygonEdit && surveyPolygon.map((pos, i) => (
            <Marker
              key={`vertex-${i}`}
              position={pos}
              icon={vertexIcon}
              draggable
              eventHandlers={{
                dragend: (e) => handleVertexDrag(i, e.target.getLatLng()),
              }}
            />
          ))}
        </>
      )}

      {/* Corridor line */}
      {hasLine && flightMode === "corridor" && (
        <Polyline positions={corridorLine!} pathOptions={{ color: "#2563eb", weight: 3, dashArray: "6 4" }} />
      )}

      {/* Orbit circle preview */}
      {flightMode === "orbit" && orbitPos && (
        <>
          <Circle
            center={orbitPos}
            radius={orbitRadius}
            pathOptions={{ color: "#8b5cf6", fillOpacity: 0.05, weight: 2, dashArray: "6 4" }}
          />
          <Marker
            position={orbitPos}
            icon={homeIcon}
            draggable
            eventHandlers={{ dragend: (e) => setOrbitPos([e.target.getLatLng().lat, e.target.getLatLng().lng]) }}
          />
        </>
      )}

      {/* Primary flight path */}
      {result && result.primaryWps.length >= 2 && (
        <>
          <Polyline
            positions={result.primaryWps}
            pathOptions={{
              color: flightMode === "orbit" ? "#8b5cf6" : flightMode === "perimeter" ? "#059669" : "#f59e0b",
              weight: 2, opacity: 0.9,
            }}
          />
          {result.primaryWps.filter((_, i) => i % Math.max(1, Math.floor(result.primaryWps.length / 30)) === 0).map((wp, i) => {
            const globalIdx = i * Math.max(1, Math.floor(result.primaryWps.length / 30));
            const color = terrainData && params.terrainFollow
              ? getElevationColor(terrainData.elevations[globalIdx] ?? 0, terrainData.minElev, terrainData.maxElev)
              : flightMode === "orbit" ? "#8b5cf6" : flightMode === "perimeter" ? "#059669" : "#f59e0b";
            return (
              <CircleMarker key={`p-${i}`} center={wp} radius={3}
                pathOptions={{ color: "#ffffff", fillColor: color, fillOpacity: 1, weight: 1.5 }} />
            );
          })}
        </>
      )}

      {/* Secondary (crosshatch) flight path */}
      {result && result.secondaryWps.length >= 2 && (
        <>
          <Polyline positions={result.secondaryWps} pathOptions={{ color: "#8b5cf6", weight: 2, opacity: 0.8 }} />
          {result.secondaryWps.filter((_, i) => i % Math.max(1, Math.floor(result.secondaryWps.length / 30)) === 0).map((wp, i) => {
            const globalIdx = result.primaryWps.length + i * Math.max(1, Math.floor(result.secondaryWps.length / 30));
            const color = terrainData && params.terrainFollow
              ? getElevationColor(terrainData.elevations[globalIdx] ?? 0, terrainData.minElev, terrainData.maxElev)
              : "#8b5cf6";
            return (
              <CircleMarker key={`s-${i}`} center={wp} radius={3}
                pathOptions={{ color: "#ffffff", fillColor: color, fillOpacity: 1, weight: 1.5 }} />
            );
          })}
        </>
      )}

      {/* Home marker */}
      {homePosition && flightMode !== "orbit" && (
        <Marker position={homePosition} icon={homeIcon} draggable
          eventHandlers={{ dragend: (e) => setHomePosition([e.target.getLatLng().lat, e.target.getLatLng().lng]) }} />
      )}

      {/* Control panel */}
      <div className="absolute top-4 right-4 z-[950] w-72 bg-card/95 backdrop-blur border border-border rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-primary/5">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground">Flight Planner</h3>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setShowLoadList(v => !v); if (!showLoadList) loadSavedPlans(); }}
              className="p-1 rounded hover:bg-secondary transition-colors" title="Load plan">
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-secondary transition-colors">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Flight Mode Selector */}
          <div className="grid grid-cols-4 gap-1">
            {MODES.map((m) => {
              const Icon = m.icon;
              const isActive = flightMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setFlightMode(m.id)}
                  className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {m.short}
                </button>
              );
            })}
          </div>

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
                    <button onClick={() => { setParams(plan.params); if (plan.home_position) setHomePosition(plan.home_position); setShowLoadList(false); toast({ title: `Loaded: ${plan.name}` }); }}
                      className="flex-1 text-left">
                      <p className="text-xs font-medium text-foreground truncate">{plan.name}</p>
                      <p className="text-[9px] text-muted-foreground">{new Date(plan.created_at).toLocaleDateString()}</p>
                    </button>
                    <button onClick={() => deletePlan(plan.id)} className="p-1 rounded hover:bg-destructive/20 transition-colors flex-shrink-0">
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Input prompt */}
          {!hasInput ? (
            <div className="text-center py-6 space-y-2">
              {flightMode === "orbit" ? (
                <>
                  <CircleDot className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Click on the map to set the orbit center point.</p>
                </>
              ) : flightMode === "corridor" ? (
                <>
                  <Route className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Draw a polyline on the map to define the corridor.</p>
                </>
              ) : (
                <>
                  <Plane className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Draw a polygon on the map to define your survey area.</p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Drone Model */}
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Drone Model</span>
                <select value={params.droneModelIdx}
                  onChange={(e) => setParams(p => ({ ...p, droneModelIdx: Number(e.target.value) }))}
                  className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground">
                  {DRONE_MODELS.map((d, i) => <option key={d.name} value={i}>{d.name} ({d.batteryMinutes}min)</option>)}
                </select>
              </div>

              {/* Grid-specific: Flight Pattern */}
              {flightMode === "grid" && (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Flight Pattern</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => setParams(p => ({ ...p, pattern: "single" }))}
                      className={`flex-1 h-8 rounded-md border text-xs font-medium transition-colors ${params.pattern === "single" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground hover:bg-secondary"}`}>
                      Single Grid
                    </button>
                    <button onClick={() => setParams(p => ({ ...p, pattern: "crosshatch" }))}
                      className={`flex-1 h-8 rounded-md border text-xs font-medium transition-colors flex items-center justify-center gap-1 ${params.pattern === "crosshatch" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground hover:bg-secondary"}`}>
                      <Grid3X3 className="w-3 h-3" /> Crosshatch
                    </button>
                  </div>
                </div>
              )}

              {/* Orbit-specific controls */}
              {flightMode === "orbit" && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Radius</span>
                      <span className="font-semibold text-foreground">{orbitRadius}m</span>
                    </div>
                    <Slider value={[orbitRadius]} onValueChange={([v]) => setOrbitRadius(v)} min={10} max={500} step={5} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Points per loop</span>
                      <span className="font-semibold text-foreground">{orbitPoints}</span>
                    </div>
                    <Slider value={[orbitPoints]} onValueChange={([v]) => setOrbitPoints(v)} min={8} max={72} step={4} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Loops</span>
                      <span className="font-semibold text-foreground">{orbitLoops}</span>
                    </div>
                    <Slider value={[orbitLoops]} onValueChange={([v]) => setOrbitLoops(v)} min={1} max={5} step={1} />
                  </div>
                  <button onClick={() => setOrbitPos(null)}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                    Click to reposition center point
                  </button>
                </>
              )}

              {/* Corridor-specific */}
              {flightMode === "corridor" && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Corridor Width</span>
                    <span className="font-semibold text-foreground">{corridorWidth}m</span>
                  </div>
                  <Slider value={[corridorWidth]} onValueChange={([v]) => setCorridorWidth(v)} min={10} max={200} step={5} />
                </div>
              )}

              {/* Perimeter-specific */}
              {flightMode === "perimeter" && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Loops</span>
                      <span className="font-semibold text-foreground">{perimeterLoops}</span>
                    </div>
                    <Slider value={[perimeterLoops]} onValueChange={([v]) => setPerimeterLoops(v)} min={1} max={5} step={1} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Inset</span>
                      <span className="font-semibold text-foreground">{perimeterInset}m</span>
                    </div>
                    <Slider value={[perimeterInset]} onValueChange={([v]) => setPerimeterInset(v)} min={0} max={50} step={1} />
                  </div>
                </>
              )}

              {/* Terrain Following — all modes except orbit */}
              {flightMode !== "orbit" && (
                <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-accent/10 border border-accent/20">
                  <div className="flex items-center gap-2">
                    <Mountain className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                    <span className="text-xs font-medium text-foreground">Terrain Following</span>
                  </div>
                  <Switch checked={params.terrainFollow} onCheckedChange={(v) => setParams(p => ({ ...p, terrainFollow: v }))} />
                </div>
              )}

              {terrainLoading && (
                <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Fetching elevation data…
                </div>
              )}

              {terrainData && params.terrainFollow && (
                <>
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    <div className="px-2 py-1 rounded bg-primary/10 text-center">
                      <span className="text-muted-foreground block">Min</span>
                      <span className="font-semibold text-foreground">{terrainData.minElev.toFixed(0)}m</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-accent/10 text-center">
                      <span className="text-muted-foreground block">Max</span>
                      <span className="font-semibold text-foreground">{terrainData.maxElev.toFixed(0)}m</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-destructive/10 text-center">
                      <span className="text-muted-foreground block">Δ</span>
                      <span className="font-semibold text-foreground">{(terrainData.maxElev - terrainData.minElev).toFixed(0)}m</span>
                    </div>
                  </div>
                  {result && (
                    <ElevationProfileChart
                      waypoints={result.waypoints}
                      elevations={terrainData.elevations}
                      altitude={params.altitude}
                      terrainFollow={params.terrainFollow}
                    />
                  )}
                </>
              )}

              {/* Altitude */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Altitude {params.terrainFollow ? "(AGL)" : ""}</span>
                  <span className="font-semibold text-foreground">{params.altitude}m</span>
                </div>
                <Slider value={[params.altitude]} onValueChange={([v]) => setParams(p => ({ ...p, altitude: v }))} min={20} max={150} step={5} />
              </div>

              {/* Overlap — grid, perimeter, corridor */}
              {(flightMode === "grid" || flightMode === "corridor" || flightMode === "perimeter") && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Front Overlap</span>
                      <span className="font-semibold text-foreground">{params.frontOverlap}%</span>
                    </div>
                    <Slider value={[params.frontOverlap]} onValueChange={([v]) => setParams(p => ({ ...p, frontOverlap: v }))} min={50} max={95} step={5} />
                  </div>
                  {flightMode !== "perimeter" && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Side Overlap</span>
                        <span className="font-semibold text-foreground">{params.sideOverlap}%</span>
                      </div>
                      <Slider value={[params.sideOverlap]} onValueChange={([v]) => setParams(p => ({ ...p, sideOverlap: v }))} min={50} max={95} step={5} />
                    </div>
                  )}
                </>
              )}

              {/* Heading — grid only */}
              {flightMode === "grid" && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Heading</span>
                      <span className="font-semibold text-foreground">{params.heading}°</span>
                    </div>
                    <Slider value={[params.heading]} onValueChange={([v]) => setParams(p => ({ ...p, heading: v }))} min={0} max={355} step={5} />
                  </div>
                  {params.pattern === "crosshatch" && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Cross Angle</span>
                        <span className="font-semibold text-foreground">{params.crossHeadingOffset}°</span>
                      </div>
                      <Slider value={[params.crossHeadingOffset]} onValueChange={([v]) => setParams(p => ({ ...p, crossHeadingOffset: v }))} min={45} max={90} step={5} />
                    </div>
                  )}
                </>
              )}

              {/* Speed */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Speed</span>
                  <span className="font-semibold text-foreground">{params.speed} m/s</span>
                </div>
                <Slider value={[params.speed]} onValueChange={([v]) => setParams(p => ({ ...p, speed: v }))} min={2} max={15} step={1} />
              </div>

              {/* Home position hint */}
              {flightMode !== "orbit" && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                  <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <p className="text-[10px] text-primary">
                    {onPolygonEdit ? "Drag blue dots to reshape · Green dot = takeoff" : "Drag the green marker to set takeoff point"}
                  </p>
                </div>
              )}

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
                      <span className="text-muted-foreground">Mode</span>
                      <span className="font-semibold text-foreground capitalize">{flightMode}</span>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Battery className={`w-3.5 h-3.5 ${stats.batteryPercent > 100 ? "text-destructive" : stats.batteryPercent > 75 ? "text-amber-500" : "text-primary"}`} />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Battery ({stats.droneName})</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${stats.batteryPercent > 100 ? "bg-destructive" : stats.batteryPercent > 75 ? "bg-amber-500" : "bg-primary"}`}
                        style={{ width: `${Math.min(100, stats.batteryPercent)}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">{stats.batteryPercent}% of single battery</span>
                      <span className="font-semibold text-foreground">{stats.batteriesNeeded} batter{stats.batteriesNeeded === 1 ? "y" : "ies"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={resetParams} className="h-8 text-xs gap-1.5 px-2">
                  <RotateCcw className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="outline" onClick={downloadCSV} className="flex-1 h-8 text-xs gap-1.5">
                  <Download className="w-3 h-3" /> CSV
                </Button>
                <Button size="sm" onClick={downloadKML} className="flex-1 h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Download className="w-3 h-3" /> KML
                </Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={downloadLitchi} className="flex-1 h-8 text-xs gap-1.5">
                  <Download className="w-3 h-3" /> Litchi CSV
                </Button>
                <Button size="sm" variant="outline" onClick={downloadDJIFly} className="flex-1 h-8 text-xs gap-1.5">
                  <Download className="w-3 h-3" /> DJI Fly
                </Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={downloadPDF} className="flex-1 h-8 text-xs gap-1.5">
                  <FileText className="w-3 h-3" /> PDF Report
                </Button>
              </div>

              {/* Save plan */}
              {showSaveInput ? (
                <div className="flex gap-1.5">
                  <Input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Plan name…" className="h-8 text-xs flex-1" />
                  <Button size="sm" onClick={savePlan} disabled={saving || !saveName.trim()}
                    className="h-8 text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowSaveInput(true)} className="w-full h-8 text-xs gap-1.5">
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

import { useState, useMemo, useCallback } from "react";
import { useMap, Polyline, Marker, Polygon as LeafletPolygon, CircleMarker } from "react-leaflet";
import L from "leaflet";
import {
  Plane, X, Download, RotateCcw, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

interface FlightPlannerProps {
  active: boolean;
  surveyPolygon: [number, number][] | null;
  onClose: () => void;
}

interface FlightParams {
  altitude: number;       // meters
  frontOverlap: number;   // 0-95 %
  sideOverlap: number;    // 0-95 %
  heading: number;        // degrees 0-360
  speed: number;          // m/s
}

const DEFAULT_PARAMS: FlightParams = {
  altitude: 60,
  frontOverlap: 75,
  sideOverlap: 65,
  heading: 0,
  speed: 8,
};

// Common drone camera specs (DJI Phantom 4 Pro-like)
const SENSOR_WIDTH = 13.2;  // mm
const SENSOR_HEIGHT = 8.8;  // mm
const FOCAL_LENGTH = 8.8;   // mm
const IMAGE_WIDTH = 5472;   // px
const IMAGE_HEIGHT = 3648;  // px

function toRad(d: number) { return (d * Math.PI) / 180; }
function toDeg(r: number) { return (r * 180) / Math.PI; }

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

// Rotate point around center
function rotatePoint(p: [number, number], center: [number, number], angleDeg: number): [number, number] {
  const a = toRad(angleDeg);
  const dx = p[1] - center[1];
  const dy = p[0] - center[0];
  return [
    center[0] + dy * Math.cos(a) - dx * Math.sin(a),
    center[1] + dy * Math.sin(a) + dx * Math.cos(a),
  ];
}

// Line-segment intersection
function lineIntersect(
  a1: [number, number], a2: [number, number],
  b1: [number, number], b2: [number, number]
): [number, number] | null {
  const d1x = a2[1] - a1[1], d1y = a2[0] - a1[0];
  const d2x = b2[1] - b1[1], d2y = b2[0] - b1[0];
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((b1[1] - a1[1]) * d2y - (b1[0] - a1[0]) * d2x) / denom;
  const u = ((b1[1] - a1[1]) * d1y - (b1[0] - a1[0]) * d1x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [a1[0] + t * d1y, a1[1] + t * d1x];
}

// Clip a horizontal scan line to polygon edges, returning entry/exit pairs
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
    segments.push([
      [y, intersections[i]],
      [y, intersections[i + 1]],
    ]);
  }
  return segments;
}

function generateLawnmowerPath(
  polygon: [number, number][],
  params: FlightParams
): { waypoints: [number, number][]; lineSpacing: number; photoSpacing: number } {
  const { altitude, frontOverlap, sideOverlap, heading } = params;

  // Ground coverage per image
  const gsdX = (altitude * SENSOR_WIDTH) / FOCAL_LENGTH; // meters covered horizontally
  const gsdY = (altitude * SENSOR_HEIGHT) / FOCAL_LENGTH;

  const lineSpacing = gsdX * (1 - sideOverlap / 100);
  const photoSpacing = gsdY * (1 - frontOverlap / 100);

  // Center of polygon
  const cx = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
  const cy = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
  const center: [number, number] = [cx, cy];

  // Rotate polygon to align with heading (so we sweep in lat direction)
  const rotated = polygon.map(p => rotatePoint(p, center, -heading));

  // Bounding box in rotated space
  const lats = rotated.map(p => p[0]);
  const lngs = rotated.map(p => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Convert line spacing from meters to degrees (approximate)
  const latPerMeter = 1 / 111320;
  const lineSpacingDeg = lineSpacing * latPerMeter;
  const photoSpacingDeg = photoSpacing * (1 / (111320 * Math.cos(toRad(cx))));

  // Generate scan lines
  const waypoints: [number, number][] = [];
  let lineIdx = 0;
  for (let lat = minLat; lat <= maxLat; lat += lineSpacingDeg) {
    const segments = clipLineToPolygon(lat, minLng, maxLng, rotated);
    for (const seg of segments) {
      // Alternate direction (serpentine)
      const [start, end] = lineIdx % 2 === 0 ? [seg[0], seg[1]] : [seg[1], seg[0]];

      // Place waypoints along this segment
      const segLen = Math.abs(end[1] - start[1]);
      const numPoints = Math.max(2, Math.ceil(segLen / photoSpacingDeg) + 1);
      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        const pt: [number, number] = [
          start[0] + t * (end[0] - start[0]),
          start[1] + t * (end[1] - start[1]),
        ];
        // Rotate back
        waypoints.push(rotatePoint(pt, center, heading));
      }
    }
    if (segments.length > 0) lineIdx++;
  }

  return { waypoints, lineSpacing, photoSpacing };
}

function generateKML(waypoints: [number, number][], altitude: number, name: string): string {
  const coords = waypoints.map(w => `${w[1]},${w[0]},${altitude}`).join("\n            ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name}</name>
    <Placemark>
      <name>Flight Path</name>
      <LineString>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>
            ${coords}
        </coordinates>
      </LineString>
    </Placemark>
    ${waypoints.map((w, i) => `
    <Placemark>
      <name>WP${i + 1}</name>
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${w[1]},${w[0]},${altitude}</coordinates>
      </Point>
    </Placemark>`).join("")}
  </Document>
</kml>`;
}

function generateCSV(waypoints: [number, number][], altitude: number): string {
  let csv = "wp,lat,lng,alt_m,heading,speed,action\n";
  waypoints.forEach((w, i) => {
    csv += `${i + 1},${w[0].toFixed(7)},${w[1].toFixed(7)},${altitude},0,0,take_photo\n`;
  });
  return csv;
}

export default function FlightPlanner({ active, surveyPolygon, onClose }: FlightPlannerProps) {
  const map = useMap();
  const { toast } = useToast();
  const [params, setParams] = useState<FlightParams>(DEFAULT_PARAMS);

  const result = useMemo(() => {
    if (!surveyPolygon || surveyPolygon.length < 3) return null;
    return generateLawnmowerPath(surveyPolygon, params);
  }, [surveyPolygon, params]);

  const stats = useMemo(() => {
    if (!result || !surveyPolygon) return null;
    const { waypoints } = result;
    let totalDist = 0;
    for (let i = 1; i < waypoints.length; i++) {
      totalDist += haversineDistance(waypoints[i - 1], waypoints[i]);
    }
    const area = polygonArea(surveyPolygon);
    const flightTime = totalDist / params.speed;
    const gsd = (params.altitude * SENSOR_WIDTH) / (FOCAL_LENGTH * IMAGE_WIDTH) * 100; // cm/px

    return {
      waypoints: waypoints.length,
      distance: totalDist,
      area,
      flightTime,
      gsd,
      photos: waypoints.length,
    };
  }, [result, surveyPolygon, params]);

  const downloadKML = useCallback(() => {
    if (!result) return;
    const kml = generateKML(result.waypoints, params.altitude, "MapForge Flight Plan");
    const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flight-plan.kml";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "KML exported", description: "Flight plan downloaded as KML" });
  }, [result, params.altitude, toast]);

  const downloadCSV = useCallback(() => {
    if (!result) return;
    const csv = generateCSV(result.waypoints, params.altitude);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flight-plan-waypoints.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported", description: "Waypoints downloaded as CSV" });
  }, [result, params.altitude, toast]);

  const resetParams = () => setParams(DEFAULT_PARAMS);

  if (!active) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const waypointIcon = new L.DivIcon({
    className: "flight-wp-icon",
    html: `<div style="width:8px;height:8px;border-radius:50%;background:hsl(var(--primary));border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });

  return (
    <>
      {/* Render survey polygon */}
      {surveyPolygon && surveyPolygon.length >= 3 && (
        <LeafletPolygon
          positions={surveyPolygon}
          pathOptions={{
            color: "#2563eb",
            weight: 2,
            fillOpacity: 0.08,
            dashArray: "6 4",
          }}
        />
      )}

      {/* Render flight path */}
      {result && result.waypoints.length >= 2 && (
        <>
          <Polyline
            positions={result.waypoints}
            pathOptions={{
              color: "#f59e0b",
              weight: 2,
              opacity: 0.9,
            }}
          />
          {/* Show every Nth waypoint marker to avoid clutter */}
          {result.waypoints.filter((_, i) => i % Math.max(1, Math.floor(result.waypoints.length / 30)) === 0).map((wp, i) => (
            <CircleMarker
              key={i}
              center={wp}
              radius={3}
              pathOptions={{
                color: "#ffffff",
                fillColor: "#f59e0b",
                fillOpacity: 1,
                weight: 1.5,
              }}
            />
          ))}
        </>
      )}

      {/* Control panel */}
      <div className="absolute top-4 right-4 z-[950] w-72 bg-card/95 backdrop-blur border border-border rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-primary/5">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground">Flight Planner</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
          {!surveyPolygon || surveyPolygon.length < 3 ? (
            <div className="text-center py-6 space-y-2">
              <Plane className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                Draw a polygon on the map to define your survey area, then the flight path will auto-generate.
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                Use the Polygon tool from the left toolbar
              </p>
            </div>
          ) : (
            <>
              {/* Altitude */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Altitude</span>
                  <span className="font-semibold text-foreground">{params.altitude}m</span>
                </div>
                <Slider
                  value={[params.altitude]}
                  onValueChange={([v]) => setParams(p => ({ ...p, altitude: v }))}
                  min={20}
                  max={150}
                  step={5}
                />
              </div>

              {/* Front Overlap */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Front Overlap</span>
                  <span className="font-semibold text-foreground">{params.frontOverlap}%</span>
                </div>
                <Slider
                  value={[params.frontOverlap]}
                  onValueChange={([v]) => setParams(p => ({ ...p, frontOverlap: v }))}
                  min={50}
                  max={95}
                  step={5}
                />
              </div>

              {/* Side Overlap */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Side Overlap</span>
                  <span className="font-semibold text-foreground">{params.sideOverlap}%</span>
                </div>
                <Slider
                  value={[params.sideOverlap]}
                  onValueChange={([v]) => setParams(p => ({ ...p, sideOverlap: v }))}
                  min={50}
                  max={95}
                  step={5}
                />
              </div>

              {/* Heading */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Heading</span>
                  <span className="font-semibold text-foreground">{params.heading}°</span>
                </div>
                <Slider
                  value={[params.heading]}
                  onValueChange={([v]) => setParams(p => ({ ...p, heading: v }))}
                  min={0}
                  max={355}
                  step={5}
                />
              </div>

              {/* Speed */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Speed</span>
                  <span className="font-semibold text-foreground">{params.speed} m/s</span>
                </div>
                <Slider
                  value={[params.speed]}
                  onValueChange={([v]) => setParams(p => ({ ...p, speed: v }))}
                  min={2}
                  max={15}
                  step={1}
                />
              </div>

              {/* Stats */}
              {stats && (
                <div className="bg-secondary/50 rounded-lg p-2.5 space-y-1.5">
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
                      <span className="text-muted-foreground">Waypoints</span>
                      <span className="font-semibold text-foreground">{stats.waypoints}</span>
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
            </>
          )}
        </div>
      </div>
    </>
  );
}

import { useEffect, useRef, useState, useCallback } from "react";
import { useMap, useMapEvents, Marker, Popup, Polyline, Polygon, Circle, Rectangle } from "react-leaflet";
import L from "leaflet";
import { Trash2 } from "lucide-react";
import type { DrawTool } from "./MapToolbar";

interface DrawnShape {
  id: string;
  type: "marker" | "polyline" | "polygon" | "rectangle" | "circle";
  positions: [number, number][];
  radius?: number;
  note: string;
  measurement?: string;
}

interface MeasurementResult {
  id: string;
  type: "distance" | "area";
  points: [number, number][];
  value: string;
}

interface MapDrawingLayerProps {
  activeTool: DrawTool;
  onMeasurement?: (result: string) => void;
  onPolygonComplete?: (positions: [number, number][]) => void;
}

function haversineDistance(p1: [number, number], p2: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(p2[0] - p1[0]);
  const dLng = toRad(p2[1] - p1[1]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p1[0])) * Math.cos(toRad(p2[0])) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(1)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatArea(sqMeters: number): string {
  if (sqMeters < 10000) return `${sqMeters.toFixed(0)} m²`;
  return `${(sqMeters / 10000).toFixed(2)} ha`;
}

function polygonArea(pts: [number, number][]): number {
  if (pts.length < 3) return 0;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += toRad(pts[j][1] - pts[i][1]) * (2 + Math.sin(toRad(pts[i][0])) + Math.sin(toRad(pts[j][0])));
  }
  return Math.abs((area * R * R) / 2);
}

export default function MapDrawingLayer({ activeTool, onMeasurement, onPolygonComplete }: MapDrawingLayerProps) {
  const [shapes, setShapes] = useState<DrawnShape[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementResult[]>([]);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const map = useMap();

  // Reset drawing points when tool changes
  useEffect(() => {
    setDrawingPoints([]);
  }, [activeTool]);

  useMapEvents({
    click(e) {
      if (!activeTool) return;
      const pt: [number, number] = [e.latlng.lat, e.latlng.lng];

      if (activeTool === "marker") {
        setShapes(prev => [...prev, {
          id: crypto.randomUUID(), type: "marker", positions: [pt], note: "",
        }]);
        return;
      }

      if (activeTool === "measure-distance") {
        const newPts = [...drawingPoints, pt];
        setDrawingPoints(newPts);
        if (newPts.length >= 2) {
          let total = 0;
          for (let i = 1; i < newPts.length; i++) total += haversineDistance(newPts[i - 1], newPts[i]);
          onMeasurement?.(formatDistance(total));
        }
        return;
      }

      if (activeTool === "measure-area") {
        const newPts = [...drawingPoints, pt];
        setDrawingPoints(newPts);
        if (newPts.length >= 3) {
          onMeasurement?.(formatArea(polygonArea(newPts)));
        }
        return;
      }

      if (activeTool === "polyline" || activeTool === "polygon") {
        setDrawingPoints(prev => [...prev, pt]);
        return;
      }

      if (activeTool === "rectangle") {
        const newPts = [...drawingPoints, pt];
        setDrawingPoints(newPts);
        if (newPts.length === 2) {
          setShapes(prev => [...prev, {
            id: crypto.randomUUID(), type: "rectangle", positions: newPts, note: "",
          }]);
          setDrawingPoints([]);
        }
        return;
      }

      if (activeTool === "circle") {
        const newPts = [...drawingPoints, pt];
        setDrawingPoints(newPts);
        if (newPts.length === 2) {
          const radius = haversineDistance(newPts[0], newPts[1]);
          setShapes(prev => [...prev, {
            id: crypto.randomUUID(), type: "circle", positions: [newPts[0]], radius, note: "",
          }]);
          setDrawingPoints([]);
        }
        return;
      }
    },
    dblclick(e) {
      if (activeTool === "polyline" && drawingPoints.length >= 2) {
        e.originalEvent.preventDefault();
        setShapes(prev => [...prev, {
          id: crypto.randomUUID(), type: "polyline", positions: [...drawingPoints], note: "",
        }]);
        setDrawingPoints([]);
      }
      if (activeTool === "polygon" && drawingPoints.length >= 3) {
        e.originalEvent.preventDefault();
        const pts = [...drawingPoints];
        setShapes(prev => [...prev, {
          id: crypto.randomUUID(), type: "polygon", positions: pts, note: "",
        }]);
        setDrawingPoints([]);
        onPolygonComplete?.(pts);
      }
      if (activeTool === "measure-distance" || activeTool === "measure-area") {
        e.originalEvent.preventDefault();
        setDrawingPoints([]);
      }
    },
  });

  function deleteShape(id: string) {
    setShapes(prev => prev.filter(s => s.id !== id));
  }

  return (
    <>
      {/* Drawing preview */}
      {drawingPoints.length >= 2 && (activeTool === "polyline" || activeTool === "measure-distance") && (
        <Polyline positions={drawingPoints} pathOptions={{ color: activeTool === "measure-distance" ? "#e97316" : "#166534", dashArray: "8 4", weight: 3 }} />
      )}
      {drawingPoints.length >= 3 && (activeTool === "polygon" || activeTool === "measure-area") && (
        <Polygon positions={drawingPoints} pathOptions={{ color: activeTool === "measure-area" ? "#e97316" : "#166534", fillOpacity: 0.15, dashArray: "8 4", weight: 2 }} />
      )}

      {/* Rendered shapes */}
      {shapes.map((shape) => {
        if (shape.type === "marker") {
          return (
            <Marker key={shape.id} position={shape.positions[0]}>
              <Popup>
                <div className="min-w-[140px]">
                  <p className="font-semibold text-xs mb-1">Annotation Pin</p>
                  <p className="text-xs text-gray-500 mb-2">
                    {shape.positions[0][0].toFixed(5)}, {shape.positions[0][1].toFixed(5)}
                  </p>
                  <button onClick={() => deleteShape(shape.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        }
        if (shape.type === "polyline") {
          let dist = 0;
          for (let i = 1; i < shape.positions.length; i++) dist += haversineDistance(shape.positions[i - 1], shape.positions[i]);
          return (
            <Polyline key={shape.id} positions={shape.positions} pathOptions={{ color: "#166534", weight: 3 }}>
              <Popup>
                <div className="min-w-[120px]">
                  <p className="font-semibold text-xs mb-1">Line: {formatDistance(dist)}</p>
                  <button onClick={() => deleteShape(shape.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
              </Popup>
            </Polyline>
          );
        }
        if (shape.type === "polygon") {
          const area = polygonArea(shape.positions);
          return (
            <Polygon key={shape.id} positions={shape.positions} pathOptions={{ color: "#166534", fillOpacity: 0.2, weight: 2 }}>
              <Popup>
                <div className="min-w-[120px]">
                  <p className="font-semibold text-xs mb-1">Area: {formatArea(area)}</p>
                  <button onClick={() => deleteShape(shape.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
              </Popup>
            </Polygon>
          );
        }
        if (shape.type === "rectangle") {
          const bounds: L.LatLngBoundsExpression = [shape.positions[0], shape.positions[1]];
          return (
            <Rectangle key={shape.id} bounds={bounds} pathOptions={{ color: "#166534", fillOpacity: 0.15, weight: 2 }}>
              <Popup>
                <button onClick={() => deleteShape(shape.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </Popup>
            </Rectangle>
          );
        }
        if (shape.type === "circle" && shape.radius) {
          return (
            <Circle key={shape.id} center={shape.positions[0]} radius={shape.radius} pathOptions={{ color: "#166534", fillOpacity: 0.15, weight: 2 }}>
              <Popup>
                <div className="min-w-[120px]">
                  <p className="font-semibold text-xs mb-1">Radius: {formatDistance(shape.radius)}</p>
                  <button onClick={() => deleteShape(shape.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
              </Popup>
            </Circle>
          );
        }
        return null;
      })}
    </>
  );
}

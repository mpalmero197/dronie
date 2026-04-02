import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polygon, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";

interface GpsPoint {
  lat: number;
  lng: number;
  alt: number | null;
  camera: string | null;
  date: string | null;
}

interface GpsMapPreviewProps {
  gpsPoints: GpsPoint[];
}

/* Small custom icon */
const pointIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [18, 29],
  iconAnchor: [9, 29],
  popupAnchor: [0, -24],
  shadowSize: [30, 30],
});

/* Compute convex hull (Graham scan) */
function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a[1] - b[1] || a[0] - b[0]);

  function cross(o: [number, number], a: [number, number], b: [number, number]) {
    return (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
  }

  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/* Auto-fit bounds */
function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useMemo(() => {
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
  }, [bounds, map]);
  return null;
}

export default function GpsMapPreview({ gpsPoints }: GpsMapPreviewProps) {
  const { bounds, hull, areaHa } = useMemo(() => {
    const lats = gpsPoints.map((p) => p.lat);
    const lngs = gpsPoints.map((p) => p.lng);
    const b = L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    );

    const pts: [number, number][] = gpsPoints.map((p) => [p.lat, p.lng]);
    const h = convexHull(pts);

    // Area estimate (hectares)
    const latDist = (Math.max(...lats) - Math.min(...lats)) * 111320;
    const lngDist =
      (Math.max(...lngs) - Math.min(...lngs)) *
      111320 *
      Math.cos(((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180));
    const area = Math.max(0.01, (latDist * lngDist) / 10000);

    return { bounds: b, hull: h, areaHa: area };
  }, [gpsPoints]);

  if (!gpsPoints.length) return null;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden mb-6">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-display font-700 text-foreground text-sm flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Image Locations
        </h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{gpsPoints.length} points</span>
          <span>~{areaHa.toFixed(2)} ha</span>
        </div>
      </div>
      <div className="h-[220px] w-full">
        <MapContainer
          center={[0, 0]}
          zoom={2}
          className="h-full w-full"
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds bounds={bounds} />

          {hull.length >= 3 && (
            <Polygon
              positions={hull}
              pathOptions={{
                color: "hsl(152, 52%, 36%)",
                fillColor: "hsl(152, 52%, 36%)",
                fillOpacity: 0.12,
                weight: 2,
                dashArray: "6 4",
              }}
            />
          )}

          {gpsPoints.map((pt, i) => (
            <Marker key={i} position={[pt.lat, pt.lng]} icon={pointIcon}>
              <Popup className="text-xs">
                <div className="space-y-0.5">
                  <p className="font-semibold">Image {i + 1}</p>
                  <p>Lat: {pt.lat.toFixed(6)}</p>
                  <p>Lng: {pt.lng.toFixed(6)}</p>
                  {pt.alt != null && <p>Alt: {pt.alt.toFixed(1)}m</p>}
                  {pt.camera && <p>Camera: {pt.camera}</p>}
                  {pt.date && <p>Date: {pt.date}</p>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

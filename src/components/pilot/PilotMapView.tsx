import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polygon as LeafletPolygon, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TrackedPosition } from "@/hooks/useGeolocationTracker";

interface Props {
  pilot: TrackedPosition | null;
  plannedPolygon: [number, number][] | null;
  plannedPath: [number, number][] | null;
  flownTrack: { latitude: number; longitude: number }[];
  className?: string;
}

const pilotIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:28px;height:28px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:hsl(140 35% 30%);box-shadow:0 0 0 4px hsla(140,35%,30%,0.3);"></div>
      <div style="position:absolute;inset:8px;border-radius:50%;background:white;"></div>
    </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function CenterOnPilot({ pilot }: { pilot: TrackedPosition | null }) {
  const map = useMap();
  useEffect(() => {
    if (pilot) map.setView([pilot.latitude, pilot.longitude], map.getZoom() || 17, { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilot?.latitude, pilot?.longitude]);
  return null;
}

export default function PilotMapView({ pilot, plannedPolygon, plannedPath, flownTrack, className }: Props) {
  const initialCenter: [number, number] = pilot
    ? [pilot.latitude, pilot.longitude]
    : plannedPolygon?.[0] ?? [37.7749, -122.4194];

  return (
    <div className={`relative rounded-xl overflow-hidden border border-border ${className ?? ""}`}>
      <MapContainer
        center={initialCenter}
        zoom={17}
        scrollWheelZoom
        className="w-full h-full"
        style={{ minHeight: 280 }}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Esri"
          maxZoom={20}
        />

        {plannedPolygon && plannedPolygon.length >= 3 && (
          <LeafletPolygon
            positions={plannedPolygon}
            pathOptions={{ color: "hsl(45 95% 50%)", weight: 2, fillOpacity: 0.1 }}
          />
        )}

        {plannedPath && plannedPath.length >= 2 && (
          <Polyline
            positions={plannedPath}
            pathOptions={{ color: "hsl(45 95% 55%)", weight: 3, dashArray: "6 4" }}
          />
        )}

        {flownTrack.length >= 2 && (
          <Polyline
            positions={flownTrack.map((p) => [p.latitude, p.longitude])}
            pathOptions={{ color: "hsl(140 60% 45%)", weight: 4 }}
          />
        )}

        {pilot && (
          <>
            <Marker position={[pilot.latitude, pilot.longitude]} icon={pilotIcon} />
            <CenterOnPilot pilot={pilot} />
          </>
        )}
      </MapContainer>
    </div>
  );
}

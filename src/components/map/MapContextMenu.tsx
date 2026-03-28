import { useState, useEffect, useCallback } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Copy, MapPin, Crosshair, Search } from "lucide-react";

interface MapContextMenuProps {
  onDropPin?: (pos: [number, number]) => void;
}

export default function MapContextMenu({ onDropPin }: MapContextMenuProps) {
  const map = useMap();
  const [menu, setMenu] = useState<{ x: number; y: number; lat: number; lng: number } | null>(null);
  const [reverseResult, setReverseResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Close on any click or map move
  useEffect(() => {
    const close = () => setMenu(null);
    map.on("click", close);
    map.on("movestart", close);
    return () => {
      map.off("click", close);
      map.off("movestart", close);
    };
  }, [map]);

  useMapEvents({
    contextmenu(e) {
      e.originalEvent.preventDefault();
      const containerPoint = map.latLngToContainerPoint(e.latlng);
      setMenu({ x: containerPoint.x, y: containerPoint.y, lat: e.latlng.lat, lng: e.latlng.lng });
      setReverseResult(null);
    },
  });

  const copyCoords = useCallback(() => {
    if (!menu) return;
    navigator.clipboard.writeText(`${menu.lat.toFixed(6)}, ${menu.lng.toFixed(6)}`);
    setMenu(null);
  }, [menu]);

  const dropPin = useCallback(() => {
    if (!menu) return;
    onDropPin?.([menu.lat, menu.lng]);
    setMenu(null);
  }, [menu, onDropPin]);

  const centerHere = useCallback(() => {
    if (!menu) return;
    map.flyTo([menu.lat, menu.lng], map.getZoom(), { duration: 0.5 });
    setMenu(null);
  }, [menu, map]);

  const whatsHere = useCallback(async () => {
    if (!menu) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${menu.lat}&lon=${menu.lng}&zoom=18`
      );
      const data = await res.json();
      setReverseResult(data.display_name || "No results found");
    } catch {
      setReverseResult("Lookup failed");
    }
    setLoading(false);
  }, [menu]);

  if (!menu) return null;

  return (
    <div
      className="absolute z-[1100] bg-card/95 backdrop-blur border border-border rounded-xl shadow-xl py-1 min-w-[180px] text-xs"
      style={{ left: menu.x, top: menu.y }}
    >
      <div className="px-3 py-1.5 text-[10px] text-muted-foreground font-mono border-b border-border">
        {menu.lat.toFixed(6)}, {menu.lng.toFixed(6)}
      </div>
      <button onClick={copyCoords} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary transition-colors text-foreground">
        <Copy className="w-3.5 h-3.5" /> Copy Coordinates
      </button>
      <button onClick={dropPin} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary transition-colors text-foreground">
        <MapPin className="w-3.5 h-3.5" /> Drop Pin Here
      </button>
      <button onClick={centerHere} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary transition-colors text-foreground">
        <Crosshair className="w-3.5 h-3.5" /> Center Map Here
      </button>
      <div className="h-px bg-border mx-1" />
      <button onClick={whatsHere} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary transition-colors text-foreground">
        <Search className="w-3.5 h-3.5" /> {loading ? "Looking up…" : "What's Here?"}
      </button>
      {reverseResult && (
        <div className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border leading-relaxed max-w-[240px]">
          {reverseResult}
        </div>
      )}
    </div>
  );
}

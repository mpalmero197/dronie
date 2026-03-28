import { useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { Locate, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function GeolocationButton() {
  const map = useMap();
  const [loading, setLoading] = useState(false);
  const [marker, setMarker] = useState<L.LayerGroup | null>(null);

  const locate = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const latlng = L.latLng(latitude, longitude);

        // Remove previous
        if (marker) map.removeLayer(marker);

        const group = L.layerGroup().addTo(map);

        // Accuracy circle
        L.circle(latlng, {
          radius: accuracy,
          color: "hsl(217, 91%, 60%)",
          fillColor: "hsl(217, 91%, 60%)",
          fillOpacity: 0.1,
          weight: 1,
        }).addTo(group);

        // Pulsing dot via divIcon
        const dot = L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;border-radius:50%;background:hsl(217,91%,60%);border:2.5px solid white;box-shadow:0 0 8px rgba(59,130,246,0.6);animation:pulse-geo 2s infinite"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker(latlng, { icon: dot, interactive: false }).addTo(group);

        setMarker(group);
        map.flyTo(latlng, 16, { duration: 1.2 });
        setLoading(false);
      },
      () => setLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={locate}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Locate className="w-3.5 h-3.5" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">My Location</TooltipContent>
    </Tooltip>
  );
}

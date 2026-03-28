import { useState, useCallback } from "react";
import { useMapEvents } from "react-leaflet";
import { Copy, Check } from "lucide-react";

type CoordFormat = "dd" | "dms" | "utm";

function toDMS(deg: number, isLat: boolean): string {
  const dir = isLat ? (deg >= 0 ? "N" : "S") : deg >= 0 ? "E" : "W";
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = ((abs - d - m / 60) * 3600).toFixed(1);
  return `${d}°${m}'${s}"${dir}`;
}

function toUTM(lat: number, lng: number): string {
  const zone = Math.floor((lng + 180) / 6) + 1;
  const letter = lat >= 0 ? "N" : "S";
  return `${zone}${letter} ${lng.toFixed(4)}E ${lat.toFixed(4)}N`;
}

export default function MousePositionDisplay() {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [format, setFormat] = useState<CoordFormat>("dd");
  const [copied, setCopied] = useState(false);

  useMapEvents({
    mousemove(e) {
      setPos({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    mouseout() {
      setPos(null);
    },
  });

  const formatCoords = useCallback(() => {
    if (!pos) return "";
    switch (format) {
      case "dms":
        return `${toDMS(pos.lat, true)} ${toDMS(pos.lng, false)}`;
      case "utm":
        return toUTM(pos.lat, pos.lng);
      default:
        return `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
    }
  }, [pos, format]);

  const cycleFormat = () => {
    setFormat((f) => (f === "dd" ? "dms" : f === "dms" ? "utm" : "dd"));
  };

  const copyCoords = () => {
    if (!pos) return;
    navigator.clipboard.writeText(formatCoords());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!pos) return null;

  return (
    <div className="absolute bottom-3 right-3 z-[900] flex items-center gap-1">
      <button
        onClick={cycleFormat}
        className="bg-card/90 backdrop-blur rounded-l-lg border border-border border-r-0 px-2 py-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
        title="Click to change format"
      >
        {formatCoords()}
      </button>
      <button
        onClick={copyCoords}
        className="bg-card/90 backdrop-blur rounded-r-lg border border-border px-1.5 py-1 text-muted-foreground hover:text-foreground transition-colors"
        title="Copy coordinates"
      >
        {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

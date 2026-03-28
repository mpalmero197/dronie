import { useState, useCallback, useRef } from "react";
import { useMap, GeoJSON } from "react-leaflet";
import L from "leaflet";
import { LandPlot, Upload, Loader2, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

interface ParcelLayer {
  id: string;
  name: string;
  data: GeoJSON.FeatureCollection;
  visible: boolean;
  color: string;
}

const PARCEL_COLORS = ["#e11d48", "#2563eb", "#16a34a", "#d97706", "#7c3aed"];

export default function PropertyLines() {
  const map = useMap();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [layers, setLayers] = useState<ParcelLayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const text = await file.text();
      let geojson: GeoJSON.FeatureCollection;

      if (file.name.endsWith(".geojson") || file.name.endsWith(".json")) {
        const parsed = JSON.parse(text);
        if (parsed.type === "FeatureCollection") {
          geojson = parsed;
        } else if (parsed.type === "Feature") {
          geojson = { type: "FeatureCollection", features: [parsed] };
        } else if (parsed.type && parsed.coordinates) {
          geojson = { type: "FeatureCollection", features: [{ type: "Feature", geometry: parsed, properties: {} }] };
        } else {
          throw new Error("Invalid GeoJSON");
        }
      } else if (file.name.endsWith(".kml")) {
        // Basic KML to GeoJSON — extract Placemarks with coordinates
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/xml");
        const placemarks = doc.querySelectorAll("Placemark");
        const features: GeoJSON.Feature[] = [];

        placemarks.forEach((pm) => {
          const name = pm.querySelector("name")?.textContent || "Parcel";
          const coordEl = pm.querySelector("coordinates");
          if (!coordEl?.textContent) return;

          const coords = coordEl.textContent.trim().split(/\s+/).map(c => {
            const [lng, lat] = c.split(",").map(Number);
            return [lng, lat] as [number, number];
          });

          if (coords.length >= 3) {
            features.push({
              type: "Feature",
              properties: { name },
              geometry: { type: "Polygon", coordinates: [coords] },
            });
          } else if (coords.length === 1) {
            features.push({
              type: "Feature",
              properties: { name },
              geometry: { type: "Point", coordinates: coords[0] },
            });
          }
        });

        geojson = { type: "FeatureCollection", features };
      } else {
        throw new Error("Unsupported format. Use .geojson or .kml files.");
      }

      if (!geojson.features.length) {
        throw new Error("No features found in file.");
      }

      const newLayer: ParcelLayer = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.(geojson|json|kml)$/i, ""),
        data: geojson,
        visible: true,
        color: PARCEL_COLORS[layers.length % PARCEL_COLORS.length],
      };

      setLayers(prev => [...prev, newLayer]);
      setPanelOpen(true);

      // Fly to bounds
      const geoLayer = L.geoJSON(geojson as any);
      const bounds = geoLayer.getBounds();
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [40, 40], duration: 1 });
      }

      toast({ title: "Property lines imported", description: `${geojson.features.length} feature(s) from ${file.name}` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message || "Could not parse file.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [layers.length, map, toast]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const toggleVisibility = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const removeLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
  };

  const parcelStyle = (color: string): L.PathOptions => ({
    color,
    weight: 2.5,
    fillOpacity: 0.08,
    dashArray: "6 3",
  });

  return (
    <>
      {/* Rendered GeoJSON layers */}
      {layers.filter(l => l.visible).map(l => (
        <GeoJSON
          key={l.id + l.color}
          data={l.data}
          style={() => parcelStyle(l.color)}
          onEachFeature={(feature, layer) => {
            const name = feature.properties?.name || feature.properties?.PARCEL_ID || "Parcel";
            const area = feature.properties?.area || feature.properties?.AREA || "";
            layer.bindPopup(
              `<div class="text-xs"><strong>${name}</strong>${area ? `<br/>Area: ${area}` : ""}</div>`
            );
          }}
        />
      ))}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".geojson,.json,.kml"
        onChange={onFileChange}
        className="hidden"
      />

      {/* Property Lines control panel — bottom-left above layer switcher */}
      <div className="absolute bottom-24 left-4 z-[900]">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setPanelOpen(v => !v)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border transition-all ${
                panelOpen || layers.length > 0
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card/95 backdrop-blur text-muted-foreground border-border hover:bg-secondary"
              }`}
            >
              <LandPlot className="w-4.5 h-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Property Lines</TooltipContent>
        </Tooltip>

        {panelOpen && (
          <div className="absolute bottom-12 left-0 w-64 bg-card/95 backdrop-blur border border-border rounded-xl shadow-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground">Property Lines</h4>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Import
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Import GeoJSON or KML files with parcel/property boundaries.
            </p>

            {layers.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {layers.map(l => (
                  <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/50 text-xs">
                    <div className="w-3 h-3 rounded-sm border flex-shrink-0" style={{ backgroundColor: l.color + "30", borderColor: l.color }} />
                    <span className="flex-1 truncate text-foreground">{l.name}</span>
                    <button onClick={() => toggleVisibility(l.id)} className="text-muted-foreground hover:text-foreground">
                      {l.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button onClick={() => removeLayer(l.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {layers.length === 0 && (
              <div className="text-center py-3">
                <LandPlot className="w-6 h-6 mx-auto text-muted-foreground/40 mb-1" />
                <p className="text-[10px] text-muted-foreground">No layers imported yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

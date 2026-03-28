import { useState, useCallback } from "react";
import { useMap, useMapEvents, GeoJSON } from "react-leaflet";
import L from "leaflet";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ParcelFeature {
  id: string;
  data: GeoJSON.FeatureCollection;
  visible: boolean;
}

interface ParcelFetcherProps {
  active: boolean;
}

export default function ParcelFetcher({ active }: ParcelFetcherProps) {
  const map = useMap();
  const { toast } = useToast();
  const [parcels, setParcels] = useState<ParcelFeature[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchParcels = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    try {
      // Query Overpass API for building outlines, landuse, and boundary polygons near click
      const radius = 100; // meters
      const query = `
        [out:json][timeout:15];
        (
          way(around:${radius},${lat},${lng})["building"];
          way(around:${radius},${lat},${lng})["landuse"];
          way(around:${radius},${lat},${lng})["boundary"="administrative"];
          way(around:${radius},${lat},${lng})["leisure"];
          way(around:${radius},${lat},${lng})["amenity"];
          relation(around:${radius},${lat},${lng})["boundary"];
        );
        out geom;
      `.trim();

      const resp = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (!resp.ok) throw new Error("Overpass API returned an error");

      const json = await resp.json();
      const features: GeoJSON.Feature[] = [];

      for (const el of json.elements || []) {
        if (el.type === "way" && el.geometry) {
          const coords: [number, number][] = el.geometry.map((g: any) => [g.lon, g.lat]);
          // Close polygon if needed
          if (coords.length >= 3) {
            const first = coords[0];
            const last = coords[coords.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
              coords.push([...first] as [number, number]);
            }
            features.push({
              type: "Feature",
              properties: {
                name: el.tags?.name || el.tags?.["addr:street"] || `Parcel ${el.id}`,
                type: el.tags?.building || el.tags?.landuse || el.tags?.boundary || "unknown",
                ...el.tags,
              },
              geometry: { type: "Polygon", coordinates: [coords] },
            });
          }
        } else if (el.type === "relation" && el.members) {
          // Handle multipolygon relations
          for (const member of el.members) {
            if (member.type === "way" && member.geometry) {
              const coords: [number, number][] = member.geometry.map((g: any) => [g.lon, g.lat]);
              if (coords.length >= 3) {
                const first = coords[0];
                const last = coords[coords.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                  coords.push([...first] as [number, number]);
                }
                features.push({
                  type: "Feature",
                  properties: {
                    name: el.tags?.name || `Boundary ${el.id}`,
                    type: el.tags?.boundary || "relation",
                    ...el.tags,
                  },
                  geometry: { type: "Polygon", coordinates: [coords] },
                });
              }
            }
          }
        }
      }

      if (features.length === 0) {
        // Try reverse geocode to show what's at this location
        const revResp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          { headers: { "User-Agent": "MapForge/1.0" } }
        );
        const revData = await revResp.json();
        toast({
          title: "No parcel boundaries found",
          description: revData.display_name
            ? `Location: ${revData.display_name}. Try a more developed area.`
            : "No OSM boundary data at this location. Try a different area.",
        });
        return;
      }

      const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };
      const newParcel: ParcelFeature = {
        id: crypto.randomUUID(),
        data: fc,
        visible: true,
      };
      setParcels(prev => [...prev, newParcel]);

      // Fly to bounds
      const geoLayer = L.geoJSON(fc as any);
      const bounds = geoLayer.getBounds();
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [40, 40], duration: 0.8 });
      }

      toast({
        title: "Parcels loaded",
        description: `Found ${features.length} boundary/building polygon(s)`,
      });
    } catch (err: any) {
      toast({
        title: "Parcel fetch failed",
        description: err.message || "Could not reach the boundary API",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [map, toast]);

  useMapEvents({
    click(e) {
      if (!active || loading) return;
      fetchParcels(e.latlng.lat, e.latlng.lng);
    },
  });

  const parcelStyle: L.PathOptions = {
    color: "#e11d48",
    weight: 2.5,
    fillOpacity: 0.1,
    fillColor: "#e11d48",
  };

  return (
    <>
      {parcels.filter(p => p.visible).map(p => (
        <GeoJSON
          key={p.id}
          data={p.data}
          style={() => parcelStyle}
          onEachFeature={(feature, layer) => {
            const props = feature.properties || {};
            const name = props.name || "Parcel";
            const type = props.type || "";
            const addr = props["addr:street"] ? `${props["addr:housenumber"] || ""} ${props["addr:street"]}` : "";
            layer.bindPopup(
              `<div class="text-xs space-y-0.5">
                <strong>${name}</strong>
                ${type ? `<br/><span class="text-gray-500">Type: ${type}</span>` : ""}
                ${addr.trim() ? `<br/><span class="text-gray-500">${addr.trim()}</span>` : ""}
              </div>`
            );
          }}
        />
      ))}

      {loading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[950] pointer-events-none">
          <div className="bg-card/95 backdrop-blur rounded-xl p-4 border border-border shadow-xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">Fetching parcels…</span>
          </div>
        </div>
      )}
    </>
  );
}

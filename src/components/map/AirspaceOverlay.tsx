import { useEffect } from "react";
import { TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

const AIRSPACE_CLASS_COLORS: Record<string, string> = {
  A: "#ff0000",
  B: "#0066ff",
  C: "#9933ff",
  D: "#0099cc",
  E: "#00aa44",
  G: "#999999",
  CTR: "#cc0066",
  TMA: "#9933ff",
  RESTRICTED: "#ff4444",
  DANGER: "#ff6600",
  PROHIBITED: "#cc0000",
  MOA: "#ff9900",
  ALERT: "#ffcc00",
};

function getAirspaceColor(classification: string): string {
  const upper = (classification || "").toUpperCase();
  return AIRSPACE_CLASS_COLORS[upper] || "#6666cc";
}

function formatAltitude(alt: any): string {
  if (!alt) return "Unknown";
  const value = alt.value ?? alt;
  const unit = alt.unit === 1 ? "ft" : alt.unit === 6 ? "FL" : "m";
  const ref = alt.referenceDatum === 0 ? "MSL" : alt.referenceDatum === 1 ? "AGL" : alt.referenceDatum === 2 ? "STD" : "";
  if (typeof value === "number") {
    return `${value} ${unit} ${ref}`.trim();
  }
  return String(value);
}

function AirspaceClickHandler() {
  const map = useMap();

  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      const zoom = map.getZoom();
      if (zoom < 8) return; // Too zoomed out for meaningful results

      // Create a small bbox around the click point (~2km)
      const offset = 0.02;
      const bbox = `${lng - offset},${lat - offset},${lng + offset},${lat + offset}`;

      const popup = L.popup({ maxWidth: 320, className: "airspace-popup" })
        .setLatLng(e.latlng)
        .setContent(`<div style="padding:4px;color:#666;font-size:13px;">Querying airspace…</div>`)
        .openOn(map);

      try {
        const res = await fetch(
          `https://api.tiles.openaip.net/api/data/airspaces?bbox=${bbox}&limit=10`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!res.ok) {
          popup.setContent(
            `<div style="padding:4px;color:#666;font-size:13px;">Airspace data unavailable at this location.</div>`
          );
          return;
        }

        const data = await res.json();
        const items = data?.items || data || [];

        if (!Array.isArray(items) || items.length === 0) {
          popup.setContent(
            `<div style="padding:4px;color:#888;font-size:13px;">No airspace zones found at this location.</div>`
          );
          return;
        }

        const html = items
          .slice(0, 5)
          .map((as: any) => {
            const name = as.name || "Unnamed Airspace";
            const classification = as.icaoClass !== undefined
              ? `Class ${["A","B","C","D","E","F","G"][as.icaoClass] || as.icaoClass}`
              : as.type !== undefined
                ? getTypeLabel(as.type)
                : "Unknown";
            const color = getAirspaceColor(
              as.icaoClass !== undefined ? ["A","B","C","D","E","F","G"][as.icaoClass] || "" : getTypeLabel(as.type)
            );
            const lower = formatAltitude(as.lowerLimit);
            const upper = formatAltitude(as.upperLimit);

            return `
              <div style="border-left:4px solid ${color};padding:6px 10px;margin-bottom:6px;background:#f9fafb;border-radius:0 6px 6px 0;">
                <div style="font-weight:700;font-size:13px;color:#1a1a1a;margin-bottom:2px;">${name}</div>
                <div style="font-size:12px;color:#555;display:flex;gap:8px;flex-wrap:wrap;">
                  <span style="background:${color}22;color:${color};padding:1px 6px;border-radius:4px;font-weight:600;">${classification}</span>
                </div>
                <div style="font-size:11px;color:#777;margin-top:4px;">
                  <span>⬇ ${lower}</span> &nbsp;→&nbsp; <span>⬆ ${upper}</span>
                </div>
              </div>`;
          })
          .join("");

        popup.setContent(
          `<div style="max-height:260px;overflow-y:auto;">${html}</div>`
        );
      } catch {
        popup.setContent(
          `<div style="padding:4px;color:#999;font-size:13px;">Unable to fetch airspace data. Try zooming in.</div>`
        );
      }
    },
  });

  return null;
}

function getTypeLabel(type: number): string {
  const labels: Record<number, string> = {
    0: "Other",
    1: "Restricted",
    2: "Danger",
    3: "Prohibited",
    4: "CTR",
    5: "TMZ",
    6: "RMZ",
    7: "TMA",
    8: "TRA",
    9: "TSA",
    10: "FIR",
    11: "UIR",
    12: "ADIZ",
    13: "ATZ",
    14: "MATZ",
    15: "Airway",
    16: "MTR",
    17: "Alert",
    18: "Warning",
    19: "Protected",
    20: "HTZ",
    21: "Gliding",
    22: "TRP",
    23: "TIZ",
    24: "TIA",
    25: "MTA",
    26: "CTA",
    27: "ACC",
    28: "Sport",
    29: "Low Alt Overflight",
  };
  return labels[type] || `Type ${type}`;
}

export default function AirspaceOverlay() {
  return (
    <>
      <TileLayer
        url="https://api.tiles.openaip.net/api/data/airspaces/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openaip.net/">OpenAIP</a>'
        opacity={0.55}
        maxZoom={14}
        zIndex={500}
      />
      <AirspaceClickHandler />
    </>
  );
}

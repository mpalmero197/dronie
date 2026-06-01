import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Drone } from "@/lib/fleet-types";

/**
 * Phase 3 — Live Fleet Map
 * Skydio-Cloud-style ops view: every drone with a known position
 * appears as a pin on a dark map. Pins are color-coded by status,
 * ringed by a battery arc, and pulse when the drone is active.
 * Clicking a pin invokes onSelect so the parent can open the
 * control console.
 */

const STATUS_COLOR: Record<Drone["status"], string> = {
  active: "#10b981",
  idle: "#3b82f6",
  maintenance: "#f59e0b",
  offline: "#6b7280",
};

function makeIcon(drone: Drone): L.DivIcon {
  const color = STATUS_COLOR[drone.status] ?? "#6b7280";
  const battery = Math.max(0, Math.min(100, drone.battery_level ?? 0));
  const pulse = drone.status === "active" ? "fleet-pin-pulse" : "";
  const dash = (100 - battery) * 1.005; // circumference ~100.5
  const heading = drone.heading ?? 0;
  const html = `
    <div class="fleet-pin ${pulse}" style="--c:${color}">
      <svg viewBox="0 0 36 36" width="36" height="36">
        <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="2"/>
        <circle cx="18" cy="18" r="16" fill="none" stroke="${color}" stroke-width="2.5"
                stroke-dasharray="${(100 - dash).toFixed(1)} 100" stroke-dashoffset="25"
                transform="rotate(-90 18 18)" stroke-linecap="round"/>
      </svg>
      <div class="fleet-pin-dot" style="background:${color}; transform: rotate(${heading}deg)">
        <span class="fleet-pin-arrow"></span>
      </div>
      <div class="fleet-pin-label">${drone.name}<br/><span>${battery}%</span></div>
    </div>
  `;
  return L.divIcon({ html, className: "fleet-pin-wrap", iconSize: [36, 36], iconAnchor: [18, 18] });
}

export default function LiveFleetMap({
  drones,
  onSelect,
}: {
  drones: Drone[];
  onSelect?: (d: Drone) => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const positioned = useMemo(
    () => drones.filter((d) => typeof d.latitude === "number" && typeof d.longitude === "number"),
    [drones],
  );

  // Init map once
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      zoomControl: true,
      attributionControl: false,
      worldCopyJump: true,
    }).setView([37.7749, -122.4194], 4);
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 19 },
    ).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();

    positioned.forEach((d) => {
      seen.add(d.id);
      const latlng: [number, number] = [d.latitude as number, d.longitude as number];
      const existing = markersRef.current.get(d.id);
      const icon = makeIcon(d);
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(icon);
      } else {
        const m = L.marker(latlng, { icon }).addTo(map);
        m.on("click", () => onSelect?.(d));
        markersRef.current.set(d.id, m);
      }
    });
    // Remove stale
    markersRef.current.forEach((m, id) => {
      if (!seen.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    });

    // Fit bounds once when we have markers
    if (positioned.length > 0) {
      const bounds = L.latLngBounds(
        positioned.map((d) => [d.latitude as number, d.longitude as number]),
      );
      map.fitBounds(bounds.pad(0.4), { animate: false, maxZoom: 14 });
    }
  }, [positioned, onSelect]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border bg-card">
      <style>{`
        .fleet-pin-wrap { background: transparent !important; border: 0 !important; }
        .fleet-pin { position: relative; width:36px; height:36px; cursor:pointer; }
        .fleet-pin svg { position:absolute; inset:0; }
        .fleet-pin-dot {
          position:absolute; left:50%; top:50%; width:10px; height:10px; margin:-5px 0 0 -5px;
          border-radius:9999px; box-shadow:0 0 0 2px rgba(0,0,0,.6);
        }
        .fleet-pin-arrow {
          position:absolute; left:50%; top:-6px; transform:translateX(-50%);
          width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent;
          border-bottom:6px solid var(--c);
        }
        .fleet-pin-label {
          position:absolute; top:calc(100% + 6px); left:50%; transform:translateX(-50%);
          white-space:nowrap; font-family: ui-sans-serif, system-ui; font-size:10px; font-weight:600;
          color:#fff; background:rgba(0,0,0,.65); padding:3px 6px; border-radius:6px;
          opacity:0; transition: opacity .15s ease;
          backdrop-filter: blur(4px);
        }
        .fleet-pin-label span { font-weight:400; opacity:.75; }
        .fleet-pin:hover .fleet-pin-label { opacity:1; }
        .fleet-pin-pulse::after {
          content:""; position:absolute; inset:-6px; border-radius:9999px;
          border:2px solid var(--c); opacity:.55; animation: fleet-pulse 1.8s ease-out infinite;
        }
        @keyframes fleet-pulse {
          0% { transform:scale(.6); opacity:.7; }
          100% { transform:scale(1.6); opacity:0; }
        }
      `}</style>
      <div ref={mapEl} className="w-full h-[520px]" />
      <div className="absolute top-3 left-3 z-[400] flex flex-wrap gap-2 text-[11px]">
        {(["active", "idle", "maintenance", "offline"] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/80 backdrop-blur border border-border">
            <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
            <span className="capitalize text-foreground">{s}</span>
            <span className="text-muted-foreground">
              {drones.filter((d) => d.status === s).length}
            </span>
          </span>
        ))}
        {positioned.length === 0 && (
          <span className="px-2 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
            No drones report GPS yet
          </span>
        )}
      </div>
    </div>
  );
}
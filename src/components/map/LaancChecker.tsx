import { useState, useEffect } from "react";
import { useMapEvents, useMap, CircleMarker, Popup } from "react-leaflet";
import {
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Plane, ArrowDown, ArrowUp, X, Info,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AirspaceZone {
  name: string;
  icaoClass?: number;
  type?: number;
  lowerLimit?: any;
  upperLimit?: any;
}

export interface LaancResult {
  lat: number;
  lng: number;
  zones: AirspaceZone[];
  authorization: "authorized" | "requires_auth" | "prohibited" | "uncontrolled";
  maxAutoAltFt: number;
  message: string;
  details: string[];
}

const ICAO_CLASS_LABELS = ["A", "B", "C", "D", "E", "F", "G"];

const TYPE_LABELS: Record<number, string> = {
  0: "Other", 1: "Restricted", 2: "Danger", 3: "Prohibited", 4: "CTR",
  5: "TMZ", 6: "RMZ", 7: "TMA", 8: "TRA", 9: "TSA", 10: "FIR",
  13: "ATZ", 14: "MATZ", 17: "Alert", 18: "Warning", 19: "Protected",
};

function getClassLabel(zone: AirspaceZone): string {
  if (zone.icaoClass !== undefined) {
    return `Class ${ICAO_CLASS_LABELS[zone.icaoClass] || zone.icaoClass}`;
  }
  if (zone.type !== undefined) {
    return TYPE_LABELS[zone.type] || `Type ${zone.type}`;
  }
  return "Unknown";
}

function formatAlt(alt: any): string {
  if (!alt) return "Unknown";
  const value = alt.value ?? alt;
  const unit = alt.unit === 1 ? "ft" : alt.unit === 6 ? "FL" : "m";
  const ref = alt.referenceDatum === 0 ? "MSL" : alt.referenceDatum === 1 ? "AGL" : alt.referenceDatum === 2 ? "STD" : "";
  if (typeof value === "number") return `${value} ${unit} ${ref}`.trim();
  return String(value);
}

function analyzeLaanc(zones: AirspaceZone[]): Omit<LaancResult, "lat" | "lng" | "zones"> {
  if (zones.length === 0) {
    return {
      authorization: "uncontrolled",
      maxAutoAltFt: 400,
      message: "Uncontrolled airspace — Part 107 rules apply",
      details: [
        "No controlled airspace detected at this location.",
        "You may fly up to 400 ft AGL under Part 107 without LAANC authorization.",
        "Always check for temporary flight restrictions (TFRs) before flying.",
      ],
    };
  }

  const prohibited = zones.some(
    (z) => z.type === 3 || z.type === 1 || z.type === 2
  );
  if (prohibited) {
    const pZone = zones.find((z) => z.type === 3 || z.type === 1 || z.type === 2);
    return {
      authorization: "prohibited",
      maxAutoAltFt: 0,
      message: `Flight prohibited — ${getClassLabel(pZone!)} airspace`,
      details: [
        `This location is within ${pZone?.name || "restricted/prohibited"} airspace.`,
        "LAANC authorization is NOT available here.",
        "Flight requires special permission from the controlling authority.",
        "Do NOT fly without explicit authorization.",
      ],
    };
  }

  // Check for controlled airspace (Class B, C, D, E surface)
  const controlled = zones.filter(
    (z) => z.icaoClass !== undefined && z.icaoClass <= 4 // A through E
  );

  if (controlled.length > 0) {
    const highestClass = controlled.reduce((min, z) =>
      (z.icaoClass ?? 99) < (min.icaoClass ?? 99) ? z : min
    );
    const classLabel = getClassLabel(highestClass);

    // Class A — no UAS
    if (highestClass.icaoClass === 0) {
      return {
        authorization: "prohibited",
        maxAutoAltFt: 0,
        message: "Class A airspace — UAS operations not permitted",
        details: [
          "Class A airspace (18,000+ ft MSL). UAS cannot operate here.",
        ],
      };
    }

    // Approximate LAANC auto-auth ceilings by class
    const autoAlt: Record<number, number> = {
      1: 100,  // Class B — typically 0-100ft near airports
      2: 200,  // Class C
      3: 400,  // Class D
      4: 400,  // Class E surface
    };
    const maxAlt = autoAlt[highestClass.icaoClass ?? 4] || 200;

    return {
      authorization: "requires_auth",
      maxAutoAltFt: maxAlt,
      message: `${classLabel} — LAANC authorization required`,
      details: [
        `This location is within ${highestClass.name || classLabel} airspace.`,
        `LAANC auto-approval available up to ${maxAlt} ft AGL (grid-dependent).`,
        "Authorization is required BEFORE takeoff via a LAANC-approved app.",
        "Approved apps: Aloft, Airmap, KittyHawk, DroneUp.",
        maxAlt < 400
          ? `Flights above ${maxAlt} ft require further coordination with ATC.`
          : "Max altitude under Part 107: 400 ft AGL.",
      ],
    };
  }

  // Class E, G with overlying airspace
  return {
    authorization: "authorized",
    maxAutoAltFt: 400,
    message: "Likely uncontrolled — standard Part 107 rules",
    details: [
      "No surface-level controlled airspace detected.",
      "Fly up to 400 ft AGL under standard Part 107 rules.",
      "Overlying airspace may exist at higher altitudes.",
      "Always verify via a LAANC-approved app before flying.",
    ],
  };
}

const statusConfig = {
  authorized: {
    icon: ShieldCheck,
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    label: "Authorized",
  },
  requires_auth: {
    icon: ShieldAlert,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    label: "Auth Required",
  },
  prohibited: {
    icon: ShieldX,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700",
    label: "Prohibited",
  },
  uncontrolled: {
    icon: ShieldCheck,
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    label: "No Auth Needed",
  },
};

interface Props {
  active: boolean;
  onResult?: (result: LaancResult | null) => void;
}

export default function LaancChecker({ active, onResult }: Props) {
  const map = useMap();
  const [result, setResult] = useState<LaancResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Clear result when deactivated
  useEffect(() => {
    if (!active) setResult(null);
  }, [active]);

  // Notify parent of result changes
  useEffect(() => {
    onResult?.(result);
  }, [result, onResult]);

  useMapEvents({
    click: async (e) => {
      if (!active) return;

      const { lat, lng } = e.latlng;
      setLoading(true);
      setResult(null);

      try {
        const offset = 0.015;
        const bbox = `${lng - offset},${lat - offset},${lng + offset},${lat + offset}`;
        const res = await fetch(
          `https://api.tiles.openaip.net/api/data/airspaces?bbox=${bbox}&limit=15`,
          { headers: { Accept: "application/json" } }
        );

        let zones: AirspaceZone[] = [];
        if (res.ok) {
          const data = await res.json();
          const items = data?.items || data || [];
          if (Array.isArray(items)) {
            zones = items.map((a: any) => ({
              name: a.name,
              icaoClass: a.icaoClass,
              type: a.type,
              lowerLimit: a.lowerLimit,
              upperLimit: a.upperLimit,
            }));
          }
        }

        const analysis = analyzeLaanc(zones);
        setResult({ lat, lng, zones, ...analysis });
      } catch {
        setResult({
          lat, lng, zones: [],
          authorization: "uncontrolled",
          maxAutoAltFt: 400,
          message: "Unable to query airspace — assume uncontrolled",
          details: ["Could not reach airspace API. Check your connection and try again."],
        });
      } finally {
        setLoading(false);
      }
    },
  });

  if (!active) return null;

  return (
    <>
      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-20 right-4 z-[1000] bg-card/95 backdrop-blur rounded-xl border border-border shadow-lg px-4 py-3 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Checking airspace…</span>
        </div>
      )}

      {/* Marker at checked location */}
      {result && (
        <CircleMarker
          center={[result.lat, result.lng]}
          radius={10}
          pathOptions={{
            color: result.authorization === "prohibited" ? "#dc2626" :
                   result.authorization === "requires_auth" ? "#d97706" : "#16a34a",
            fillColor: result.authorization === "prohibited" ? "#dc2626" :
                       result.authorization === "requires_auth" ? "#d97706" : "#16a34a",
            fillOpacity: 0.3,
            weight: 3,
          }}
        />
      )}

      {/* Result Panel */}
      {result && !loading && (
        <div className="absolute top-20 right-4 z-[1000] w-80 max-h-[calc(100vh-140px)] overflow-y-auto">
          <LaancResultPanel result={result} onClose={() => setResult(null)} />
        </div>
      )}
    </>
  );
}

function LaancResultPanel({ result, onClose }: { result: LaancResult; onClose: () => void }) {
  const config = statusConfig[result.authorization];
  const StatusIcon = config.icon;

  return (
    <div className={`rounded-xl border shadow-xl overflow-hidden ${config.bg}`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-inherit">
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-5 h-5 ${config.color}`} />
          <div>
            <div className={`text-sm font-bold ${config.color}`}>{config.label}</div>
            <div className="text-[10px] text-muted-foreground">
              {result.lat.toFixed(5)}, {result.lng.toFixed(5)}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-black/5 transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Max altitude */}
      <div className="px-4 py-3 bg-white/60 border-b border-inherit">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Max Auto-Approval Altitude</span>
          <span className={`text-lg font-bold ${config.color}`}>
            {result.maxAutoAltFt > 0 ? `${result.maxAutoAltFt} ft` : "N/A"}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              result.authorization === "prohibited" ? "bg-red-500" :
              result.authorization === "requires_auth" ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${(result.maxAutoAltFt / 400) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">0 ft</span>
          <span className="text-[10px] text-muted-foreground">400 ft AGL</span>
        </div>
      </div>

      {/* Message */}
      <div className="px-4 py-3 border-b border-inherit">
        <p className="text-sm font-semibold text-foreground">{result.message}</p>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-2">
        {result.details.map((d, i) => (
          <div key={i} className="flex items-start gap-2">
            <Info className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">{d}</p>
          </div>
        ))}
      </div>

      {/* Airspace zones found */}
      {result.zones.length > 0 && (
        <div className="px-4 py-3 border-t border-inherit">
          <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2">
            Airspace Zones Detected ({result.zones.length})
          </p>
          <div className="space-y-1.5">
            {result.zones.slice(0, 6).map((zone, i) => (
              <div key={i} className="flex items-center justify-between bg-white/50 rounded-lg px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{zone.name || "Unnamed"}</p>
                  <p className="text-[10px] text-muted-foreground">{getClassLabel(zone)}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ArrowDown className="w-2.5 h-2.5" />
                    {formatAlt(zone.lowerLimit)}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ArrowUp className="w-2.5 h-2.5" />
                    {formatAlt(zone.upperLimit)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="px-4 py-2.5 bg-black/5 border-t border-inherit">
        <div className="flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Advisory only. Always verify via an FAA-approved LAANC app (Aloft, AirMap, DroneUp) before flight. Check TFRs and local regulations.
          </p>
        </div>
      </div>
    </div>
  );
}

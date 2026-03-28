import { useState, useEffect, useCallback } from "react";
import { useMap } from "react-leaflet";
import { Sun, Sunrise, Sunset, ChevronDown, ChevronUp } from "lucide-react";

interface SunData {
  altitude: number;
  azimuth: number;
  sunrise: Date;
  sunset: Date;
  goldenHourStart: Date;
  goldenHourEnd: Date;
}

function calcSunPosition(lat: number, lng: number, date: Date): SunData {
  const rad = Math.PI / 180;
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const declination = -23.45 * Math.cos(rad * (360 / 365) * (dayOfYear + 10));
  const timeOffset = lng / 15;
  const solarHour = date.getUTCHours() + date.getUTCMinutes() / 60 + timeOffset;
  const hourAngle = (solarHour - 12) * 15;

  const sinAlt = Math.sin(lat * rad) * Math.sin(declination * rad) +
    Math.cos(lat * rad) * Math.cos(declination * rad) * Math.cos(hourAngle * rad);
  const altitude = Math.asin(sinAlt) / rad;

  const cosAz = (Math.sin(declination * rad) - Math.sin(lat * rad) * sinAlt) /
    (Math.cos(lat * rad) * Math.cos(Math.asin(sinAlt)));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) / rad;
  if (hourAngle > 0) azimuth = 360 - azimuth;

  // Sunrise/sunset approximation
  const cosHa = -Math.tan(lat * rad) * Math.tan(declination * rad);
  const ha = Math.acos(Math.max(-1, Math.min(1, cosHa))) / rad;
  const sunriseHour = 12 - ha / 15 - timeOffset;
  const sunsetHour = 12 + ha / 15 - timeOffset;

  const toDate = (h: number) => {
    const d = new Date(date);
    d.setUTCHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
    return d;
  };

  // Golden hour: ~1 hour before sunset
  const goldenStart = toDate(sunsetHour - 1);
  const goldenEnd = toDate(sunsetHour);

  return {
    altitude,
    azimuth,
    sunrise: toDate(sunriseHour),
    sunset: toDate(sunsetHour),
    goldenHourStart: goldenStart,
    goldenHourEnd: goldenEnd,
  };
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function SunPositionWidget() {
  const map = useMap();
  const [sun, setSun] = useState<SunData | null>(null);
  const [expanded, setExpanded] = useState(false);

  const update = useCallback(() => {
    const c = map.getCenter();
    setSun(calcSunPosition(c.lat, c.lng, new Date()));
  }, [map]);

  useEffect(() => {
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [update]);

  useEffect(() => {
    map.on("moveend", update);
    return () => { map.off("moveend", update); };
  }, [map, update]);

  if (!sun) return null;

  const isDay = sun.altitude > 0;
  const isGoldenHour = new Date() >= sun.goldenHourStart && new Date() <= sun.goldenHourEnd;

  return (
    <div className="absolute top-14 right-14 sm:right-3 z-[900]">
      <div className="bg-card/90 backdrop-blur border border-border rounded-xl shadow-lg overflow-hidden min-w-[160px]">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/50 transition-colors"
        >
          <Sun className={`w-3.5 h-3.5 ${isGoldenHour ? "text-amber-500" : isDay ? "text-yellow-500" : "text-muted-foreground"}`} />
          <span className="text-xs font-semibold text-foreground">
            {sun.altitude.toFixed(1)}° alt
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {isGoldenHour ? "✨ Golden Hour" : isDay ? "Daylight" : "Night"}
          </span>
          {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </button>

        {expanded && (
          <div className="border-t border-border px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-foreground">
              <Sunrise className="w-3 h-3 text-amber-500" />
              <span>Sunrise: {formatTime(sun.sunrise)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground">
              <Sunset className="w-3 h-3 text-orange-500" />
              <span>Sunset: {formatTime(sun.sunset)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground">
              <Sun className="w-3 h-3 text-muted-foreground" />
              <span>Azimuth: {sun.azimuth.toFixed(1)}°</span>
            </div>
            <div className="text-[10px] text-muted-foreground bg-secondary/50 rounded px-2 py-1">
              ✨ Golden Hour: {formatTime(sun.goldenHourStart)} – {formatTime(sun.goldenHourEnd)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

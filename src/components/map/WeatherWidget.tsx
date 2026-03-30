import { useState, useEffect, useCallback } from "react";
import { useMap } from "react-leaflet";
import { Cloud, Wind, Eye, Thermometer, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

interface WeatherData {
  temperature: number;
  windspeed: number;
  winddirection: number;
  weathercode: number;
}

const WEATHER_CODES: Record<number, string> = {
  0: "Clear", 1: "Mostly Clear", 2: "Partly Cloudy", 3: "Overcast",
  45: "Foggy", 48: "Rime Fog", 51: "Light Drizzle", 53: "Drizzle", 55: "Heavy Drizzle",
  61: "Light Rain", 63: "Rain", 65: "Heavy Rain", 71: "Light Snow", 73: "Snow", 75: "Heavy Snow",
  80: "Light Showers", 81: "Showers", 82: "Heavy Showers", 95: "Thunderstorm",
};

function windDir(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export default function WeatherWidget() {
  const map = useMap();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchWeather = useCallback(async () => {
    const center = map.getCenter();
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${center.lat.toFixed(4)}&longitude=${center.lng.toFixed(4)}&current_weather=true`
      );
      const data = await res.json();
      if (data.current_weather) {
        setWeather(data.current_weather);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [map]);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Refetch on significant map move
  useEffect(() => {
    const handler = () => fetchWeather();
    map.on("moveend", handler);
    return () => { map.off("moveend", handler); };
  }, [map, fetchWeather]);

  if (!weather && !loading) return null;

  return (
    <div className="absolute top-14 left-14 sm:top-3 sm:left-auto sm:right-[15rem] z-[900]">
      <div className="bg-card/90 backdrop-blur border border-border rounded-xl shadow-lg overflow-hidden min-w-[160px]">
        {/* Header — always visible */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/50 transition-colors"
        >
          <Cloud className="w-3.5 h-3.5 text-muted-foreground" />
          {weather ? (
            <span className="text-xs font-semibold text-foreground">{weather.temperature}°C</span>
          ) : (
            <span className="text-xs text-muted-foreground">Loading…</span>
          )}
          {weather && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              {WEATHER_CODES[weather.weathercode] || "Unknown"}
            </span>
          )}
          {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </button>

        {/* Expanded details */}
        {expanded && weather && (
          <div className="border-t border-border px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-foreground">
              <Thermometer className="w-3 h-3 text-muted-foreground" />
              <span>Temperature: {weather.temperature}°C</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground">
              <Wind className="w-3 h-3 text-muted-foreground" />
              <span>Wind: {weather.windspeed} km/h {windDir(weather.winddirection)}</span>
            </div>
            {weather.windspeed > 35 && (
              <div className="text-[10px] text-destructive font-semibold bg-destructive/10 rounded px-2 py-1">
                ⚠️ High winds — unsafe for most drones
              </div>
            )}
            {weather.windspeed > 20 && weather.windspeed <= 35 && (
              <div className="text-[10px] text-amber-600 font-semibold bg-amber-500/10 rounded px-2 py-1">
                ⚡ Moderate winds — fly with caution
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); fetchWeather(); }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

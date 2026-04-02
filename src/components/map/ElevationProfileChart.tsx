import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { haversineDistance } from "@/lib/flightPathGenerators";

interface ElevationProfileChartProps {
  waypoints: [number, number][];
  elevations: number[];
  altitude: number;
  terrainFollow: boolean;
}

export default function ElevationProfileChart({
  waypoints, elevations, altitude, terrainFollow,
}: ElevationProfileChartProps) {
  const data = useMemo(() => {
    if (!waypoints.length || !elevations.length) return [];

    // Downsample to max ~80 points for performance
    const maxPts = 80;
    const step = Math.max(1, Math.floor(waypoints.length / maxPts));
    let cumDist = 0;
    const pts: { dist: number; ground: number; flight: number }[] = [];

    for (let i = 0; i < waypoints.length; i += step) {
      if (i > 0) {
        // Sum distances for skipped points
        for (let j = Math.max(0, i - step + 1); j <= i; j++) {
          if (j > 0) cumDist += haversineDistance(waypoints[j - 1], waypoints[j]);
        }
      }
      const elev = elevations[i] ?? 0;
      pts.push({
        dist: Math.round(cumDist),
        ground: Math.round(elev),
        flight: Math.round(terrainFollow ? elev + altitude : altitude + (elevations[0] ?? 0)),
      });
    }
    return pts;
  }, [waypoints, elevations, altitude, terrainFollow]);

  if (data.length < 2) return null;

  const minElev = Math.min(...data.map(d => d.ground));
  const maxFlight = Math.max(...data.map(d => d.flight));
  const yMin = Math.max(0, minElev - 10);
  const yMax = maxFlight + 20;

  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Elevation Profile
      </h4>
      <div className="h-28 w-full rounded-lg bg-background border border-border p-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(152, 52%, 22%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(152, 52%, 22%)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="flightGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(38, 95%, 52%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(38, 95%, 52%)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="dist"
              tick={{ fontSize: 9, fill: "hsl(220, 20%, 48%)" }}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 9, fill: "hsl(220, 20%, 48%)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}m`}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(0, 0%, 100%)",
                border: "1px solid hsl(220, 16%, 88%)",
                borderRadius: 8,
                fontSize: 11,
                padding: "6px 10px",
              }}
              formatter={(value: number, name: string) => [
                `${value}m`,
                name === "ground" ? "Terrain" : "Flight Alt",
              ]}
              labelFormatter={(v) => `${v}m along path`}
            />
            <Area
              type="monotone"
              dataKey="ground"
              stroke="hsl(152, 52%, 22%)"
              strokeWidth={1.5}
              fill="url(#groundGrad)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="flight"
              stroke="hsl(38, 95%, 52%)"
              strokeWidth={1.5}
              fill="url(#flightGrad)"
              strokeDasharray="4 2"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-3 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 rounded bg-primary" /> Terrain
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 rounded bg-accent border-t border-dashed border-accent" /> Flight
        </span>
      </div>
    </div>
  );
}

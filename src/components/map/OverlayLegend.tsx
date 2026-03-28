interface OverlayLegendProps {
  type: "elevation" | "ndvi" | "airspace";
}

const AIRSPACE_CLASSES = [
  { color: "hsl(0, 70%, 50%)", label: "Prohibited / Restricted" },
  { color: "hsl(25, 90%, 55%)", label: "Class B" },
  { color: "hsl(45, 90%, 55%)", label: "Class C" },
  { color: "hsl(130, 55%, 45%)", label: "Class D" },
  { color: "hsl(210, 65%, 55%)", label: "Class E" },
  { color: "hsl(280, 50%, 55%)", label: "TFR" },
];

export default function OverlayLegend({ type }: OverlayLegendProps) {
  if (type === "airspace") {
    return (
      <div className="absolute bottom-14 left-14 z-[900] bg-card/95 backdrop-blur rounded-xl border border-border shadow-xl p-2.5 w-40">
        <p className="text-[10px] font-semibold text-foreground mb-1.5">Airspace Classes</p>
        <div className="flex flex-col gap-1">
          {AIRSPACE_CLASSES.map((c) => (
            <div key={c.label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-[10px] text-muted-foreground">{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "elevation") {
    return (
      <div className="absolute bottom-14 left-14 z-[900] bg-card/95 backdrop-blur rounded-xl border border-border shadow-xl p-2.5 w-32">
        <p className="text-[10px] font-semibold text-foreground mb-1.5">Elevation (m)</p>
        <div className="h-24 w-4 rounded-lg mx-auto" style={{
          background: "linear-gradient(to top, hsl(220, 60%, 30%), hsl(152, 52%, 40%), hsl(60, 80%, 50%), hsl(30, 90%, 50%), hsl(0, 70%, 45%), hsl(300, 20%, 95%))"
        }} />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>0</span>
          <span>500</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-14 left-14 z-[900] bg-card/95 backdrop-blur rounded-xl border border-border shadow-xl p-2.5 w-32">
      <p className="text-[10px] font-semibold text-foreground mb-1.5">NDVI Index</p>
      <div className="h-24 w-4 rounded-lg mx-auto" style={{
        background: "linear-gradient(to top, hsl(0, 70%, 45%), hsl(40, 90%, 50%), hsl(60, 80%, 50%), hsl(90, 60%, 45%), hsl(130, 65%, 35%))"
      }} />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>-1</span>
        <span>+1</span>
      </div>
    </div>
  );
}

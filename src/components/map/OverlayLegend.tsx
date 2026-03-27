interface OverlayLegendProps {
  type: "elevation" | "ndvi";
}

export default function OverlayLegend({ type }: OverlayLegendProps) {
  if (type === "elevation") {
    return (
      <div className="absolute bottom-24 right-4 z-[900] bg-card/95 backdrop-blur rounded-xl border border-border shadow-xl p-3 w-36">
        <p className="text-xs font-semibold text-foreground mb-2">Elevation (m)</p>
        <div className="h-32 w-5 rounded-lg mx-auto" style={{
          background: "linear-gradient(to top, hsl(220, 60%, 30%), hsl(152, 52%, 40%), hsl(60, 80%, 50%), hsl(30, 90%, 50%), hsl(0, 70%, 45%), hsl(300, 20%, 95%))"
        }} />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>0</span>
          <span>500</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-24 right-4 z-[900] bg-card/95 backdrop-blur rounded-xl border border-border shadow-xl p-3 w-36">
      <p className="text-xs font-semibold text-foreground mb-2">NDVI Index</p>
      <div className="h-32 w-5 rounded-lg mx-auto" style={{
        background: "linear-gradient(to top, hsl(0, 70%, 45%), hsl(40, 90%, 50%), hsl(60, 80%, 50%), hsl(90, 60%, 45%), hsl(130, 65%, 35%))"
      }} />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>-1</span>
        <span>+1</span>
      </div>
    </div>
  );
}

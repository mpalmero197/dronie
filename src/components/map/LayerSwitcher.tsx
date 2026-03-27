import { useState } from "react";
import { Layers } from "lucide-react";

export type BaseLayer = "satellite" | "streets" | "terrain" | "hybrid";

const LAYERS: { id: BaseLayer; label: string; preview: string }[] = [
  { id: "satellite", label: "Satellite", preview: "🛰️" },
  { id: "streets", label: "Streets", preview: "🗺️" },
  { id: "terrain", label: "Terrain", preview: "⛰️" },
  { id: "hybrid", label: "Hybrid", preview: "🌐" },
];

interface LayerSwitcherProps {
  activeLayer: BaseLayer;
  onChange: (layer: BaseLayer) => void;
}

export default function LayerSwitcher({ activeLayer, onChange }: LayerSwitcherProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-24 left-4 z-[900]">
      {open && (
        <div className="mb-2 bg-card/95 backdrop-blur rounded-xl border border-border shadow-xl p-2 grid grid-cols-2 gap-1.5 w-40">
          {LAYERS.map((layer) => (
            <button
              key={layer.id}
              onClick={() => { onChange(layer.id); setOpen(false); }}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium transition-all ${
                activeLayer === layer.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <span className="text-lg">{layer.preview}</span>
              {layer.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xl border transition-all ${
          open ? "bg-primary text-primary-foreground border-primary" : "bg-card/95 backdrop-blur border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        <Layers className="w-4 h-4" />
      </button>
    </div>
  );
}

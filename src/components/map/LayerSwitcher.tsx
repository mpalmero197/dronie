import { useState } from "react";
import { Layers, Satellite, Map as MapIcon, Mountain, Globe2, Check } from "lucide-react";

export type BaseLayer = "satellite" | "streets" | "terrain" | "hybrid";

const LAYERS: { id: BaseLayer; label: string; Icon: typeof Satellite; tone: string }[] = [
  { id: "satellite", label: "Satellite", Icon: Satellite, tone: "from-emerald-500/20 to-teal-600/20 text-emerald-600" },
  { id: "streets",   label: "Streets",   Icon: MapIcon,   tone: "from-blue-500/20 to-indigo-600/20 text-blue-600" },
  { id: "terrain",   label: "Terrain",   Icon: Mountain,  tone: "from-amber-500/20 to-orange-600/20 text-amber-600" },
  { id: "hybrid",    label: "Hybrid",    Icon: Globe2,    tone: "from-fuchsia-500/20 to-purple-600/20 text-fuchsia-600" },
];

interface LayerSwitcherProps {
  activeLayer: BaseLayer;
  onChange: (layer: BaseLayer) => void;
  variant?: "floating" | "docked";
}

export default function LayerSwitcher({ activeLayer, onChange, variant = "floating" }: LayerSwitcherProps) {
  const [open, setOpen] = useState(false);
  const active = LAYERS.find((l) => l.id === activeLayer);

  if (variant === "docked") {
    return (
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70 px-1 pb-2 flex items-center gap-1.5">
          <Layers className="w-3 h-3" /> Base map
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {LAYERS.map((layer) => {
            const Icon = layer.Icon;
            const isActive = activeLayer === layer.id;
            return (
              <button
                key={layer.id}
                onClick={() => onChange(layer.id)}
                className={`group relative flex flex-col items-start gap-1.5 p-2 rounded-lg text-[11px] font-semibold transition-all overflow-hidden border ${
                  isActive
                    ? "border-primary/50 bg-primary/5 text-foreground shadow-sm"
                    : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border hover:bg-secondary/50"
                }`}
              >
                <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${layer.tone} flex items-center justify-center`}>
                  <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
                </div>
                <span className="leading-none">{layer.label}</span>
                {isActive && (
                  <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="w-2 h-2" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-14 right-3 z-[900]">
      {open && (
        <div className="mb-2 bg-card/95 backdrop-blur-md rounded-2xl border border-border shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.03] p-2 w-44">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70 px-1.5 pb-1.5">Base map</p>
          <div className="grid grid-cols-2 gap-1.5">
            {LAYERS.map((layer) => {
              const Icon = layer.Icon;
              const isActive = activeLayer === layer.id;
              return (
                <button
                  key={layer.id}
                  onClick={() => { onChange(layer.id); setOpen(false); }}
                  className={`group relative flex flex-col items-start gap-1.5 p-2 rounded-xl text-[11px] font-semibold transition-all overflow-hidden border ${
                    isActive
                      ? "border-primary/50 bg-primary/5 text-foreground shadow-sm"
                      : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border hover:bg-secondary/50"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${layer.tone} flex items-center justify-center`}>
                    <Icon className="w-4 h-4" strokeWidth={2.2} />
                  </div>
                  <span className="leading-none">{layer.label}</span>
                  {isActive && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Toggle base map layers"
        aria-expanded={open}
        className={`flex items-center gap-2 pl-2 pr-3 h-9 rounded-xl shadow-[0_4px_14px_-4px_rgba(0,0,0,0.18)] border transition-all ${
          open
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card/95 backdrop-blur-md border-border text-foreground hover:bg-card"
        }`}
      >
        <Layers className="w-3.5 h-3.5" />
        <span className="text-[11px] font-semibold leading-none">{active?.label ?? "Layers"}</span>
      </button>
    </div>
  );
}

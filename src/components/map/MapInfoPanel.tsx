import { useState } from "react";
import { AreaChart, Image as ImageIcon, Calendar, MapPin, ChevronRight, ChevronLeft } from "lucide-react";
import type { Project } from "@/lib/supabase";

interface MapInfoPanelProps {
  project: Project;
  pinCount: number;
  measurement: string | null;
}

export default function MapInfoPanel({ project, pinCount, measurement }: MapInfoPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-3 right-3 z-[900] w-8 h-8 rounded-lg bg-card/95 backdrop-blur border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <div className="absolute top-3 right-3 z-[900] w-52 bg-card/95 backdrop-blur rounded-xl border border-border shadow-xl p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-1">
        <h3 className="font-display font-700 text-foreground text-xs truncate flex-1">{project.name}</h3>
        <button
          onClick={() => setCollapsed(true)}
          className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-1.5 text-xs">
        {project.area_ha && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <AreaChart className="w-3 h-3 text-primary flex-shrink-0" />
            <span>{project.area_ha} ha</span>
          </div>
        )}
        {project.image_count > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <ImageIcon className="w-3 h-3 text-primary flex-shrink-0" />
            <span>{project.image_count.toLocaleString()} images</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-3 h-3 text-primary flex-shrink-0" />
          <span>{new Date(project.created_at).toLocaleDateString()}</span>
        </div>
        {pinCount > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-3 h-3 text-accent flex-shrink-0" />
            <span>{pinCount} annotation{pinCount !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {measurement && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg px-2.5 py-1.5">
          <p className="text-[10px] font-semibold text-accent">Measurement</p>
          <p className="text-xs font-bold text-foreground">{measurement}</p>
        </div>
      )}

      {project.outputs && project.outputs.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-foreground mb-1">Outputs</p>
          <div className="flex flex-wrap gap-0.5">
            {project.outputs.map((o) => (
              <span key={o} className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-secondary-foreground font-medium">
                {o}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

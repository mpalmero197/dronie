import { AreaChart, Image as ImageIcon, Calendar, MapPin } from "lucide-react";
import type { Project } from "@/lib/supabase";

interface MapInfoPanelProps {
  project: Project;
  pinCount: number;
  measurement: string | null;
}

export default function MapInfoPanel({ project, pinCount, measurement }: MapInfoPanelProps) {
  return (
    <div className="absolute top-4 right-4 z-[900] w-56 bg-card/95 backdrop-blur rounded-xl border border-border shadow-xl p-4 space-y-3">
      <h3 className="font-display font-700 text-foreground text-sm truncate">{project.name}</h3>
      <div className="space-y-2 text-xs">
        {project.area_ha && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <AreaChart className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span>{project.area_ha} ha</span>
          </div>
        )}
        {project.image_count > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <ImageIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span>{project.image_count.toLocaleString()} images</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span>{new Date(project.created_at).toLocaleDateString()}</span>
        </div>
        {pinCount > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 text-accent flex-shrink-0" />
            <span>{pinCount} annotation{pinCount !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {measurement && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
          <p className="text-xs font-semibold text-accent">Measurement</p>
          <p className="text-sm font-bold text-foreground">{measurement}</p>
        </div>
      )}

      {project.outputs && project.outputs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground mb-1.5">Outputs</p>
          <div className="flex flex-wrap gap-1">
            {project.outputs.map((o) => (
              <span key={o} className="px-1.5 py-0.5 rounded text-xs bg-secondary text-secondary-foreground font-medium">
                {o}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

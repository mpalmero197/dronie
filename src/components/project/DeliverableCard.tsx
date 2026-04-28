import { forwardRef } from "react";
import { Download, ExternalLink, FileType, ImageIcon, Mountain, Map, Ruler, FileText, Package } from "lucide-react";

const ICONS = {
  orthomosaic: Map,
  pointcloud: Mountain,
  mesh: Mountain,
  dsm: Ruler,
  dtm: Ruler,
  contours: Ruler,
  report: FileText,
  all_assets: Package,
  default: FileType,
} as const;

export interface DeliverableCardProps {
  name: string;
  description?: string;
  kind: keyof typeof ICONS | string;
  downloadUrl?: string | null;
  previewUrl?: string | null;
  viewerHref?: string;
  onSelect?: (selected: boolean) => void;
  selected?: boolean;
}

export const DeliverableCard = forwardRef<HTMLDivElement, DeliverableCardProps>(
  function DeliverableCard(
    { name, description, kind, downloadUrl, previewUrl, viewerHref, onSelect, selected },
    ref
  ) {
    const Icon = (ICONS as any)[kind] || ICONS.default;
    return (
      <div
        ref={ref}
        className={`bg-secondary/50 border rounded-xl overflow-hidden flex flex-col transition-all ${
          selected ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/30"
        }`}
      >
        <div className="aspect-video bg-muted/40 relative overflow-hidden flex items-center justify-center">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Icon className="w-8 h-8" />
              <span className="text-[10px] uppercase tracking-wider font-semibold">No preview</span>
            </div>
          )}
          {onSelect && (
            <label className="absolute top-2 left-2 flex items-center gap-1 bg-card/90 backdrop-blur rounded-md px-1.5 py-1 cursor-pointer text-[11px]">
              <input
                type="checkbox"
                checked={!!selected}
                onChange={(e) => onSelect(e.target.checked)}
                className="accent-primary"
              />
              ZIP
            </label>
          )}
        </div>
        <div className="p-3 flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <p className="text-sm font-semibold text-foreground truncate">{name}</p>
          </div>
          {description && (
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{description}</p>
          )}
          <div className="flex items-center gap-2 mt-auto">
            {downloadUrl ? (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            ) : (
              <span className="text-[11px] italic text-muted-foreground">Pending</span>
            )}
            {viewerHref && (
              <a
                href={viewerHref}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Open <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }
);

// Re-export icon helper
export { ImageIcon };
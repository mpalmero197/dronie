import { forwardRef, useMemo } from "react";
import { Globe2, MapPin } from "lucide-react";
import { COMMON_CRS, suggestUtmEpsg, type CrsOption } from "@/lib/crs-picker";
import { VERTICAL_DATUMS, type VerticalDatum } from "@/lib/photogrammetry";

export interface CrsPickerProps {
  horizontal: string;
  vertical: VerticalDatum;
  onHorizontalChange: (epsg: string) => void;
  onVerticalChange: (datum: VerticalDatum) => void;
  /** Optional GPS centroid → enables UTM auto-suggest. */
  centroid?: { lat: number; lng: number } | null;
  disabled?: boolean;
}

/** Real surveyor CRS picker: separates horizontal CRS from vertical datum,
 *  auto-suggests the right UTM zone from the project centroid. */
export const CrsPicker = forwardRef<HTMLDivElement, CrsPickerProps>(
  function CrsPicker({ horizontal, vertical, onHorizontalChange, onVerticalChange, centroid, disabled }, ref) {
    const utmSuggestion = useMemo<CrsOption | null>(
      () => (centroid ? suggestUtmEpsg(centroid.lat, centroid.lng) : null),
      [centroid?.lat, centroid?.lng]
    );

    const all: CrsOption[] = useMemo(() => {
      const base = [...COMMON_CRS];
      if (utmSuggestion && !base.some((c) => c.code === utmSuggestion.code)) {
        base.unshift(utmSuggestion);
      }
      return base;
    }, [utmSuggestion]);

    return (
      <div ref={ref} className="space-y-4">
        {utmSuggestion && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onHorizontalChange(utmSuggestion.code)}
            className={`w-full flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
              horizontal === utmSuggestion.code
                ? "border-primary bg-primary/10"
                : "border-border bg-secondary/40 hover:border-primary/40"
            }`}
          >
            <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">Suggested for your data</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {utmSuggestion.label} · {utmSuggestion.code}
              </p>
            </div>
          </button>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Globe2 className="w-3 h-3" /> Horizontal CRS
          </label>
          <select
            disabled={disabled}
            value={horizontal}
            onChange={(e) => onHorizontalChange(e.target.value)}
            className="w-full h-10 rounded-lg bg-secondary/60 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {all.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label} ({c.code}, {c.units})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Vertical datum
          </label>
          <select
            disabled={disabled}
            value={vertical}
            onChange={(e) => onVerticalChange(e.target.value as VerticalDatum)}
            className="w-full h-10 rounded-lg bg-secondary/60 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {VERTICAL_DATUMS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground leading-snug">
            {VERTICAL_DATUMS.find((d) => d.id === vertical)?.desc}
          </p>
        </div>
      </div>
    );
  }
);

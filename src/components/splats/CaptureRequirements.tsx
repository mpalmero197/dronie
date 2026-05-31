import { useState } from "react";
import { ChevronDown, Compass, Plane, Satellite, ShieldAlert, Sun } from "lucide-react";
import { SPLAT_LIMITATIONS } from "@/lib/splat3dgs";
import { track } from "@/lib/analytics";

/**
 * Capture-side guidance shown above the splat studio. Teaches users *how*
 * to fly so the SfM stage gives the trainer something it can actually
 * converge on, and surfaces the 5 operational vulnerabilities of 3DGS
 * before they burn compute on a bad dataset.
 */
export default function CaptureRequirements() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.06] via-card to-accent/[0.04]">
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) track("splats_capture_doc_opened");
        }}
        className="w-full flex items-center gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <Plane className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-700 text-sm sm:text-base text-foreground">
            How to capture for 3D Gaussian Splatting
          </h2>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            Overlap, oblique passes and a static scene decide whether your splat is crisp or smeared.
          </p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-primary/15 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Tile
              icon={Compass}
              title="Flight pattern"
              body="Two altitudes: nadir grid (≥70% front / 60% side overlap) plus an oblique orbit at 35–45° around verticals."
            />
            <Tile
              icon={Satellite}
              title="SfM-grade pose"
              body="RTK or GCPs preferred. Bad poses cascade into spatial corruption — the trainer cannot fix what SfM gets wrong."
            />
            <Tile
              icon={Sun}
              title="Stable conditions"
              body="Static scene, even light, low wind. Avoid golden hour for long flights — moving shadows bake in as artifacts."
            />
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3 text-highlight" /> Operational limits to plan around
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SPLAT_LIMITATIONS.map((l) => (
                <span
                  key={l.key}
                  title={l.detail}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background border border-border text-[11px] text-foreground hover:border-highlight/40 transition-colors cursor-help"
                >
                  <span className="font-semibold">{l.label}</span>
                  <span className="text-muted-foreground">· {l.short}</span>
                </span>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            3DGS replaces meshes and neural fields with millions of explicit anisotropic particles — defined by mean position,
            a 3D covariance matrix, opacity and spherical harmonics for view-dependent color. Differentiable rasterization
            backpropagates loss against your source images, so the cleaner your capture, the sharper your splat.
          </p>
        </div>
      )}
    </section>
  );
}

function Tile({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Plane;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <h3 className="font-display font-600 text-xs">{title}</h3>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
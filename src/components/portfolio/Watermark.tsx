import type { PortfolioWatermark } from "@/lib/portfolioTheme";

/**
 * Discreet branding stamp pinned to a corner of the viewport on
 * the public portfolio. Pure CSS, fully accessible, ignored by
 * pointer events so it never blocks lightboxes or CTAs.
 */
export default function Watermark({ watermark }: { watermark?: PortfolioWatermark }) {
  if (!watermark || !watermark.enabled || !watermark.text.trim()) return null;
  const positionClass: Record<NonNullable<PortfolioWatermark["position"]>, string> = {
    "bottom-right": "bottom-3 right-3 sm:bottom-5 sm:right-5",
    "bottom-left":  "bottom-3 left-3 sm:bottom-5 sm:left-5",
    "top-right":    "top-16 right-3 sm:top-20 sm:right-5",
    "top-left":     "top-16 left-3 sm:top-20 sm:left-5",
  };
  return (
    <div
      aria-hidden
      className={`fixed z-40 pointer-events-none select-none ${positionClass[watermark.position]}`}
      style={{ opacity: watermark.opacity }}
    >
      <span
        className="px-2.5 py-1 rounded-md text-[10px] sm:text-xs tracking-wide font-medium bg-black/45 text-white backdrop-blur-sm shadow-lg uppercase"
        style={{ letterSpacing: "0.08em" }}
      >
        © {watermark.text}
      </span>
    </div>
  );
}
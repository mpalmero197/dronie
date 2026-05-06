import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ─────────────────────────────────────────────────────────────
 * 1. Top scroll progress bar
 * Subtle accent line glued to the very top of the page.
 * ─────────────────────────────────────────────────────────── */
export function ScrollProgressBar() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setPct(max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed top-0 inset-x-0 z-[60] h-[2px] bg-transparent pointer-events-none">
      <div
        className="h-full bg-primary origin-left transition-[width] duration-150 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 2. Marquee tape — auto-scrolling editorial ribbon
 * Used to surface services/locations as a kinetic typography band.
 * ─────────────────────────────────────────────────────────── */
export function MarqueeTape({
  items,
  variant = "default",
}: {
  items: string[];
  variant?: "default" | "inverted";
}) {
  if (!items?.length) return null;
  // Duplicate so the loop is seamless (animation slides -50%).
  const loop = [...items, ...items];
  const isInverted = variant === "inverted";
  return (
    <div
      className={`portfolio-marquee relative overflow-hidden border-y ${
        isInverted
          ? "bg-primary text-primary-foreground border-primary/40"
          : "bg-foreground text-background border-foreground/30"
      }`}
    >
      <div className="portfolio-marquee-track flex whitespace-nowrap py-3 sm:py-4 will-change-transform">
        {loop.map((it, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-6 px-6 text-sm sm:text-base font-medium tracking-[0.18em] uppercase"
            style={{ fontFamily: "var(--portfolio-display-font)" }}
          >
            <span aria-hidden className="opacity-60">✦</span>
            <span>{it}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 3. Frame counter / status HUD — cinematic overlay
 * Mounted in the cinematic hero. Shows 4-digit frame number
 * incrementing once per second + REC dot. Pure decoration that
 * signals "this person knows their craft."
 * ─────────────────────────────────────────────────────────── */
export function FilmHud({
  count,
  location,
}: {
  count?: number | null;
  location?: string | null;
}) {
  const [frame, setFrame] = useState(2418);
  useEffect(() => {
    const id = window.setInterval(() => setFrame((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      className="absolute top-4 left-4 sm:top-5 sm:left-5 z-10 flex items-center gap-3 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.18em] text-white/85 select-none"
      aria-hidden
    >
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm bg-black/40 backdrop-blur border border-white/15">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 portfolio-blink" />
        REC
      </span>
      <span className="hidden sm:inline-block px-2 py-1 rounded-sm bg-black/40 backdrop-blur border border-white/15 tabular-nums">
        F · {String(frame).padStart(4, "0")}
      </span>
      {typeof count === "number" && count > 0 && (
        <span className="px-2 py-1 rounded-sm bg-black/40 backdrop-blur border border-white/15 tabular-nums">
          {String(count).padStart(3, "0")} SHOTS
        </span>
      )}
      {location && (
        <span className="hidden md:inline-block px-2 py-1 rounded-sm bg-black/40 backdrop-blur border border-white/15 truncate max-w-[220px]">
          ⊕ {location}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 4. Magnetic Hire button — cursor-follow CTA
 * The button gently translates toward the cursor when within range.
 * Falls back to a static button on touch devices.
 * ─────────────────────────────────────────────────────────── */
export function MagneticHireButton({
  email,
  label,
  className,
}: {
  email: string;
  label: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    const btn = btnRef.current;
    if (!el || !btn) return;
    if (window.matchMedia("(hover: none)").matches) return;

    const RANGE = 90; // px around the button
    const STRENGTH = 0.32;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > RANGE) {
        btn.style.transform = "translate3d(0,0,0)";
        return;
      }
      const f = (1 - d / RANGE) * STRENGTH;
      btn.style.transform = `translate3d(${dx * f}px, ${dy * f}px, 0)`;
    };
    const onLeave = () => { btn.style.transform = "translate3d(0,0,0)"; };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div ref={wrapRef} className={`inline-block ${className ?? ""}`}>
      <a
        ref={btnRef}
        href={`mailto:${email}?subject=${encodeURIComponent(`Hiring inquiry — ${label}`)}`}
        className="inline-block transition-transform duration-200 ease-out will-change-transform"
      >
        <Button
          size="lg"
          className="gap-2 h-12 px-6 rounded-full shadow-2xl shadow-primary/30 text-base font-semibold"
        >
          <Send className="w-4 h-4" /> Hire {label}
        </Button>
      </a>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 5. Section dot navigation — vertical rail
 * Sticky right-side dots (à la Apple product pages).
 * Hidden on mobile. Smoothly scrolls to the targeted section.
 * ─────────────────────────────────────────────────────────── */
export function SectionDots({
  sections,
}: {
  sections: { id: string; label: string }[];
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  useEffect(() => {
    if (!sections.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [sections]);

  if (!sections.length) return null;

  return (
    <nav
      aria-label="Sections"
      className="hidden xl:flex fixed right-5 top-1/2 -translate-y-1/2 z-30 flex-col gap-3 group/dots"
    >
      {sections.map((s) => {
        const isActive = active === s.id;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex items-center gap-2 group"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <span
              className={`text-[10px] font-mono uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 group-hover/dots:opacity-80 transition-opacity ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            <span
              className={`block rounded-full transition-all duration-300 ${
                isActive
                  ? "w-2.5 h-2.5 bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.18)]"
                  : "w-1.5 h-1.5 bg-foreground/35 hover:bg-foreground/70"
              }`}
            />
          </a>
        );
      })}
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 6. Process strip — 3-step "How I work"
 * Numbered editorial cards. Static, but serves as silent social
 * proof of professionalism when a portfolio is light on copy.
 * ─────────────────────────────────────────────────────────── */
export function ProcessStrip() {
  const steps = useMemo(
    () => [
      { n: "01", title: "Brief & scout", body: "We talk goals, location, and weather windows. I deliver a flight plan with sample shot list." },
      { n: "02", title: "Capture day",   body: "On-site with redundant batteries, ND filters, and FAA-compliant ops. Everything logged." },
      { n: "03", title: "Edit & deliver", body: "RAW-grade color, motion, and sound. Final cuts in 4K + a vertical social variant." },
    ],
    [],
  );
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
      {steps.map((s) => (
        <div
          key={s.n}
          className="group relative rounded-2xl border border-border bg-card p-5 sm:p-6 overflow-hidden hover:border-primary/40 transition-colors"
        >
          <div
            className="absolute -top-2 right-3 text-[88px] sm:text-[110px] leading-none font-700 text-primary/8 select-none"
            style={{ fontFamily: "var(--portfolio-display-font)" }}
            aria-hidden
          >
            {s.n}
          </div>
          <div className="relative">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-primary mb-3">Step {s.n}</p>
            <h3
              className="font-700 text-xl sm:text-2xl leading-tight mb-2"
              style={{ fontFamily: "var(--portfolio-display-font)" }}
            >
              {s.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 7. Editorial section heading — bigger, with index number
 * Drop-in replacement that delivers more presence than the
 * existing SectionHeading in the page file. Used for new sections.
 * ─────────────────────────────────────────────────────────── */
export function EditorialHeading({
  index,
  eyebrow,
  title,
  subtitle,
}: {
  index: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="grid grid-cols-[auto_1fr] gap-4 sm:gap-6 items-end">
      <div
        className="text-3xl sm:text-5xl font-700 leading-none text-primary/70 tabular-nums"
        style={{ fontFamily: "var(--portfolio-display-font)" }}
        aria-hidden
      >
        {index}
      </div>
      <div className="border-b border-border pb-3">
        {eyebrow && (
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground mb-1.5">
            {eyebrow}
          </p>
        )}
        <h2
          className="font-700 text-3xl sm:text-5xl tracking-tight leading-[1.02]"
          style={{ fontFamily: "var(--portfolio-display-font)" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{subtitle}</p>
        )}
      </div>
    </header>
  );
}
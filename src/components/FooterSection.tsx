import { Map, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { track } from "@/lib/analytics";

type FooterLink = { label: string; href: string; external?: boolean };

const cols: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How It Works", href: "/#how-it-works" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Workflow", href: "/workflow" },
      { label: "AI Insights", href: "/insights" },
      { label: "Compliance & LAANC", href: "/compliance" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Construction", href: "/solutions/construction" },
      { label: "Real Estate", href: "/solutions/real_estate" },
      { label: "Agriculture", href: "/solutions/agriculture" },
      { label: "Energy & Utilities", href: "/solutions/energy" },
      { label: "Mining & Aggregates", href: "/solutions/mining" },
      { label: "Insurance", href: "/solutions/insurance" },
      { label: "Public Safety", href: "/solutions/government" },
    ],
  },
  {
    title: "For Pilots",
    links: [
      { label: "Find Pilots", href: "/pilots" },
      { label: "Become a Pilot", href: "/pilots/join" },
      { label: "Pilot Dashboard", href: "/pilots/dashboard" },
      { label: "Marketplace", href: "/marketplace" },
      { label: "Post a Job", href: "/marketplace/new" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Mission Planner", href: "/plan" },
      { label: "Saved Missions", href: "/missions" },
      { label: "Install Apps", href: "/install" },
      { label: "📖 Field Guides & Books", href: "/field-guides" },
    ],
  },
  {
    title: "Rules & Regulations",
    links: [
      { label: "FAA Part 107 (USA)", href: "https://www.faa.gov/uas/commercial_operators", external: true },
      { label: "FAA DroneZone", href: "https://faadronezone-access.faa.gov/", external: true },
      { label: "Remote ID (Part 89)", href: "https://www.faa.gov/uas/getting_started/remote_id", external: true },
      { label: "LAANC Authorization", href: "https://www.faa.gov/uas/getting_started/laanc", external: true },
      { label: "B4UFLY (FAA App)", href: "https://www.faa.gov/uas/getting_started/b4ufly", external: true },
      { label: "EASA Drones (EU)", href: "https://www.easa.europa.eu/en/domains/civil-drones", external: true },
      { label: "UK CAA Drone Code", href: "https://register-drones.caa.co.uk/drone-code", external: true },
      { label: "Transport Canada RPAS", href: "https://tc.canada.ca/en/aviation/drone-safety", external: true },
      { label: "CASA (Australia)", href: "https://www.casa.gov.au/drones", external: true },
      { label: "TFR Lookup", href: "https://tfr.faa.gov/tfr2/list.html", external: true },
      { label: "Aviation Weather", href: "https://www.aviationweather.gov/", external: true },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "For Business", href: "/orgs" },
      { label: "Sign In", href: "/auth" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

export default function FooterSection() {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Handle hash links robustly. If we're already on the target pathname,
   * <Link to="/#section"> is a no-op for React Router, so we manually scroll.
   * Otherwise, navigate — ScrollToTop will handle the smooth scroll on mount.
   */
  function handleInternalClick(href: string, e: React.MouseEvent) {
    const [path, hash] = href.split("#");
    const samePage = (path === "" ? "/" : path) === location.pathname;
    if (hash && samePage) {
      e.preventDefault();
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        // Reflect the section in the URL without triggering a route change.
        window.history.replaceState(null, "", `#${hash}`);
      }
    } else if (hash) {
      // Cross-page hash navigation — let React Router handle it; ScrollToTop scrolls.
      e.preventDefault();
      navigate(href);
    }
  }

  return (
    <footer className="bg-foreground text-primary-foreground/80" role="contentinfo">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Map className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display font-700 text-lg text-primary-foreground">Dronie</span>
            </div>
            <p className="text-sm text-primary-foreground/50 leading-relaxed">
              Professional drone photogrammetry processing in the cloud. Built for the field.
            </p>
          </div>

          {cols.map((col) => (
            <nav key={col.title} aria-label={`${col.title} links`}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/40 mb-4">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors"
                        onClick={() =>
                          track("landing_footer_cta_click", {
                            section: col.title,
                            label: l.label,
                            href: l.href,
                            external: true,
                          })
                        }
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        to={l.href}
                        className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors"
                        onClick={(e) => {
                          track("landing_footer_cta_click", {
                            section: col.title,
                            label: l.label,
                            href: l.href,
                            external: false,
                          });
                          handleInternalClick(l.href, e);
                        }}
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-t border-primary-foreground/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center gap-x-6 gap-y-2 text-center md:text-left">
            <p className="text-xs text-primary-foreground/40">
              © {new Date().getFullYear()} Dronie. All rights reserved.
            </p>
            <p className="text-xs text-primary-foreground/50">
              Dronie is a product of{" "}
              <a
                href="https://halcyonsystemsgroup.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary-foreground/80 hover:text-primary-foreground transition-colors"
              >
                Halcyon Systems Group
              </a>
              .
            </p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-xs text-primary-foreground/40 hidden md:block">
              Open-source standards · GeoTIFF · LAS · SHP
            </p>
            <a
              href="https://halcyonranker.lovable.app/site/dronieapp.com"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                track("landing_footer_cta_click", {
                  section: "Trust",
                  label: "Halcyon Ranker Verified",
                  href: "https://halcyonranker.lovable.app/site/dronieapp.com",
                  external: true,
                })
              }
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-background text-foreground border border-border rounded-[10px] text-xs font-semibold leading-none shadow-sm hover:shadow-md transition-shadow"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-primary" strokeWidth={2.4} />
              Verified by Halcyon Ranker · 81/100
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

import { Map } from "lucide-react";
import { Link } from "react-router-dom";

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
      { label: "Sample Gallery", href: "/gallery" },
      { label: "Mission Planner", href: "/plan" },
      { label: "Saved Missions", href: "/missions" },
      { label: "Install Apps", href: "/install" },
      { label: "📖 Field Guide on Amazon", href: "https://amzn.to/4cCG9m6", external: true },
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
      { label: "For Business", href: "/orgs" },
      { label: "Sign In", href: "/auth" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

export default function FooterSection() {
  return (
    <footer className="bg-foreground text-primary-foreground/80">
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

          {/* Link columns */}
          {cols.map((col) => (
            <div key={col.title}>
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
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        to={l.href}
                        className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-primary-foreground/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-primary-foreground/40">
            © {new Date().getFullYear()} Dronie. All rights reserved.
          </p>
          <p className="text-xs text-primary-foreground/40">
            Open-source standards · GeoTIFF · LAS · SHP
          </p>
        </div>
      </div>
    </footer>
  );
}

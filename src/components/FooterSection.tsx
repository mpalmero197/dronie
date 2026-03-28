import { Map } from "lucide-react";
import { Link } from "react-router-dom";

const cols = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "How It Works", href: "/#how-it-works" },
    ],
  },
  {
    title: "Use Cases",
    links: [
      { label: "Agriculture", href: "/#features" },
      { label: "Construction", href: "/#features" },
      { label: "Surveying", href: "/#features" },
      { label: "Real Estate", href: "/#features" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Sample Projects", href: "/gallery" },
      { label: "Map Viewer Demo", href: "/viewer/demo" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Privacy Policy", href: "/#" },
      { label: "Terms of Service", href: "/#" },
    ],
  },
];

export default function FooterSection() {
  return (
    <footer className="bg-foreground text-primary-foreground/80">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1 space-y-4">
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
                    <Link
                      to={l.href}
                      className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors"
                    >
                      {l.label}
                    </Link>
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

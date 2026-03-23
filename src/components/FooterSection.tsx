import { Map } from "lucide-react";
import { Link } from "react-router-dom";

const cols = [
  {
    title: "Product",
    links: ["Features", "Pricing", "Changelog", "Roadmap", "API Docs"],
  },
  {
    title: "Use Cases",
    links: ["Agriculture", "Construction", "Surveying", "Mining", "Real Estate"],
  },
  {
    title: "Resources",
    links: ["Documentation", "Sample Projects", "Blog", "Community", "Webinars"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Privacy Policy", "Terms of Service", "Contact"],
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
              <span className="font-display font-700 text-lg text-primary-foreground">MapForge</span>
            </div>
            <p className="text-sm text-primary-foreground/50 leading-relaxed">
              Professional drone photogrammetry processing in the cloud. Built for the field.
            </p>
            <div className="flex gap-3 pt-1">
              {["𝕏", "in", "▶"].map((s) => (
                <button
                  key={s}
                  className="w-8 h-8 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 text-sm font-bold transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/40 mb-4">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-primary-foreground/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-primary-foreground/40">
            © 2026 MapForge Inc. All rights reserved.
          </p>
          <p className="text-xs text-primary-foreground/40">
            Trusted by 47,000+ drone pilots in 94 countries.
          </p>
        </div>
      </div>
    </footer>
  );
}

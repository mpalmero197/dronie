import { Link } from "react-router-dom";
import { Map, ArrowLeft, Eye, MapPin, Mountain, Cpu, Sun, Building2, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

const DEMO_MAPS = [
  {
    id: "demo",
    title: "Farm Survey Block 4",
    location: "Rio Grande Valley, TX",
    area: "47.3 ha",
    images: 842,
    icon: Sun,
    thumb: "🌾",
    desc: "Agricultural land survey with multispectral imagery for crop health analysis and irrigation planning.",
  },
  {
    id: "demo",
    title: "Highway Construction Site",
    location: "I-35 Corridor, Austin TX",
    area: "12.8 ha",
    images: 1240,
    icon: Building2,
    thumb: "🏗️",
    desc: "Weekly progress monitoring of highway interchange construction with volumetric measurements.",
  },
  {
    id: "demo",
    title: "Solar Array Inspection",
    location: "Mojave Desert, CA",
    area: "85.6 ha",
    images: 2100,
    icon: Cpu,
    thumb: "☀️",
    desc: "Thermal + RGB inspection of 40MW solar installation for panel defect detection.",
  },
  {
    id: "demo",
    title: "Coastal Erosion Study",
    location: "Outer Banks, NC",
    area: "23.1 ha",
    images: 560,
    icon: Waves,
    thumb: "🌊",
    desc: "Multi-visit temporal analysis of shoreline erosion patterns with volumetric comparison.",
  },
  {
    id: "demo",
    title: "Mine Stockpile Survey",
    location: "Pilbara Region, WA",
    area: "34.2 ha",
    images: 1580,
    icon: Mountain,
    thumb: "⛏️",
    desc: "Monthly stockpile volume calculations and pit progression tracking for mining operations.",
  },
  {
    id: "demo",
    title: "Urban Mapping Project",
    location: "Downtown Denver, CO",
    area: "8.4 ha",
    images: 920,
    icon: MapPin,
    thumb: "🏙️",
    desc: "High-resolution 3D city model generation for urban planning and development analysis.",
  },
];

export default function Gallery() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 pt-28 pb-16">
        <div className="flex items-center gap-3 mb-2">
          <Link to="/">
            <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Map className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-700 text-foreground text-2xl">Sample Maps</h1>
            <p className="text-sm text-muted-foreground">Explore real-world drone mapping examples</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          {DEMO_MAPS.map((demo, i) => {
            const Icon = demo.icon;
            return (
              <div
                key={i}
                className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all group"
              >
                <div className="h-36 bg-gradient-to-br from-primary/10 via-secondary to-accent/10 flex items-center justify-center text-5xl">
                  {demo.thumb}
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-700 text-foreground text-sm">{demo.title}</h3>
                      <p className="text-xs text-muted-foreground">{demo.location}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{demo.desc}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{demo.area}</span>
                    <span>·</span>
                    <span>{demo.images.toLocaleString()} images</span>
                  </div>
                  <Link to={`/viewer/${demo.id}`}>
                    <Button size="sm" variant="outline" className="w-full gap-1.5 mt-1 group-hover:border-primary/30 group-hover:text-primary transition-colors">
                      <Eye className="w-3.5 h-3.5" /> View Map
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

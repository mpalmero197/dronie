import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Plane, ShieldCheck, Award, MapPin, Loader2, Briefcase } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { VERTICAL_LABELS, type IndustryVertical } from "@/lib/marketplace";

interface PublicPilot {
  pilot_id: string;
  display_name: string;
  bio: string | null;
  service_area_label: string | null;
  display_lat: number;
  display_lng: number;
  service_radius_km: number;
  verticals: IndustryVertical[];
  skills: string[];
  equipment: string[];
  hourly_rate_cents: number | null;
  years_experience: number;
  part_107: boolean;
  insured: boolean;
  portfolio_url: string | null;
  avatar_url: string | null;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function makePilotIcon(p: PublicPilot) {
  const size = 44;
  const initials = (p.display_name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const inner = p.avatar_url
    ? `<img src="${escapeHtml(p.avatar_url)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.parentElement.querySelector('.fallback').style.display='flex';" />
       <div class="fallback" style="display:none;width:100%;height:100%;align-items:center;justify-content:center;background:hsl(var(--primary));color:#fff;font-weight:700;font-size:13px;">${escapeHtml(initials)}</div>`
    : `<div style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:hsl(var(--primary));color:#fff;font-weight:700;font-size:13px;">${escapeHtml(initials)}</div>`;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);background:#fff;">${inner}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function PilotsMap() {
  const [pilots, setPilots] = useState<PublicPilot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vertical, setVertical] = useState<IndustryVertical | "all">("all");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_public_pilots");
      if (error) console.error(error);
      setPilots((data ?? []) as unknown as PublicPilot[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return pilots.filter((p) => {
      if (vertical !== "all" && !p.verticals.includes(vertical)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.display_name.toLowerCase().includes(q) ||
          (p.service_area_label ?? "").toLowerCase().includes(q) ||
          p.skills.some((s) => s.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [pilots, search, vertical]);

  const center: [number, number] = pilots[0]
    ? [pilots[0].display_lat, pilots[0].display_lng]
    : [39.5, -98.35]; // US center fallback

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20">
        <header className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-700 text-foreground">Find a drone pilot</h1>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                Browse Dronie pilots near you. Pin locations are intentionally shifted by a few miles for privacy — contact a
                pilot to coordinate the exact site.
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/marketplace/new">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                  <Briefcase className="w-4 h-4" /> Post a job
                </Button>
              </Link>
              <Link to="/pilots/join">
                <Button variant="outline" className="gap-2">
                  <Plane className="w-4 h-4" /> Become a pilot
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Search by name, city, or skill…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value as any)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All industries</option>
              {Object.entries(VERTICAL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground self-center">
              {filtered.length} pilot{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
        </header>

        <div className="container mx-auto px-6 pb-10 grid lg:grid-cols-[1fr_360px] gap-4">
          <div className="rounded-2xl overflow-hidden border border-border h-[600px] bg-card">
            {loading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading pilots…
              </div>
            ) : (
              <MapContainer center={center} zoom={5} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filtered.map((p) => (
                  <div key={p.pilot_id}>
                    <Circle
                      center={[p.display_lat, p.display_lng]}
                      radius={p.service_radius_km * 1000}
                      pathOptions={{ color: "hsl(var(--primary))", fillOpacity: 0.05, weight: 1 }}
                    />
                    <Marker position={[p.display_lat, p.display_lng]} icon={makePilotIcon(p)}>
                      <Popup>
                        <PilotPopup p={p} />
                      </Popup>
                    </Marker>
                  </div>
                ))}
              </MapContainer>
            )}
          </div>

          <aside className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {filtered.length === 0 && !loading && (
              <div className="text-sm text-muted-foreground p-4 rounded-xl border border-dashed border-border">
                No pilots match your filters yet.
              </div>
            )}
            {filtered.map((p) => (
              <PilotCard key={p.pilot_id} p={p} />
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}

function PilotPopup({ p }: { p: PublicPilot }) {
  return (
    <div className="min-w-[200px]">
      <div className="flex items-center gap-2">
        <Avatar src={p.avatar_url} name={p.display_name} size={36} />
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{p.display_name}</p>
          <p className="text-xs text-muted-foreground truncate">{p.service_area_label ?? "—"}</p>
        </div>
      </div>
      <div className="flex gap-1 mt-2 flex-wrap">
        {p.part_107 && <Badge variant="outline" className="text-[10px] gap-1"><ShieldCheck className="w-3 h-3" /> Part 107</Badge>}
        {p.insured && <Badge variant="outline" className="text-[10px] gap-1"><Award className="w-3 h-3" /> Insured</Badge>}
      </div>
      {p.hourly_rate_cents != null && (
        <p className="text-xs mt-2">
          From <span className="font-semibold">${(p.hourly_rate_cents / 100).toFixed(0)}/hr</span>
        </p>
      )}
      <Link to={`/marketplace/new`} className="block mt-2 text-xs text-primary font-semibold">
        Hire this pilot →
      </Link>
    </div>
  );
}

function PilotCard({ p }: { p: PublicPilot }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <Avatar src={p.avatar_url} name={p.display_name} size={40} />
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{p.display_name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" /> {p.service_area_label ?? "—"} · {p.service_radius_km} km
            </p>
          </div>
        </div>
        {p.hourly_rate_cents != null && (
          <span className="text-xs font-semibold text-foreground whitespace-nowrap">${(p.hourly_rate_cents / 100).toFixed(0)}/hr</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {p.part_107 && <Badge variant="outline" className="text-[10px]">Part 107</Badge>}
        {p.insured && <Badge variant="outline" className="text-[10px]">Insured</Badge>}
        {p.years_experience > 0 && <Badge variant="outline" className="text-[10px]">{p.years_experience}y exp</Badge>}
      </div>
      {p.verticals.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">
          {p.verticals.slice(0, 3).map((v) => VERTICAL_LABELS[v]).join(" · ")}
        </p>
      )}
    </div>
  );
}

function Avatar({ src, name, size }: { src: string | null; name: string; size: number }) {
  const initials = (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="rounded-full overflow-hidden bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Map, ArrowLeft, Eye, MapPin, Loader2, ImageOff, Upload,
  Search, SlidersHorizontal, Layers, Camera, Sparkles, Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";

interface ShowcaseProject {
  id: string;
  name: string;
  description: string | null;
  image_count: number;
  area_ha: number | null;
  created_at: string;
  outputs_urls: Record<string, string> | null;
  outputs: string[] | null;
}

interface EnrichedProject extends ShowcaseProject {
  thumbnail: string | null;
  vertical: string | null;
}

const VERTICAL_LABEL: Record<string, string> = {
  construction: "Construction",
  real_estate: "Real Estate",
  agriculture: "Agriculture",
  energy: "Energy",
  mining: "Mining",
  insurance: "Insurance",
  government: "Government",
  other: "Other",
};

type SortKey = "newest" | "largest_area" | "most_images";

function pickThumbnail(p: ShowcaseProject): string | null {
  const u = p.outputs_urls || {};
  // Prefer visual outputs in this priority order
  const keys = ["orthomosaic", "ortho", "preview", "thumbnail", "dsm_visual", "dsm"];
  for (const k of keys) {
    const v = u[k];
    if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
  }
  // First http(s) url found in the map
  for (const v of Object.values(u)) {
    if (typeof v === "string" && /^https?:\/\//.test(v) && /\.(jpe?g|png|webp|tif|tiff)(\?|$)/i.test(v)) {
      return v;
    }
  }
  return null;
}

function inferVertical(p: ShowcaseProject): string | null {
  const hay = `${p.name ?? ""} ${p.description ?? ""}`.toLowerCase();
  if (/farm|crop|field|agri|vine/.test(hay)) return "agriculture";
  if (/build|construct|site|tower crane|excavat/.test(hay)) return "construction";
  if (/solar|wind|turbine|grid|power|panel/.test(hay)) return "energy";
  if (/mine|quarry|stockpile|aggregate|haul/.test(hay)) return "mining";
  if (/roof|insur|claim|damage|hail|storm/.test(hay)) return "insurance";
  if (/listing|property|estate|home|apartment|house/.test(hay)) return "real_estate";
  if (/city|county|gov|public|park|infrastructure/.test(hay)) return "government";
  return null;
}

export default function Gallery() {
  const [projects, setProjects] = useState<EnrichedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const initialVertical = searchParams.get("vertical") || "all";
  const [vertical, setVerticalState] = useState<string>(initialVertical);
  const [sort, setSort] = useState<SortKey>("newest");

  // Keep ?vertical=… in the URL in sync with the dropdown so the page is
  // deep-linkable from the footer's Solutions column.
  const setVertical = (next: string) => {
    setVerticalState(next);
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("vertical");
    else params.set("vertical", next);
    setSearchParams(params, { replace: true });
  };

  // Sync state when the URL changes (e.g., user clicks another footer link
  // while already on /gallery).
  useEffect(() => {
    const v = searchParams.get("vertical") || "all";
    setVerticalState(v);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminIds = (admins ?? []).map((a) => a.user_id);
      if (adminIds.length === 0) {
        if (!cancelled) { setProjects([]); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from("projects")
        .select("id, name, description, image_count, area_ha, created_at, outputs_urls, outputs")
        .eq("status", "complete")
        .in("user_id", adminIds)
        .order("created_at", { ascending: false })
        .limit(60);

      const enriched: EnrichedProject[] = (data ?? []).map((p: any) => ({
        ...p,
        outputs_urls: (p.outputs_urls as Record<string, string>) ?? null,
        thumbnail: pickThumbnail(p as ShowcaseProject),
        vertical: inferVertical(p as ShowcaseProject),
      }));
      if (!cancelled) {
        setProjects(enriched);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const verticalsAvailable = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => p.vertical && set.add(p.vertical));
    return Array.from(set);
  }, [projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.filter((p) => {
      if (vertical !== "all" && p.vertical !== vertical) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false)
      );
    });
    list = [...list].sort((a, b) => {
      if (sort === "largest_area") return (Number(b.area_ha) || 0) - (Number(a.area_ha) || 0);
      if (sort === "most_images") return (b.image_count || 0) - (a.image_count || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [projects, query, vertical, sort]);

  const stats = useMemo(() => {
    const totalHa = projects.reduce((s, p) => s + (Number(p.area_ha) || 0), 0);
    const totalImages = projects.reduce((s, p) => s + (p.image_count || 0), 0);
    return { count: projects.length, totalHa, totalImages };
  }, [projects]);

  const hero = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-16">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/">
            <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            <Map className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-700 text-foreground text-xl sm:text-2xl truncate">Sample Maps</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Curated drone mapping projects from the Dronie team
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32 text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading sample maps…
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-secondary mx-auto flex items-center justify-center mb-4">
              <ImageOff className="w-5 h-5 text-muted-foreground" />
            </div>
            <h2 className="font-display font-700 text-lg">No sample maps yet</h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
              Curated examples will appear here as we publish them. In the meantime,
              you can upload your own imagery and process a real survey in minutes.
            </p>
            <div className="flex gap-2 justify-center mt-5">
              <Link to="/auth">
                <Button size="sm" className="gap-2"><Upload className="w-4 h-4" /> Get started free</Button>
              </Link>
              <Link to="/dashboard">
                <Button size="sm" variant="outline">Open dashboard</Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
              <StatCard icon={<Layers className="w-4 h-4 text-primary" />} label="Sample maps" value={stats.count.toLocaleString()} />
              <StatCard icon={<MapPin className="w-4 h-4 text-primary" />} label="Hectares mapped" value={stats.totalHa >= 100 ? Math.round(stats.totalHa).toLocaleString() : stats.totalHa.toFixed(1)} />
              <StatCard icon={<Camera className="w-4 h-4 text-primary" />} label="Source images" value={stats.totalImages.toLocaleString()} />
            </div>

            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search sample maps…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={vertical} onValueChange={setVertical}>
                  <SelectTrigger className="h-9 w-full sm:w-[160px]">
                    <SelectValue placeholder="Industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All industries</SelectItem>
                    {verticalsAvailable.map((v) => (
                      <SelectItem key={v} value={v}>{VERTICAL_LABEL[v] ?? v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  <SelectTrigger className="h-9 w-full sm:w-[160px]">
                    <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="largest_area">Largest area</SelectItem>
                    <SelectItem value="most_images">Most images</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
                <p className="text-sm text-muted-foreground">No maps match your filters.</p>
                <Button size="sm" variant="ghost" className="mt-3" onClick={() => { setQuery(""); setVertical("all"); }}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <>
                {/* Hero featured card */}
                {hero && (
                  <Link to={`/viewer/${hero.id}`} className="block mb-6 group">
                    <div className="relative rounded-2xl overflow-hidden border border-border bg-card hover:border-primary/40 hover:shadow-xl transition-all">
                      <div className="grid grid-cols-1 md:grid-cols-5">
                        <div className="md:col-span-3 aspect-video md:aspect-auto md:min-h-[260px] relative bg-gradient-to-br from-primary/15 via-secondary to-accent/10">
                          <Thumb url={hero.thumbnail} large />
                          <div className="absolute top-3 left-3 flex items-center gap-1.5">
                            <Badge className="bg-primary text-primary-foreground gap-1 border-0">
                              <Sparkles className="w-3 h-3" /> Featured
                            </Badge>
                            {hero.vertical && (
                              <Badge variant="secondary" className="bg-background/90 backdrop-blur">{VERTICAL_LABEL[hero.vertical]}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="md:col-span-2 p-5 sm:p-6 flex flex-col justify-between">
                          <div>
                            <h2 className="font-display font-700 text-foreground text-lg sm:text-xl group-hover:text-primary transition-colors">
                              {hero.name}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(hero.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                            </p>
                            {hero.description && (
                              <p className="text-sm text-muted-foreground leading-relaxed mt-3 line-clamp-4">{hero.description}</p>
                            )}
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {hero.area_ha != null && (
                              <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {Number(hero.area_ha).toFixed(1)} ha</span>
                            )}
                            <span className="inline-flex items-center gap-1"><ImageIcon className="w-3 h-3" /> {hero.image_count.toLocaleString()} images</span>
                          </div>
                          <Button size="sm" className="gap-1.5 mt-4 w-fit">
                            <Eye className="w-3.5 h-3.5" /> View Map
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

                {/* Grid */}
                {rest.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {rest.map((p) => (
                      <Link
                        key={p.id}
                        to={`/viewer/${p.id}`}
                        className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all group"
                      >
                        <div className="relative h-40 bg-gradient-to-br from-primary/10 via-secondary to-accent/10">
                          <Thumb url={p.thumbnail} />
                          {p.vertical && (
                            <Badge variant="secondary" className="absolute top-2 left-2 bg-background/90 backdrop-blur text-[10px]">
                              {VERTICAL_LABEL[p.vertical]}
                            </Badge>
                          )}
                        </div>
                        <div className="p-4 space-y-2.5">
                          <div className="min-w-0">
                            <h3 className="font-display font-700 text-foreground text-sm truncate group-hover:text-primary transition-colors">{p.name}</h3>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(p.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {p.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{p.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                            {p.area_ha != null && <span>{Number(p.area_ha).toFixed(1)} ha</span>}
                            {p.area_ha != null && <span>·</span>}
                            <span>{p.image_count.toLocaleString()} images</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-4 min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
        {icon}<span className="truncate">{label}</span>
      </div>
      <div className="font-display font-700 text-foreground text-lg sm:text-2xl mt-1 truncate">{value}</div>
    </div>
  );
}

function Thumb({ url, large = false }: { url: string | null; large?: boolean }) {
  const [errored, setErrored] = useState(false);
  if (!url || errored) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Map className={`${large ? "w-16 h-16" : "w-10 h-10"} text-primary/40`} />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setErrored(true)}
      className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
    />
  );
}

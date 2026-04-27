import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Map, ArrowLeft, Eye, MapPin, Loader2, ImageOff, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";

interface ShowcaseProject {
  id: string;
  name: string;
  description: string | null;
  image_count: number;
  area_ha: number | null;
  created_at: string;
}

export default function Gallery() {
  const [projects, setProjects] = useState<ShowcaseProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Showcase = completed projects owned by an admin (curated examples).
      // Falls back to an empty state when there is nothing to show yet —
      // we never fabricate cards.
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
        .select("id, name, description, image_count, area_ha, created_at")
        .eq("status", "complete")
        .in("user_id", adminIds)
        .order("created_at", { ascending: false })
        .limit(24);
      if (!cancelled) {
        setProjects((data ?? []) as ShowcaseProject[]);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 pt-28 pb-16">
        <div className="flex items-center gap-3 mb-2">
          <Link to="/">
            <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Map className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-700 text-foreground text-2xl">Sample Maps</h1>
            <p className="text-sm text-muted-foreground">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
            {projects.map((p) => (
              <div
                key={p.id}
                className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all group"
              >
                <div className="h-36 bg-gradient-to-br from-primary/10 via-secondary to-accent/10 flex items-center justify-center">
                  <Map className="w-10 h-10 text-primary/50" />
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-700 text-foreground text-sm truncate">{p.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{p.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {p.area_ha != null && <><span>{Number(p.area_ha).toFixed(1)} ha</span><span>·</span></>}
                    <span>{p.image_count.toLocaleString()} images</span>
                  </div>
                  <Link to={`/viewer/${p.id}`}>
                    <Button size="sm" variant="outline" className="w-full gap-1.5 mt-1 group-hover:border-primary/30 group-hover:text-primary transition-colors">
                      <Eye className="w-3.5 h-3.5" /> View Map
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
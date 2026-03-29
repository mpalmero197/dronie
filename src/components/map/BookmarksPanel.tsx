import { useEffect, useState, useCallback } from "react";
import { useMap } from "react-leaflet";
import { Bookmark, Plus, Trash2, Navigation, Pencil, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MapBookmark {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  zoom: number;
  color: string;
  created_at: string;
}

interface BookmarksPanelProps {
  projectId?: string;
  open: boolean;
  onClose: () => void;
}

export default function BookmarksPanel({ projectId, open, onClose }: BookmarksPanelProps) {
  const map = useMap();
  const { toast } = useToast();
  const [bookmarks, setBookmarks] = useState<MapBookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fetchBookmarks = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from("map_bookmarks")
      .select("*")
      .order("created_at", { ascending: false });

    if (projectId && projectId !== "demo") {
      query.eq("project_id", projectId);
    }

    const { data, error } = await query;
    if (!error && data) setBookmarks(data as MapBookmark[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (open) fetchBookmarks();
  }, [open, fetchBookmarks]);

  const saveBookmark = async () => {
    if (!newName.trim()) return;
    const center = map.getCenter();
    const zoom = map.getZoom();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Sign in required", description: "You need to be logged in to save bookmarks.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("map_bookmarks").insert({
      user_id: user.id,
      project_id: projectId || null,
      name: newName.trim(),
      latitude: center.lat,
      longitude: center.lng,
      zoom: Math.round(zoom),
    });

    if (error) {
      toast({ title: "Failed to save", variant: "destructive" });
    } else {
      toast({ title: "Bookmark saved!" });
      setNewName("");
      setAdding(false);
      fetchBookmarks();
    }
  };

  const deleteBookmark = async (id: string) => {
    await supabase.from("map_bookmarks").delete().eq("id", id);
    setBookmarks(prev => prev.filter(b => b.id !== id));
    toast({ title: "Bookmark deleted" });
  };

  const renameBookmark = async (id: string) => {
    if (!editName.trim()) return;
    await supabase.from("map_bookmarks").update({ name: editName.trim() }).eq("id", id);
    setBookmarks(prev => prev.map(b => b.id === id ? { ...b, name: editName.trim() } : b));
    setEditingId(null);
    setEditName("");
  };

  const flyTo = (bm: MapBookmark) => {
    map.flyTo([bm.latitude, bm.longitude], bm.zoom, { duration: 1.2 });
  };

  if (!open) return null;

  return (
    <div className="absolute top-3 right-3 z-[950] w-72 bg-card/95 backdrop-blur rounded-xl border border-border shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Bookmarks</span>
          <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{bookmarks.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAdding(true)}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <p className="text-[11px] text-muted-foreground mb-1.5">Save current view as bookmark</p>
          <div className="flex gap-1.5">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Bookmark name…"
              className="h-7 text-xs"
              autoFocus
              onKeyDown={e => e.key === "Enter" && saveBookmark()}
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={saveBookmark}>Save</Button>
            <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => { setAdding(false); setNewName(""); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="max-h-64 overflow-y-auto scrollbar-none">
        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">Loading…</div>
        ) : bookmarks.length === 0 ? (
          <div className="py-6 text-center">
            <Star className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No bookmarks yet</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">Navigate to a location and click + to save</p>
          </div>
        ) : (
          bookmarks.map(bm => (
            <div
              key={bm.id}
              className="group flex items-center gap-2 px-3 py-2 hover:bg-secondary/50 transition-colors cursor-pointer border-b border-border/50 last:border-0"
              onClick={() => flyTo(bm)}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: bm.color || "hsl(var(--primary))" }} />
              <div className="flex-1 min-w-0">
                {editingId === bm.id ? (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="h-6 text-xs"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === "Enter") renameBookmark(bm.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-medium text-foreground truncate">{bm.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {bm.latitude.toFixed(4)}, {bm.longitude.toFixed(4)} · z{bm.zoom}
                    </p>
                  </>
                )}
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <button
                  className="p-1 rounded hover:bg-muted"
                  onClick={() => { setEditingId(bm.id); setEditName(bm.name); }}
                >
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </button>
                <button className="p-1 rounded hover:bg-destructive/10" onClick={() => deleteBookmark(bm.id)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
                <button className="p-1 rounded hover:bg-muted" onClick={() => flyTo(bm)}>
                  <Navigation className="w-3 h-3 text-primary" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Shortcut hint */}
      <div className="px-3 py-1.5 border-t border-border bg-muted/20">
        <p className="text-[10px] text-muted-foreground text-center">
          Press <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">B</kbd> to toggle bookmarks
        </p>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Camera, Save, Upload, Loader2, Plus, Trash2, Pencil, Eye,
  Globe, Lock, Link as LinkIcon, Check, X, ImageIcon, Film, Sparkles,
  ExternalLink, Copy, Image as ImageLucide, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  PORTFOLIO_BUCKET, validateUsername, slugify,
  type PortfolioAlbum, type PortfolioItem, type PortfolioVisibility,
} from "@/lib/portfolio";
import { captureVideoFrame } from "@/lib/videoFrame";

interface ProjectOpt { id: string; name: string; }

export default function PortfolioStudio() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<any | null>(null);
  const [albums, setAlbums] = useState<PortfolioAlbum[]>([]);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Album dialog state
  const [albumDialog, setAlbumDialog] = useState<{ open: boolean; album?: PortfolioAlbum }>({ open: false });
  // Video poster picker
  const [posterFor, setPosterFor] = useState<PortfolioItem | null>(null);

  // Filter
  const [filterAlbumId, setFilterAlbumId] = useState<string>("all");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    refresh();
  }, [user, authLoading]);

  async function refresh() {
    if (!user) return;
    setLoading(true);
    const [{ data: p }, { data: a }, { data: i }, { data: pr }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("portfolio_albums").select("*").eq("user_id", user.id).order("sort_order").order("created_at", { ascending: false }),
      supabase.from("portfolio_items").select("*").eq("user_id", user.id).order("sort_order").order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setProfile(p);
    setAlbums((a ?? []) as PortfolioAlbum[]);
    setItems((i ?? []) as PortfolioItem[]);
    setProjects((pr ?? []) as ProjectOpt[]);
    setLoading(false);
  }

  async function saveProfile() {
    if (!user || !profile) return;
    const usernameTrim = (profile.username ?? "").trim();
    if (usernameTrim) {
      const err = validateUsername(usernameTrim);
      if (err) { toast({ title: "Invalid username", description: err, variant: "destructive" }); return; }
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        username: usernameTrim || null,
        full_name: profile.full_name ?? null,
        headline: profile.headline ?? null,
        bio: profile.bio ?? null,
        location: profile.location ?? null,
        website: profile.website ?? null,
        instagram: profile.instagram ?? null,
        portfolio_published: !!profile.portfolio_published,
      })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) {
      toast({ title: "Save failed", description: error.message.includes("unique") ? "That username is taken" : error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved", description: "Portfolio profile updated" });
  }

  async function uploadBlobToBucket(blob: Blob, suffix: string, contentType: string) {
    if (!user) throw new Error("Not signed in");
    const path = `${user.id}/${Date.now()}-${suffix}`;
    const { error } = await supabase.storage
      .from(PORTFOLIO_BUCKET)
      .upload(path, blob, { contentType, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  async function handleUpload(files: FileList | null) {
    if (!files || !user) return;
    setUploading(true);
    const uploaded: PortfolioItem[] = [];
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) continue;
      if (file.size > 200 * 1024 * 1024) {
        toast({ title: `${file.name} is too large`, description: "Max 200 MB per file", variant: "destructive" });
        continue;
      }
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from(PORTFOLIO_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) { toast({ title: "Upload failed", description: upErr.message, variant: "destructive" }); continue; }
      const { data: pub } = supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(path);

      // For videos, try to capture a poster frame and upload it as the thumb.
      let thumbUrl: string | null = isImage ? pub.publicUrl : null;
      if (isVideo) {
        try {
          const frame = await captureVideoFrame(file);
          const safeName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
          const { url } = await uploadBlobToBucket(frame.blob, `${safeName}-poster.jpg`, "image/jpeg");
          thumbUrl = url;
        } catch (e) {
          // Non-fatal: the public page will still play the video without a poster.
          console.warn("Could not generate video poster:", e);
        }
      }

      const insertRow = {
        user_id: user.id,
        kind: isVideo ? "video" : "photo",
        storage_path: path,
        media_url: pub.publicUrl,
        thumb_url: thumbUrl,
        title: file.name.replace(/\.[^.]+$/, ""),
        visibility: "public" as PortfolioVisibility,
        album_id: filterAlbumId !== "all" ? filterAlbumId : null,
      };
      const { data: ins, error: insErr } = await supabase
        .from("portfolio_items").insert(insertRow).select().single();
      if (insErr) { toast({ title: "DB insert failed", description: insErr.message, variant: "destructive" }); continue; }
      uploaded.push(ins as PortfolioItem);
    }
    setItems((prev) => [...uploaded, ...prev]);
    setUploading(false);
    if (uploaded.length) toast({ title: `Uploaded ${uploaded.length} file(s)` });
  }

  async function updateItem(id: string, patch: Partial<PortfolioItem>) {
    const { error } = await supabase.from("portfolio_items").update(patch).eq("id", id);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, ...patch } as PortfolioItem : it));
  }

  async function setVideoPoster(item: PortfolioItem, blob: Blob) {
    try {
      const { url } = await uploadBlobToBucket(blob, `poster-${item.id}.jpg`, "image/jpeg");
      await updateItem(item.id, { thumb_url: url });
      toast({ title: "Poster updated" });
    } catch (e: any) {
      toast({ title: "Couldn't save poster", description: e?.message ?? String(e), variant: "destructive" });
    }
  }

  async function deleteItem(item: PortfolioItem) {
    if (!confirm(`Delete "${item.title || "this item"}"?`)) return;
    if (item.storage_path) {
      await supabase.storage.from(PORTFOLIO_BUCKET).remove([item.storage_path]);
    }
    const { error } = await supabase.from("portfolio_items").delete().eq("id", item.id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    setItems((prev) => prev.filter((it) => it.id !== item.id));
  }

  async function saveAlbum(draft: Partial<PortfolioAlbum>) {
    if (!user) return;
    const title = (draft.title ?? "").trim();
    if (!title) { toast({ title: "Title required", variant: "destructive" }); return; }
    const slug = (draft.slug && draft.slug.trim()) ? slugify(draft.slug) : slugify(title);
    if (!slug) { toast({ title: "Couldn't make a URL slug", variant: "destructive" }); return; }
    const payload = {
      user_id: user.id,
      title,
      slug,
      description: draft.description ?? null,
      visibility: (draft.visibility ?? "public") as PortfolioVisibility,
      cover_url: draft.cover_url ?? null,
    };
    if (draft.id) {
      const { error } = await supabase.from("portfolio_albums").update(payload).eq("id", draft.id);
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("portfolio_albums").insert(payload);
      if (error) {
        const msg = error.message.includes("unique") ? "An album with this slug already exists" : error.message;
        toast({ title: "Save failed", description: msg, variant: "destructive" });
        return;
      }
    }
    setAlbumDialog({ open: false });
    toast({ title: "Album saved" });
    refresh();
  }

  async function deleteAlbum(a: PortfolioAlbum) {
    if (!confirm(`Delete album "${a.title}"? Items inside will become uncategorized.`)) return;
    const { error } = await supabase.from("portfolio_albums").delete().eq("id", a.id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    refresh();
  }

  async function addProjectLink(projectId: string) {
    if (!user) return;
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    const { data, error } = await supabase
      .from("portfolio_items")
      .insert({
        user_id: user.id,
        kind: "project_link",
        project_id: projectId,
        title: proj.name,
        visibility: "public",
        album_id: filterAlbumId !== "all" ? filterAlbumId : null,
      })
      .select().single();
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setItems((prev) => [data as PortfolioItem, ...prev]);
    toast({ title: "Project featured" });
  }

  const visibleItems = useMemo(() => {
    if (filterAlbumId === "all") return items;
    if (filterAlbumId === "none") return items.filter((i) => !i.album_id);
    return items.filter((i) => i.album_id === filterAlbumId);
  }, [items, filterAlbumId]);

  // Public portfolios always live on the canonical custom domain, regardless
  // of whether the studio is opened from the preview URL or *.lovable.app.
  const PORTFOLIO_HOST = "dronieapp.com";
  const PORTFOLIO_ORIGIN = `https://${PORTFOLIO_HOST}`;
  const portfolioUrl = profile?.username ? `${PORTFOLIO_ORIGIN}/u/${profile.username}` : null;

  if (authLoading || loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Camera className="w-5 h-5 text-primary" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-display font-700 truncate">Portfolio Studio</h1>
              <p className="text-xs text-muted-foreground truncate">Curate your public drone portfolio</p>
            </div>
          </div>
          {portfolioUrl && profile.portfolio_published && (
            <a href={portfolioUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Eye className="w-4 h-4" /> View public
              </Button>
            </a>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-6">
        {/* Profile */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display font-700 text-lg">Public profile</h2>
            <div className="flex items-center gap-2">
              <Label htmlFor="pub" className="text-xs text-muted-foreground">Published</Label>
              <Switch id="pub" checked={!!profile.portfolio_published} onCheckedChange={(v) => setProfile((p: any) => ({ ...p, portfolio_published: v }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Username (your URL)</Label>
              <div className="flex items-center mt-1 rounded-md border border-input overflow-hidden">
                <span className="px-2 text-xs text-muted-foreground bg-secondary py-2 border-r border-input">{PORTFOLIO_HOST}/u/</span>
                <Input
                  value={profile.username ?? ""}
                  onChange={(e) => setProfile((p: any) => ({ ...p, username: e.target.value }))}
                  placeholder="your-handle"
                  className="border-0 focus-visible:ring-0"
                />
              </div>
              {profile.username && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {validateUsername(profile.username) ?? `Available at ${PORTFOLIO_ORIGIN}/u/${profile.username}`}
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Display name</Label>
              <Input className="mt-1" value={profile.full_name ?? ""} onChange={(e) => setProfile((p: any) => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Headline</Label>
              <Input className="mt-1" placeholder="FAA Part 107 · Real estate · Construction · Atlanta GA" value={profile.headline ?? ""} onChange={(e) => setProfile((p: any) => ({ ...p, headline: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Bio</Label>
              <Textarea className="mt-1 min-h-[90px]" placeholder="Tell prospects what you shoot, your gear, and what makes your work different." value={profile.bio ?? ""} onChange={(e) => setProfile((p: any) => ({ ...p, bio: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Location</Label>
              <Input className="mt-1" placeholder="Atlanta, GA" value={profile.location ?? ""} onChange={(e) => setProfile((p: any) => ({ ...p, location: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Website</Label>
              <Input className="mt-1" placeholder="https://" value={profile.website ?? ""} onChange={(e) => setProfile((p: any) => ({ ...p, website: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Instagram handle</Label>
              <Input className="mt-1" placeholder="dronepilot" value={profile.instagram ?? ""} onChange={(e) => setProfile((p: any) => ({ ...p, instagram: e.target.value }))} />
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-muted-foreground">
              {profile.portfolio_published
                ? <span className="inline-flex items-center gap-1"><Globe className="w-3 h-3 text-primary" /> Visible to anyone with the link</span>
                : <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Hidden — flip the switch when ready</span>}
            </div>
            <div className="flex gap-2">
              {portfolioUrl && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { navigator.clipboard.writeText(portfolioUrl); toast({ title: "Link copied" }); }}>
                  <Copy className="w-3.5 h-3.5" /> Copy URL
                </Button>
              )}
              <Button onClick={saveProfile} disabled={savingProfile} size="sm" className="gap-1.5">
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save profile
              </Button>
            </div>
          </div>
        </section>

        {/* Albums */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display font-700 text-lg">Albums</h2>
            <Button size="sm" className="gap-1.5" onClick={() => setAlbumDialog({ open: true })}>
              <Plus className="w-4 h-4" /> New album
            </Button>
          </div>
          {albums.length === 0 ? (
            <p className="text-sm text-muted-foreground">No albums yet. Group your work into themed collections like “Real estate” or “Wedding aerials”.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {albums.map((a) => {
                const cover = a.cover_url || autoCoverForAlbum(a.id, items);
                return (
                  <div key={a.id} className="rounded-xl border border-border overflow-hidden bg-card flex">
                    <div className="w-24 h-24 bg-secondary flex-shrink-0 relative">
                      {cover ? (
                        <img src={cover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}
                      {!a.cover_url && cover && (
                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] py-0.5 text-center">auto</span>
                      )}
                    </div>
                    <div className="flex-1 p-3 flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-display font-700 text-sm truncate">{a.title}</p>
                          <VisibilityBadge v={a.visibility} />
                        </div>
                        <p className="text-[11px] font-mono text-muted-foreground truncate">/u/{profile.username || "…"}/album/{a.slug}</p>
                        {a.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{a.description}</p>}
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button onClick={() => setAlbumDialog({ open: true, album: a })} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteAlbum(a)} className="p-1.5 rounded hover:bg-destructive/15 text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Media */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-display font-700 text-lg">Media</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={filterAlbumId} onValueChange={setFilterAlbumId}>
                <SelectTrigger className="w-44 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All media</SelectItem>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {albums.map((a) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
                </SelectContent>
              </Select>

              {projects.length > 0 && (
                <Select value="" onValueChange={(v) => { if (v) addProjectLink(v); }}>
                  <SelectTrigger className="w-44 h-9 text-xs">
                    <span className="inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> Feature project</span>
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              <label className="inline-flex">
                <input type="file" multiple accept="image/*,video/*" hidden disabled={uploading}
                  onChange={(e) => { handleUpload(e.target.files); e.currentTarget.value = ""; }} />
                <Button asChild size="sm" disabled={uploading} className="gap-1.5 cursor-pointer">
                  <span>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Upload
                  </span>
                </Button>
              </label>
            </div>
          </div>

          {visibleItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No media here yet — drop in some photos or videos.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleItems.map((it) => (
                <ItemCard key={it.id} item={it} albums={albums}
                  onUpdate={(p) => updateItem(it.id, p)} onDelete={() => deleteItem(it)}
                  onChoosePoster={() => setPosterFor(it)} />
              ))}
            </div>
          )}
        </section>
      </div>

      <AlbumDialog
        open={albumDialog.open}
        album={albumDialog.album}
        items={items}
        onClose={() => setAlbumDialog({ open: false })}
        onSave={saveAlbum}
      />

      {posterFor && (
        <PosterPickerDialog
          item={posterFor}
          onClose={() => setPosterFor(null)}
          onConfirm={async (blob) => {
            const target = posterFor;
            setPosterFor(null);
            if (target) await setVideoPoster(target, blob);
          }}
        />
      )}
    </div>
  );
}

function autoCoverForAlbum(albumId: string, items: PortfolioItem[]): string | null {
  const inAlbum = items
    .filter((i) => i.album_id === albumId && (i.thumb_url || i.media_url))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const first = inAlbum[0];
  return first ? first.thumb_url || first.media_url : null;
}

function VisibilityBadge({ v }: { v: PortfolioVisibility }) {
  if (v === "public") return <Badge variant="secondary" className="text-[10px] gap-1"><Globe className="w-3 h-3" /> Public</Badge>;
  if (v === "unlisted") return <Badge variant="secondary" className="text-[10px] gap-1"><LinkIcon className="w-3 h-3" /> Unlisted</Badge>;
  return <Badge variant="outline" className="text-[10px] gap-1"><Lock className="w-3 h-3" /> Private</Badge>;
}

function ItemCard({
  item, albums, onUpdate, onDelete, onChoosePoster,
}: {
  item: PortfolioItem;
  albums: PortfolioAlbum[];
  onUpdate: (patch: Partial<PortfolioItem>) => void;
  onDelete: () => void;
  onChoosePoster: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: item.title ?? "", caption: item.caption ?? "" });

  return (
    <div className="rounded-xl border border-border bg-secondary/40 overflow-hidden">
      <div className="aspect-square bg-secondary relative">
        {item.kind === "project_link" ? (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
        ) : item.kind === "video" ? (
          <>
            {item.thumb_url ? (
              <img src={item.thumb_url} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <video src={item.media_url ?? ""} className="w-full h-full object-cover" muted playsInline preload="metadata" />
            )}
            <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1"><Film className="w-3 h-3" /> Video</div>
            <button
              onClick={onChoosePoster}
              className="absolute bottom-1 left-1 bg-black/65 hover:bg-black/85 text-white text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1"
              title="Pick a frame from the video as the thumbnail"
            >
              <Wand2 className="w-3 h-3" /> Pick frame
            </button>
            <a
              href={`/portfolio/edit/${item.id}`}
              className="absolute bottom-1 right-1 bg-primary/90 hover:bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1"
              title="Open in the video editor"
            >
              <Film className="w-3 h-3" /> Edit
            </a>
          </>
        ) : (
          <img src={item.thumb_url || item.media_url || ""} alt="" className="w-full h-full object-cover" loading="lazy" />
        )}
        <div className="absolute top-1 right-1"><VisibilityBadge v={item.visibility} /></div>
      </div>
      <div className="p-2 space-y-1.5">
        {editing ? (
          <>
            <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Title" className="h-7 text-xs" />
            <Textarea value={draft.caption} onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))} placeholder="Caption" className="min-h-[40px] text-xs" />
            <div className="flex gap-1 justify-end">
              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => { setEditing(false); setDraft({ title: item.title ?? "", caption: item.caption ?? "" }); }}><X className="w-3 h-3" /></Button>
              <Button size="sm" className="h-6 px-2" onClick={() => { onUpdate({ title: draft.title || null, caption: draft.caption || null }); setEditing(false); }}><Check className="w-3 h-3" /></Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold truncate">{item.title || <span className="text-muted-foreground">Untitled</span>}</p>
            {item.caption && <p className="text-[10px] text-muted-foreground line-clamp-2">{item.caption}</p>}
          </>
        )}

        <div className="flex items-center gap-1">
          <Select value={item.album_id ?? "none"} onValueChange={(v) => onUpdate({ album_id: v === "none" ? null : v })}>
            <SelectTrigger className="h-7 text-[10px] flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No album</SelectItem>
              {albums.map((a) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={item.visibility} onValueChange={(v) => onUpdate({ visibility: v as PortfolioVisibility })}>
            <SelectTrigger className="h-7 text-[10px] w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="unlisted">Unlisted</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-between pt-0.5">
          {item.kind === "project_link" && item.project_id ? (
            <Link to={`/viewer/${item.project_id}`} className="text-[10px] text-primary inline-flex items-center gap-1 hover:underline">
              <ExternalLink className="w-3 h-3" /> Open
            </Link>
          ) : <span />}
          <div className="flex gap-0.5">
            <button onClick={() => setEditing((v) => !v)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Pencil className="w-3 h-3" /></button>
            <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/15 text-destructive"><Trash2 className="w-3 h-3" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlbumDialog({
  open, album, items, onClose, onSave,
}: {
  open: boolean;
  album?: PortfolioAlbum;
  items: PortfolioItem[];
  onClose: () => void;
  onSave: (a: Partial<PortfolioAlbum>) => void;
}) {
  const [draft, setDraft] = useState<Partial<PortfolioAlbum>>({});
  const [picker, setPicker] = useState(false);
  useEffect(() => {
    setDraft(album ?? { visibility: "public" });
    setPicker(false);
  }, [album, open]);

  const candidateItems = useMemo(() => {
    return items
      .filter((i) => (i.thumb_url || i.media_url) && i.kind !== "project_link")
      .filter((i) => !album || i.album_id === album.id || i.album_id === null)
      .slice(0, 60);
  }, [items, album]);

  const autoCover = album ? autoCoverForAlbum(album.id, items) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{album ? "Edit album" : "New album"}</DialogTitle>
          <DialogDescription>Group related photos, videos, and project links into a curated collection.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input className="mt-1" value={draft.title ?? ""} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Real estate aerials 2026" />
          </div>
          <div>
            <Label className="text-xs">URL slug</Label>
            <Input className="mt-1 font-mono text-xs" value={draft.slug ?? ""} onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))} placeholder="auto from title" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea className="mt-1" value={draft.description ?? ""} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Cover image</Label>
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-lg border border-border bg-secondary overflow-hidden flex-shrink-0 relative">
                {(draft.cover_url || autoCover) ? (
                  <img src={(draft.cover_url || autoCover) as string} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
                {!draft.cover_url && autoCover && (
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] py-0.5 text-center">auto</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" type="button" className="gap-1.5" onClick={() => setPicker((v) => !v)}>
                    <ImageLucide className="w-3.5 h-3.5" /> {picker ? "Hide media" : "Pick from media"}
                  </Button>
                  {draft.cover_url && (
                    <Button size="sm" variant="ghost" type="button" className="gap-1.5 text-muted-foreground" onClick={() => setDraft((d) => ({ ...d, cover_url: null }))}>
                      <X className="w-3.5 h-3.5" /> Use first item
                    </Button>
                  )}
                </div>
                <Input
                  className="text-xs"
                  value={draft.cover_url ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, cover_url: e.target.value || null }))}
                  placeholder="…or paste an image URL"
                />
              </div>
            </div>

            {picker && (
              <div className="rounded-lg border border-border bg-secondary/30 p-2 max-h-56 overflow-y-auto">
                {candidateItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">Upload some media first, then come back to choose a cover.</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                    {candidateItems.map((it) => {
                      const src = it.thumb_url || it.media_url || "";
                      const selected = draft.cover_url === src;
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, cover_url: src }))}
                          className={`aspect-square rounded-md overflow-hidden border ${selected ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/40"}`}
                          title={it.title ?? ""}
                        >
                          <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Leave blank to automatically use the first item in this album as the cover.
            </p>
          </div>

          <div>
            <Label className="text-xs">Visibility</Label>
            <Select value={draft.visibility ?? "public"} onValueChange={(v) => setDraft((d) => ({ ...d, visibility: v as PortfolioVisibility }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public · listed in your portfolio</SelectItem>
                <SelectItem value="unlisted">Unlisted · only people with the link</SelectItem>
                <SelectItem value="private">Private · only you</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save album</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PosterPickerDialog({
  item, onClose, onConfirm,
}: {
  item: PortfolioItem;
  onClose: () => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  async function captureCurrent() {
    if (!item.media_url) return;
    setBusy(true);
    try {
      const v = videoRef.current;
      const t = v ? v.currentTime : time;
      const frame = await captureVideoFrame(item.media_url, { time: t });
      blobRef.current = frame.blob;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(frame.blob));
    } catch (e: any) {
      blobRef.current = null;
      setPreviewUrl(null);
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a poster frame</DialogTitle>
          <DialogDescription>Scrub to the moment you want and save it as the video's thumbnail.</DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-[1fr_180px] gap-3">
          <div className="space-y-2">
            <div className="rounded-lg overflow-hidden bg-black aspect-video">
              <video
                ref={videoRef}
                src={item.media_url ?? ""}
                controls
                crossOrigin="anonymous"
                className="w-full h-full object-contain"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  setDuration(v.duration || 0);
                  v.currentTime = Math.min(1, (v.duration || 2) * 0.1);
                }}
                onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={Math.max(duration, 0.01)}
                step={0.05}
                value={time}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  setTime(t);
                  if (videoRef.current) videoRef.current.currentTime = t;
                }}
                className="flex-1 accent-primary"
              />
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums w-16 text-right">
                {time.toFixed(1)}s / {duration.toFixed(1)}s
              </span>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 w-full" onClick={captureCurrent} disabled={busy}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Capture this frame
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Preview</Label>
            <div className="aspect-square rounded-lg border border-border bg-secondary overflow-hidden flex items-center justify-center">
              {previewUrl ? (
                <img src={previewUrl} alt="Selected frame" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-xs text-muted-foreground p-3">
                  <Wand2 className="w-5 h-5 mx-auto mb-1 opacity-60" />
                  Capture a frame to preview it here
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">This becomes the video's thumbnail across your portfolio.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!blobRef.current || busy}
            onClick={() => blobRef.current && onConfirm(blobRef.current)}
            className="gap-1.5"
          >
            <Check className="w-4 h-4" /> Use as thumbnail
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

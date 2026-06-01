import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Camera, Save, Upload, Loader2, Plus, Trash2, Pencil, Eye,
  Globe, Lock, Link as LinkIcon, Check, X, ImageIcon, Film, Sparkles,
  ExternalLink, Copy, Image as ImageLucide, Wand2, Linkedin, Twitter,
  Youtube, Music2, FileText, Mail, User as UserIcon,
  Palette, Type as TypeIcon, LayoutTemplate,
  Phone, BadgeCheck, Briefcase, EyeOff,
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
  DEFAULT_VISIBILITY_PREFS, normalizePrefs,
  type PortfolioAlbum, type PortfolioItem, type PortfolioVisibility,
  type VisibilityPrefs,
} from "@/lib/portfolio";
import { captureVideoFrame } from "@/lib/videoFrame";
import {
  DEFAULT_THEME, FONT_PAIRS, LAYOUTS, SWATCHES, ensureFontLoaded, normalizeTheme,
  type PortfolioTheme,
} from "@/lib/portfolioTheme";
import { normalizeHero } from "@/lib/portfolioTheme";
import HeroMediaPanel from "@/components/portfolio/studio/HeroMediaPanel";

interface ProjectOpt { id: string; name: string; }

export default function PortfolioStudio() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

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

  // Highlight the publish toggle when arriving via the "Publish now" deep link
  const [pulsePublish, setPulsePublish] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    refresh();
  }, [user, authLoading]);

  // Handle ?publish=1 deep link from the unpublished-preview banner.
  // Auto-publishes (if not already), scrolls to the toggle, and pulses it.
  useEffect(() => {
    if (!profile || !user) return;
    if (searchParams.get("publish") !== "1") return;

    const run = async () => {
      if (!profile.portfolio_published) {
        const { error } = await supabase
          .from("profiles")
          .update({ portfolio_published: true })
          .eq("id", user.id);
        if (error) {
          toast({ title: "Couldn't publish", description: error.message, variant: "destructive" });
        } else {
          setProfile((p: any) => ({ ...p, portfolio_published: true }));
          toast({ title: "Portfolio published", description: "Anyone with your link can now see it." });
        }
      }
      setPulsePublish(true);
      setTimeout(() => {
        document.getElementById("publish-toggle")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      setTimeout(() => setPulsePublish(false), 3000);
      // Clean the URL so a refresh doesn't re-trigger.
      const next = new URLSearchParams(searchParams);
      next.delete("publish");
      setSearchParams(next, { replace: true });
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

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
        linkedin: profile.linkedin ?? null,
        twitter: profile.twitter ?? null,
        youtube: profile.youtube ?? null,
        vimeo: profile.vimeo ?? null,
        tiktok: profile.tiktok ?? null,
        contact_email: profile.contact_email ?? null,
        phone: profile.phone ?? null,
        avatar_url: profile.avatar_url ?? null,
        resume_url: profile.resume_url ?? null,
        portfolio_published: !!profile.portfolio_published,
        banner_url: profile.banner_url ?? null,
        theme: normalizeTheme(profile.theme) as any,
        services: Array.isArray(profile.services) ? profile.services : [],
        hourly_rate_cents: typeof profile.hourly_rate_cents === "number" ? profile.hourly_rate_cents : null,
        available_for_hire: profile.available_for_hire !== false,
        visibility_prefs: normalizePrefs(profile.visibility_prefs) as any,
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

  async function handleAvatarUpload(file: File | null) {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Pick an image file", variant: "destructive" }); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image is too large", description: "Max 5 MB", variant: "destructive" }); return;
    }
    try {
      const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? ".jpg").toLowerCase();
      const { url } = await uploadBlobToBucket(file, `avatar${ext}`, file.type);
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) throw error;
      setProfile((p: any) => ({ ...p, avatar_url: url }));
      toast({ title: "Avatar updated" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message ?? String(e), variant: "destructive" });
    }
  }

  async function handleResumeUpload(file: File | null) {
    if (!file || !user) return;
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 15 MB", variant: "destructive" }); return;
    }
    try {
      const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? ".pdf").toLowerCase();
      const { url } = await uploadBlobToBucket(file, `resume${ext}`, file.type || "application/pdf");
      const { error } = await supabase.from("profiles").update({ resume_url: url }).eq("id", user.id);
      if (error) throw error;
      setProfile((p: any) => ({ ...p, resume_url: url }));
      toast({ title: "Résumé uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message ?? String(e), variant: "destructive" });
    }
  }

  async function handleBannerUpload(file: File | null) {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Pick an image file", variant: "destructive" }); return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Banner is too large", description: "Max 8 MB", variant: "destructive" }); return;
    }
    try {
      const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? ".jpg").toLowerCase();
      const { url } = await uploadBlobToBucket(file, `banner${ext}`, file.type);
      const { error } = await supabase.from("profiles").update({ banner_url: url }).eq("id", user.id);
      if (error) throw error;
      setProfile((p: any) => ({ ...p, banner_url: url }));
      toast({ title: "Banner updated" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message ?? String(e), variant: "destructive" });
    }
  }

  function patchTheme(patch: Partial<PortfolioTheme>) {
    setProfile((p: any) => ({ ...p, theme: { ...normalizeTheme(p?.theme), ...patch } }));
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
            <div
              id="publish-toggle"
              className={`flex items-center gap-2 rounded-full px-2 py-1 transition-all scroll-mt-24 ${
                pulsePublish ? "ring-2 ring-amber-400 bg-amber-500/10 animate-pulse" : ""
              }`}
            >
              <Label htmlFor="pub" className="text-xs text-muted-foreground">Published</Label>
              <Switch id="pub" checked={!!profile.portfolio_published} onCheckedChange={(v) => setProfile((p: any) => ({ ...p, portfolio_published: v }))} />
            </div>
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-secondary border border-border flex items-center justify-center">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Profile photo</p>
              <p className="text-[11px] text-muted-foreground mb-2">Square JPG/PNG works best. Max 5 MB.</p>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border bg-secondary hover:bg-secondary/70 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  {profile.avatar_url ? "Change photo" : "Upload photo"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarUpload(e.target.files?.[0] ?? null)} />
                </label>
                {profile.avatar_url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5 text-xs"
                    onClick={async () => {
                      if (!user) return;
                      await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
                      setProfile((p: any) => ({ ...p, avatar_url: null }));
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </Button>
                )}
              </div>
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
            <div>
              <Label className="text-xs flex items-center gap-1.5"><Mail className="w-3 h-3" /> Public contact email</Label>
              <Input className="mt-1" placeholder="hello@yourstudio.com" value={profile.contact_email ?? ""} onChange={(e) => setProfile((p: any) => ({ ...p, contact_email: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5"><Phone className="w-3 h-3" /> Public phone</Label>
              <Input className="mt-1" placeholder="+1 555 123 4567" value={profile.phone ?? ""} onChange={(e) => setProfile((p: any) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5"><Linkedin className="w-3 h-3" /> LinkedIn</Label>
              <Input className="mt-1" placeholder="https://linkedin.com/in/you" value={profile.linkedin ?? ""} onChange={(e) => setProfile((p: any) => ({ ...p, linkedin: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5"><Twitter className="w-3 h-3" /> X / Twitter handle</Label>
              <Input className="mt-1" placeholder="dronepilot" value={profile.twitter ?? ""} onChange={(e) => setProfile((p: any) => ({ ...p, twitter: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5"><Youtube className="w-3 h-3" /> YouTube</Label>
              <Input className="mt-1" placeholder="https://youtube.com/@you" value={profile.youtube ?? ""} onChange={(e) => setProfile((p: any) => ({ ...p, youtube: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5"><Film className="w-3 h-3" /> Vimeo</Label>
              <Input className="mt-1" placeholder="https://vimeo.com/you" value={profile.vimeo ?? ""} onChange={(e) => setProfile((p: any) => ({ ...p, vimeo: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5"><Music2 className="w-3 h-3" /> TikTok handle</Label>
              <Input className="mt-1" placeholder="dronepilot" value={profile.tiktok ?? ""} onChange={(e) => setProfile((p: any) => ({ ...p, tiktok: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs flex items-center gap-1.5"><FileText className="w-3 h-3" /> Résumé / CV</Label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border bg-secondary hover:bg-secondary/70 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  {profile.resume_url ? "Replace résumé" : "Upload PDF"}
                  <input type="file" accept="application/pdf,.pdf,.doc,.docx" className="hidden" onChange={(e) => handleResumeUpload(e.target.files?.[0] ?? null)} />
                </label>
                {profile.resume_url && (
                  <>
                    <a href={profile.resume_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> View current
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 text-xs"
                      onClick={async () => {
                        if (!user) return;
                        await supabase.from("profiles").update({ resume_url: null }).eq("id", user.id);
                        setProfile((p: any) => ({ ...p, resume_url: null }));
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </Button>
                  </>
                )}
                <span className="text-[11px] text-muted-foreground">PDF or DOCX, up to 15 MB. Visitors can download it from your profile.</span>
              </div>
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

        {/* Appearance */}
        <AppearanceSection
          theme={normalizeTheme(profile.theme)}
          bannerUrl={profile.banner_url ?? null}
          onPatchTheme={patchTheme}
          onUploadBanner={handleBannerUpload}
          onRemoveBanner={async () => {
            if (!user) return;
            await supabase.from("profiles").update({ banner_url: null }).eq("id", user.id);
            setProfile((p: any) => ({ ...p, banner_url: null }));
          }}
          onSave={saveProfile}
          saving={savingProfile}
        />

        {/* Cinematic hero — video / slideshow / image */}
        <HeroMediaPanel
          hero={normalizeHero(normalizeTheme(profile.theme).hero)}
          items={items}
          displayName={profile.full_name || profile.username || "Pilot"}
          headline={profile.headline ?? null}
          fallbackImage={profile.banner_url ?? null}
          onPatchHero={(patch) => patchTheme({
            hero: { ...normalizeHero(normalizeTheme(profile.theme).hero), ...patch },
          })}
          uploadBlob={async (blob, suffix, contentType) => uploadBlobToBucket(blob, suffix, contentType)}
          saving={savingProfile}
        />

        {/* Hire-me details */}
        <HireMeSection
          profile={profile}
          setProfile={setProfile}
          onSave={saveProfile}
          saving={savingProfile}
        />

        {/* Visibility toggles */}
        <VisibilitySection
          prefs={normalizePrefs(profile.visibility_prefs)}
          onPatch={(patch) => setProfile((p: any) => ({ ...p, visibility_prefs: { ...normalizePrefs(p?.visibility_prefs), ...patch } }))}
          onSave={saveProfile}
          saving={savingProfile}
        />

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
        onUploadCover={async (file) => {
          const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? ".jpg").toLowerCase();
          const safe = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_") || "cover";
          const { url } = await uploadBlobToBucket(file, `album-cover-${safe}${ext}`, file.type || "image/jpeg");
          return url;
        }}
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
  open, album, items, onClose, onSave, onUploadCover,
}: {
  open: boolean;
  album?: PortfolioAlbum;
  items: PortfolioItem[];
  onClose: () => void;
  onSave: (a: Partial<PortfolioAlbum>) => void;
  onUploadCover: (file: File) => Promise<string>;
}) {
  const [draft, setDraft] = useState<Partial<PortfolioAlbum>>({});
  const [picker, setPicker] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverFileRef = useRef<HTMLInputElement | null>(null);
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
                  <Button size="sm" variant="outline" type="button" className="gap-1.5" onClick={() => coverFileRef.current?.click()} disabled={uploadingCover}>
                    {uploadingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {uploadingCover ? "Uploading…" : "Upload from device"}
                  </Button>
                  <input
                    ref={coverFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.currentTarget.value = "";
                      if (!f) return;
                      if (f.size > 8 * 1024 * 1024) return;
                      setUploadingCover(true);
                      try {
                        const url = await onUploadCover(f);
                        setDraft((d) => ({ ...d, cover_url: url }));
                      } finally {
                        setUploadingCover(false);
                      }
                    }}
                  />
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
            <Button size="sm" variant="outline" className="gap-1.5 w-full" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              <Upload className="w-3.5 h-3.5" />
              Upload image from device
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.currentTarget.value = "";
                if (!f) return;
                if (!f.type.startsWith("image/")) return;
                if (f.size > 8 * 1024 * 1024) return;
                blobRef.current = f;
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(URL.createObjectURL(f));
              }}
            />
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

function AppearanceSection({
  theme, bannerUrl, onPatchTheme, onUploadBanner, onRemoveBanner, onSave, saving,
}: {
  theme: PortfolioTheme;
  bannerUrl: string | null;
  onPatchTheme: (patch: Partial<PortfolioTheme>) => void;
  onUploadBanner: (file: File | null) => void;
  onRemoveBanner: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  // Preload the active font so the live preview renders correctly.
  useEffect(() => { ensureFontLoaded(theme.font); }, [theme.font]);

  const swatch = SWATCHES.find((s) => s.id === theme.swatch) ?? SWATCHES[0];
  const fontPair = FONT_PAIRS.find((f) => f.id === theme.font) ?? FONT_PAIRS[0];
  const accent = theme.accent ?? swatch.accent;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" />
          <h2 className="font-display font-700 text-lg">Appearance</h2>
        </div>
        <Button onClick={onSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save appearance
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Pick a layout, palette, fonts and a banner. Changes show on your public portfolio after saving.
      </p>

      {/* Layout */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <LayoutTemplate className="w-3.5 h-3.5" /> Layout
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {LAYOUTS.map((l) => {
            const active = theme.layout === l.id;
            return (
              <button
                key={l.id}
                onClick={() => onPatchTheme({ layout: l.id })}
                className={`text-left rounded-xl border p-3 transition-all ${active ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border hover:border-primary/40 bg-secondary/40"}`}
              >
                <LayoutPreview layout={l.id} />
                <p className="font-display font-700 text-sm mt-2 flex items-center gap-1.5">
                  {l.label}
                  {active && <Check className="w-3.5 h-3.5 text-primary" />}
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">{l.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color swatches */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <Palette className="w-3.5 h-3.5" /> Palette
        </div>
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map((s) => {
            const active = theme.swatch === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onPatchTheme({ swatch: s.id, accent: null })}
                className={`group rounded-xl border px-3 py-2 transition-all ${active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"}`}
                style={{ background: `hsl(${s.bg})` }}
                title={s.label}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full" style={{ background: `hsl(${s.accent})` }} />
                  <span className="w-4 h-4 rounded-full" style={{ background: `hsl(${s.surface})`, border: "1px solid rgba(255,255,255,.15)" }} />
                </div>
                <p className="text-[11px] mt-1 font-medium" style={{ color: `hsl(${s.text})` }}>{s.label}</p>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Label className="text-[11px] text-muted-foreground">Custom accent</Label>
          <div className="relative">
            <input
              type="color"
              value={hslStringToHex(accent)}
              onChange={(e) => onPatchTheme({ accent: hexToHslString(e.target.value) })}
              className="w-9 h-7 rounded cursor-pointer border border-border bg-transparent"
              aria-label="Custom accent color"
            />
          </div>
          {theme.accent && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onPatchTheme({ accent: null })}>
              <X className="w-3 h-3" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* Fonts */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <TypeIcon className="w-3.5 h-3.5" /> Fonts
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FONT_PAIRS.map((f) => {
            const active = theme.font === f.id;
            return (
              <button
                key={f.id}
                onClick={() => { onPatchTheme({ font: f.id }); ensureFontLoaded(f.id); }}
                className={`rounded-xl border p-3 text-left transition-all ${active ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border hover:border-primary/40 bg-secondary/40"}`}
              >
                <div className="text-3xl leading-none" style={{ fontFamily: f.display }}>Aa</div>
                <p className="text-xs font-display font-700 mt-2 flex items-center gap-1.5">
                  {f.label}
                  {active && <Check className="w-3 h-3 text-primary" />}
                </p>
                <p className="text-[10px] text-muted-foreground truncate" style={{ fontFamily: f.body }}>The quick brown fox</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Banner */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <ImageIcon className="w-3.5 h-3.5" /> Hero banner
        </div>
        <div
          className="rounded-xl border border-border overflow-hidden h-36 sm:h-44 bg-secondary relative"
          style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          {!bannerUrl && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              No banner — upload a wide image to feature behind your hero.
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border bg-secondary hover:bg-secondary/70 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            {bannerUrl ? "Replace banner" : "Upload banner"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onUploadBanner(e.target.files?.[0] ?? null)} />
          </label>
          {bannerUrl && (
            <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={onRemoveBanner}>
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </Button>
          )}
          <label className="inline-flex items-center gap-2 text-[11px] text-muted-foreground ml-auto">
            <Switch checked={!theme.hideBackdrop} onCheckedChange={(v) => onPatchTheme({ hideBackdrop: !v })} />
            Show blurred photo backdrop when no banner
          </label>
        </div>
      </div>

      {/* Live preview */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <Eye className="w-3.5 h-3.5" /> Preview
        </div>
        <div
          className="rounded-2xl overflow-hidden border border-border"
          style={{ background: `hsl(${swatch.bg})`, color: `hsl(${swatch.text})`, fontFamily: fontPair.body }}
        >
          <div
            className="h-24 sm:h-32 relative"
            style={
              bannerUrl
                ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                : { background: `radial-gradient(ellipse at top right, hsl(${accent} / 0.35), transparent 60%), hsl(${swatch.surface})` }
            }
          >
            <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent, hsl(${swatch.bg}))` }} />
          </div>
          <div className="p-4 -mt-10 relative">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-700 text-xl"
                 style={{ background: `hsl(${accent} / 0.2)`, color: `hsl(${accent})`, border: `1px solid hsl(${accent} / 0.4)` }}>
              Aa
            </div>
            <p className="mt-2 text-2xl leading-tight" style={{ fontFamily: fontPair.display, fontWeight: 700 }}>
              Your portfolio name
            </p>
            <p className="text-xs opacity-70">Headline · Layout: {LAYOUTS.find((l) => l.id === theme.layout)?.label}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LayoutPreview({ layout }: { layout: PortfolioTheme["layout"] }) {
  if (layout === "cinematic") {
    return (
      <div className="aspect-[16/9] rounded-md bg-gradient-to-br from-primary/30 to-primary/5 relative overflow-hidden border border-border">
        <div className="absolute inset-x-2 bottom-2 flex items-end gap-1.5">
          <div className="w-6 h-6 rounded-md bg-foreground/40" />
          <div className="space-y-1 flex-1">
            <div className="h-2 w-1/2 rounded bg-foreground/40" />
            <div className="h-1 w-3/4 rounded bg-foreground/20" />
          </div>
        </div>
      </div>
    );
  }
  if (layout === "editorial") {
    return (
      <div className="aspect-[16/9] rounded-md bg-secondary relative overflow-hidden border border-border p-2">
        <div className="space-y-1">
          <div className="h-2 w-2/3 rounded bg-foreground/50" />
          <div className="h-2 w-1/2 rounded bg-foreground/30" />
          <div className="h-1 w-3/4 rounded bg-foreground/20 mt-1" />
        </div>
      </div>
    );
  }
  return (
    <div className="aspect-[16/9] rounded-md bg-secondary border border-border p-1.5 grid grid-cols-3 gap-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-sm bg-foreground/15" />
      ))}
    </div>
  );
}

function hslStringToHex(hsl: string): string {
  const m = hsl.trim().match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/);
  if (!m) return "#3aa776";
  const h = parseFloat(m[1]) / 360, s = parseFloat(m[2]) / 100, l = parseFloat(m[3]) / 100;
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function hexToHslString(hex: string): string {
  const m = hex.replace("#", "").match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return "152 60% 38%";
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/* ─────────────────────────────────────────────────────────────────
 * Hire-me / professional details
 * ─────────────────────────────────────────────────────────────── */
function HireMeSection({
  profile, setProfile, onSave, saving,
}: {
  profile: any;
  setProfile: React.Dispatch<React.SetStateAction<any>>;
  onSave: () => void;
  saving: boolean;
}) {
  const services: string[] = Array.isArray(profile.services) ? profile.services : [];
  const [draft, setDraft] = useState("");

  function addService(raw: string) {
    const v = raw.trim();
    if (!v) return;
    if (services.map((s) => s.toLowerCase()).includes(v.toLowerCase())) return;
    setProfile((p: any) => ({ ...p, services: [...services, v].slice(0, 12) }));
    setDraft("");
  }
  function removeService(idx: number) {
    setProfile((p: any) => ({ ...p, services: services.filter((_, i) => i !== idx) }));
  }

  const SUGGESTIONS = [
    "Real estate", "Construction", "Inspections", "Events",
    "Weddings", "Mapping & survey", "Cinematography", "Tourism",
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-primary" />
          <h2 className="font-display font-700 text-lg">Hire me</h2>
        </div>
        <Button onClick={onSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Help prospects qualify you in seconds. These details power the call-to-action and badges on your public page.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-secondary/30 p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Available for hire</p>
            <p className="text-[11px] text-muted-foreground">Shows a green “available” pulse on your portfolio.</p>
          </div>
          <Switch
            checked={profile.available_for_hire !== false}
            onCheckedChange={(v) => setProfile((p: any) => ({ ...p, available_for_hire: v }))}
          />
        </div>

        <div>
          <Label className="text-xs flex items-center gap-1.5"><BadgeCheck className="w-3 h-3" /> Hourly rate (USD)</Label>
          <Input
            type="number"
            min={0}
            placeholder="150"
            className="mt-1"
            value={typeof profile.hourly_rate_cents === "number" ? Math.round(profile.hourly_rate_cents / 100) : ""}
            onChange={(e) => {
              const num = e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value)));
              setProfile((p: any) => ({ ...p, hourly_rate_cents: num === null ? null : num * 100 }));
            }}
          />
          <p className="text-[11px] text-muted-foreground mt-1">Optional. Hidden by default — enable “Show rate” in the visibility section to display it.</p>
        </div>
      </div>

      <div>
        <Label className="text-xs">Services you offer</Label>
        <div className="mt-1 flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
          {services.length === 0 && (
            <span className="text-[11px] text-muted-foreground italic">No services yet — add a few so visitors instantly know what you do.</span>
          )}
          {services.map((s, i) => (
            <span key={`${s}-${i}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs">
              {s}
              <button onClick={() => removeService(i)} className="text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addService(draft); } }}
            placeholder="Add a service and press Enter…"
            className="text-sm"
          />
          <Button size="sm" variant="outline" onClick={() => addService(draft)} disabled={!draft.trim()}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {SUGGESTIONS.filter((s) => !services.map((x) => x.toLowerCase()).includes(s.toLowerCase())).map((s) => (
            <button
              key={s}
              onClick={() => addService(s)}
              className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/50"
            >
              + {s}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Visibility toggles — pick what shows on the public portfolio
 * ─────────────────────────────────────────────────────────────── */
function VisibilitySection({
  prefs, onPatch, onSave, saving,
}: {
  prefs: Required<VisibilityPrefs>;
  onPatch: (patch: Partial<VisibilityPrefs>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const ROWS: { key: keyof VisibilityPrefs; label: string; help: string }[] = [
    { key: "show_hire_cta",     label: "“Hire me” button",        help: "Big primary CTA in the hero that opens an email to you." },
    { key: "show_availability", label: "Availability badge",      help: "Shows whether you’re currently taking on work." },
    { key: "show_services",     label: "Services chips",          help: "Lists the services you offer (real estate, inspections…)." },
    { key: "show_rate",         label: "Hourly rate",             help: "Display your rate as a public badge. Off by default." },
    { key: "show_email",        label: "Email address",           help: "Shown in the contact rail under the hero." },
    { key: "show_phone",        label: "Phone number",            help: "Shown in the contact rail. Click-to-call on mobile." },
    { key: "show_location",     label: "Location",                help: "Your service area or city." },
    { key: "show_website",      label: "Website",                 help: "Your studio or portfolio website." },
    { key: "show_socials",      label: "Social links",            help: "Instagram, LinkedIn, X, YouTube, Vimeo, TikTok." },
    { key: "show_resume",       label: "Résumé / CV button",      help: "A button to download your résumé." },
    { key: "show_powered_by",   label: "“Powered by Dronie” footer", help: "A small credit at the bottom of your portfolio." },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <EyeOff className="w-4 h-4 text-primary" />
          <h2 className="font-display font-700 text-lg">What to show on your public page</h2>
        </div>
        <Button onClick={onSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Toggle any detail on or off. Empty fields are always hidden — these switches only affect items that have a value.
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        {ROWS.map((row) => {
          const enabled = prefs[row.key as keyof typeof prefs];
          return (
            <label
              key={row.key as string}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/50 p-3 cursor-pointer transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{row.help}</p>
              </div>
              <Switch
                checked={!!enabled}
                onCheckedChange={(v) => onPatch({ [row.key]: v } as any)}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}

import { supabase } from "@/integrations/supabase/client";
import type { PortfolioTheme } from "./portfolioTheme";

export type PortfolioVisibility = "public" | "unlisted" | "private";

/**
 * Per-user toggles for what to surface on the public portfolio page.
 * Stored as JSON in profiles.visibility_prefs. Defaults to "show" for
 * everything that has a value — the public page also gates on the
 * underlying data, so an empty field is never rendered regardless.
 */
export interface VisibilityPrefs {
  show_email?: boolean;
  show_phone?: boolean;
  show_location?: boolean;
  show_website?: boolean;
  show_socials?: boolean;
  show_resume?: boolean;
  show_services?: boolean;
  show_rate?: boolean;
  show_hire_cta?: boolean;
  show_availability?: boolean;
  show_powered_by?: boolean;
}

export const DEFAULT_VISIBILITY_PREFS: Required<VisibilityPrefs> = {
  show_email: true,
  show_phone: true,
  show_location: true,
  show_website: true,
  show_socials: true,
  show_resume: true,
  show_services: true,
  show_rate: false,
  show_hire_cta: true,
  show_availability: true,
  show_powered_by: true,
};

export function normalizePrefs(raw: any): Required<VisibilityPrefs> {
  const base = { ...DEFAULT_VISIBILITY_PREFS };
  if (raw && typeof raw === "object") {
    for (const k of Object.keys(base) as (keyof VisibilityPrefs)[]) {
      if (typeof raw[k] === "boolean") (base as any)[k] = raw[k];
    }
  }
  return base;
}

export interface PortfolioProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  twitter: string | null;
  youtube: string | null;
  vimeo: string | null;
  tiktok: string | null;
  contact_email: string | null;
  phone: string | null;
  resume_url: string | null;
  portfolio_published: boolean;
  banner_url: string | null;
  theme: PortfolioTheme | null;
  services: string[];
  hourly_rate_cents: number | null;
  available_for_hire: boolean;
  visibility_prefs: VisibilityPrefs | null;
}

export interface PortfolioAlbum {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  visibility: PortfolioVisibility;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PortfolioItem {
  id: string;
  user_id: string;
  album_id: string | null;
  kind: "photo" | "video" | "project_link";
  storage_path: string | null;
  media_url: string | null;
  thumb_url: string | null;
  title: string | null;
  caption: string | null;
  captured_at: string | null;
  project_id: string | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  visibility: PortfolioVisibility;
  sort_order: number;
  created_at: string;
}

export const PORTFOLIO_BUCKET = "portfolio-media";

export const RESERVED_USERNAMES = new Set([
  "auth","dashboard","admin","project","viewer","gallery","fleet","jobs",
  "install","privacy","terms","plan","missions","workflow","swarm","reality",
  "rtk","insights","compliance","splats","subscription","u","portfolio","api",
  "www","mail","app","assets","public","static","help","support","about",
  "login","logout","signup","signin","settings","billing","docs","blog","home",
]);

export function validateUsername(name: string): string | null {
  if (!name) return "Username is required";
  if (name.length < 3 || name.length > 30) return "Must be 3–30 characters";
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return "Letters, numbers, _ and - only";
  if (RESERVED_USERNAMES.has(name.toLowerCase())) return "Reserved username";
  return null;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function fetchPortfolioByUsername(username: string) {
  const { data, error } = await supabase
    .rpc("get_public_portfolio", { _username: username })
    .maybeSingle();
  if (error) throw error;
  return data as unknown as PortfolioProfile | null;
}

export async function fetchPublicAlbumsByUser(userId: string, includePrivate = false) {
  const { data, error } = await supabase
    .from("portfolio_albums")
    .select("*")
    .eq("user_id", userId)
    .in("visibility", includePrivate ? ["public", "unlisted", "private"] : ["public"])
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PortfolioAlbum[];
}

export async function fetchPublicItemsByUser(
  userId: string,
  kind?: "photo" | "video" | "project_link",
  includePrivate = false,
) {
  let q = supabase
    .from("portfolio_items")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (!includePrivate) q = q.eq("visibility", "public");
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PortfolioItem[];
}

export async function fetchAlbumBySlug(userId: string, slug: string) {
  const { data, error } = await supabase
    .from("portfolio_albums")
    .select("*")
    .eq("user_id", userId)
    .eq("slug", slug)
    .in("visibility", ["public", "unlisted"])
    .maybeSingle();
  if (error) throw error;
  return data as PortfolioAlbum | null;
}

export async function fetchItemsForAlbum(albumId: string) {
  const { data, error } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("album_id", albumId)
    .in("visibility", ["public", "unlisted"])
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PortfolioItem[];
}

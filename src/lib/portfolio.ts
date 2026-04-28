import { supabase } from "@/integrations/supabase/client";

export type PortfolioVisibility = "public" | "unlisted" | "private";

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
  portfolio_published: boolean;
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
    .from("profiles")
    .select("id,username,full_name,avatar_url,headline,bio,location,website,instagram,portfolio_published")
    .ilike("username", username)
    .eq("portfolio_published", true)
    .maybeSingle();
  if (error) throw error;
  return data as PortfolioProfile | null;
}

export async function fetchPublicAlbumsByUser(userId: string) {
  const { data, error } = await supabase
    .from("portfolio_albums")
    .select("*")
    .eq("user_id", userId)
    .eq("visibility", "public")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PortfolioAlbum[];
}

export async function fetchPublicItemsByUser(
  userId: string,
  kind?: "photo" | "video" | "project_link",
) {
  let q = supabase
    .from("portfolio_items")
    .select("*")
    .eq("user_id", userId)
    .eq("visibility", "public")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
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

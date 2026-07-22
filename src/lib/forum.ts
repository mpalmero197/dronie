import { supabase } from "@/integrations/supabase/client";

export const FORUM_MEDIA_BUCKET = "portfolio-media";
export const MAX_FORUM_ATTACHMENTS = 10;
export const MAX_FORUM_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

export interface ForumCategory {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
}

export interface ForumThread {
  id: string;
  category_id: string;
  author_id: string;
  title: string;
  slug: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  view_count: number;
  reply_count: number;
  score: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  attachments?: string[];
}

export interface ForumPost {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  parent_post_id: string | null;
  score: number;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
  attachments?: string[];
}

export interface AuthorMini {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "thread";
}

export async function listCategories(): Promise<ForumCategory[]> {
  const { data, error } = await supabase
    .from("forum_categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ForumCategory[];
}

export async function getCategoryBySlug(slug: string): Promise<ForumCategory | null> {
  const { data, error } = await supabase
    .from("forum_categories").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as ForumCategory) ?? null;
}

export async function listThreads(categoryId?: string, limit = 50): Promise<ForumThread[]> {
  let q = supabase
    .from("forum_threads")
    .select("*")
    .order("pinned", { ascending: false })
    .order("last_activity_at", { ascending: false })
    .limit(limit);
  if (categoryId) q = q.eq("category_id", categoryId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ForumThread[];
}

export async function getThread(id: string): Promise<ForumThread | null> {
  const { data, error } = await supabase
    .from("forum_threads").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as ForumThread) ?? null;
}

export async function listPosts(threadId: string): Promise<ForumPost[]> {
  const { data, error } = await supabase
    .from("forum_posts")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as ForumPost[];
}

export async function getAuthors(ids: string[]): Promise<Record<string, AuthorMini>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return {};
  const { data, error } = await supabase.rpc("get_forum_authors", { _ids: uniq });
  if (error) throw error;
  const map: Record<string, AuthorMini> = {};
  (data ?? []).forEach((p: any) => { map[p.id] = p as AuthorMini; });
  return map;
}

export interface ForumCategoryStats {
  category_id: string;
  thread_count: number;
  post_count: number;
}

export async function getCategoryStats(): Promise<Record<string, ForumCategoryStats>> {
  const { data, error } = await supabase.rpc("get_forum_category_stats");
  if (error) throw error;
  const map: Record<string, ForumCategoryStats> = {};
  (data ?? []).forEach((r: any) => {
    map[r.category_id] = {
      category_id: r.category_id,
      thread_count: Number(r.thread_count ?? 0),
      post_count: Number(r.post_count ?? 0),
    };
  });
  return map;
}

export interface DidYouKnowStats { thread_count: number; post_count: number; }

// "Did You Know" threads are tagged by slug prefix `dyk-` (posted by Dronie Bot).
export async function getDidYouKnowStats(): Promise<DidYouKnowStats> {
  const { data: threads, error: tErr } = await supabase
    .from("forum_threads")
    .select("id, reply_count")
    .like("slug", "dyk-%");
  if (tErr) throw tErr;
  const thread_count = threads?.length ?? 0;
  const replies = (threads ?? []).reduce((s: number, r: any) => s + Number(r.reply_count ?? 0), 0);
  return { thread_count, post_count: thread_count + replies };
}

export async function createThread(input: {
  category_id: string; title: string; body: string; author_id: string; attachments?: string[];
}): Promise<ForumThread> {
  const { data, error } = await supabase
    .from("forum_threads")
    .insert({
      category_id: input.category_id,
      author_id: input.author_id,
      title: input.title.trim(),
      slug: slugify(input.title),
      body: input.body.trim(),
      attachments: (input.attachments ?? []).slice(0, MAX_FORUM_ATTACHMENTS),
    })
    .select()
    .single();
  if (error) throw error;
  return data as ForumThread;
}

export async function createPost(input: {
  thread_id: string; body: string; author_id: string; parent_post_id?: string | null; attachments?: string[];
}): Promise<ForumPost> {
  const { data, error } = await supabase
    .from("forum_posts")
    .insert({
      thread_id: input.thread_id,
      author_id: input.author_id,
      body: input.body.trim(),
      parent_post_id: input.parent_post_id ?? null,
      attachments: (input.attachments ?? []).slice(0, MAX_FORUM_ATTACHMENTS),
    })
    .select()
    .single();
  if (error) throw error;
  return data as ForumPost;
}

export async function uploadForumImage(file: File, userId: string): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }
  if (file.size > MAX_FORUM_IMAGE_BYTES) {
    throw new Error("Image is larger than 8 MB");
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/forum/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(FORUM_MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (error) throw error;
  const { data } = supabase.storage.from(FORUM_MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function updatePost(id: string, body: string) {
  const { error } = await supabase.from("forum_posts").update({ body: body.trim() }).eq("id", id);
  if (error) throw error;
}

export async function deletePost(id: string) {
  const { error } = await supabase.from("forum_posts").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteThread(id: string) {
  const { error } = await supabase.from("forum_threads").delete().eq("id", id);
  if (error) throw error;
}

export async function setThreadFlags(id: string, flags: { pinned?: boolean; locked?: boolean }) {
  const { error } = await supabase.from("forum_threads").update(flags).eq("id", id);
  if (error) throw error;
}

export async function incrementView(threadId: string) {
  await supabase.rpc("forum_increment_view", { _thread_id: threadId });
}

export async function castVote(target: { thread_id?: string; post_id?: string }, value: 1 | -1, userId: string) {
  // Try find existing
  let q = supabase.from("forum_votes").select("*").eq("user_id", userId);
  if (target.thread_id) q = q.eq("thread_id", target.thread_id);
  if (target.post_id) q = q.eq("post_id", target.post_id);
  const { data: existing } = await q.maybeSingle();
  if (existing) {
    if ((existing as any).value === value) {
      // toggle off
      await supabase.from("forum_votes").delete().eq("id", (existing as any).id);
      return 0;
    }
    await supabase.from("forum_votes").update({ value }).eq("id", (existing as any).id);
    return value;
  }
  await supabase.from("forum_votes").insert({
    user_id: userId,
    thread_id: target.thread_id ?? null,
    post_id: target.post_id ?? null,
    value,
  });
  return value;
}

export async function getMyVotes(userId: string, threadIds: string[], postIds: string[]) {
  if (!userId) return { threads: {}, posts: {} as Record<string, number> };
  const out = { threads: {} as Record<string, number>, posts: {} as Record<string, number> };
  if (threadIds.length) {
    const { data } = await supabase.from("forum_votes")
      .select("thread_id,value").eq("user_id", userId).in("thread_id", threadIds);
    (data ?? []).forEach((v: any) => { if (v.thread_id) out.threads[v.thread_id] = v.value; });
  }
  if (postIds.length) {
    const { data } = await supabase.from("forum_votes")
      .select("post_id,value").eq("user_id", userId).in("post_id", postIds);
    (data ?? []).forEach((v: any) => { if (v.post_id) out.posts[v.post_id] = v.value; });
  }
  return out;
}

export async function reportContent(input: {
  reporter_id: string; thread_id?: string; post_id?: string; reason: string;
}) {
  const { error } = await supabase.from("forum_reports").insert({
    reporter_id: input.reporter_id,
    thread_id: input.thread_id ?? null,
    post_id: input.post_id ?? null,
    reason: input.reason.trim(),
  });
  if (error) throw error;
}

export async function amIBanned(userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from("forum_bans")
    .select("expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return false;
  const exp = (data as any).expires_at;
  return !exp || new Date(exp) > new Date();
}
import { supabase } from "@/integrations/supabase/client";

export type SharePermission = "view" | "comment" | "download";

export interface DeliverableShare {
  id: string;
  project_id: string;
  owner_id: string;
  token: string;
  deliverable_keys: string[];
  permission: SharePermission;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
}

function generateToken() {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 40);
}

export async function listShares(projectId: string): Promise<DeliverableShare[]> {
  const { data, error } = await supabase
    .from("deliverable_shares")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DeliverableShare[];
}

export async function createShare(input: {
  projectId: string;
  ownerId: string;
  deliverableKeys: string[];
  permission: SharePermission;
  expiresInDays?: number | null;
}): Promise<DeliverableShare> {
  const expires_at = input.expiresInDays && input.expiresInDays > 0
    ? new Date(Date.now() + input.expiresInDays * 86400000).toISOString()
    : null;
  const { data, error } = await supabase
    .from("deliverable_shares")
    .insert({
      project_id: input.projectId,
      owner_id: input.ownerId,
      token: generateToken(),
      deliverable_keys: input.deliverableKeys,
      permission: input.permission,
      expires_at,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as DeliverableShare;
}

export async function revokeShare(id: string) {
  const { error } = await supabase
    .from("deliverable_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export function shareUrl(token: string) {
  return `${window.location.origin}/share/${token}`;
}
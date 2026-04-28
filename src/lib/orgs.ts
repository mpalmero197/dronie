import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export interface Organization {
  id: string;
  owner_id: string;
  name: string;
  website: string | null;
  contact_email: string | null;
  phone: string | null;
  bio: string | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: "owner" | "manager" | "pilot";
  status: "invited" | "active" | "removed";
  created_at: string;
  updated_at: string;
}

export const orgSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  website: z.string().trim().url().max(255).or(z.literal("")).optional(),
  contact_email: z.string().trim().email().max(255).or(z.literal("")).optional(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  bio: z.string().trim().max(800).optional().or(z.literal("")),
});

export async function listMyOrgs(userId: string): Promise<Organization[]> {
  // Owned + member orgs
  const owned = supabase.from("organizations").select("*").eq("owner_id", userId);
  const memberRows = supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("status", "active");
  const [{ data: o, error: e1 }, { data: m, error: e2 }] = await Promise.all([owned, memberRows]);
  if (e1) throw e1;
  if (e2) throw e2;
  const otherIds = (m ?? []).map((r: any) => r.org_id).filter((id: string) => !(o ?? []).find((x: any) => x.id === id));
  let extra: any[] = [];
  if (otherIds.length) {
    const { data: x } = await supabase.from("organizations").select("*").in("id", otherIds);
    extra = x ?? [];
  }
  return [...(o ?? []), ...extra] as Organization[];
}

export async function getOrg(orgId: string): Promise<Organization | null> {
  const { data, error } = await supabase.from("organizations").select("*").eq("id", orgId).maybeSingle();
  if (error) throw error;
  return (data as Organization) ?? null;
}

export async function listMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OrgMember[];
}

export async function inviteMember(orgId: string, email: string) {
  const token = crypto.randomUUID().replace(/-/g, "");
  const trimmed = email.trim().toLowerCase();
  const { error } = await supabase.from("organization_invites").insert({
    org_id: orgId,
    email: trimmed,
    token,
  });
  if (error) throw error;
  // Pending member record so it appears in roster
  await supabase.from("organization_members").insert({
    org_id: orgId,
    invited_email: trimmed,
    role: "pilot",
    status: "invited",
  });
  return token;
}

export async function memberCertSummary(userIds: string[]) {
  if (!userIds.length) return new Map<string, { worst: number | null; expired: number; total: number }>();
  const { data, error } = await supabase
    .from("pilot_certifications")
    .select("user_id, expires_at, recert_confirmed_at")
    .in("user_id", userIds);
  if (error) throw error;
  const map = new Map<string, { worst: number | null; expired: number; total: number }>();
  const now = Date.now();
  for (const row of data ?? []) {
    const prev = map.get(row.user_id) ?? { worst: null, expired: 0, total: 0 };
    const days = Math.ceil((+new Date(row.expires_at) - now) / 86400000);
    prev.total += 1;
    const expiredAndUnconfirmed = days < 0 && !row.recert_confirmed_at;
    if (expiredAndUnconfirmed) prev.expired += 1;
    if (prev.worst == null || days < prev.worst) prev.worst = days;
    map.set(row.user_id, prev);
  }
  return map;
}

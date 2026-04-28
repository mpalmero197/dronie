import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export interface PilotVerification {
  id: string;
  user_id: string;
  legal_first_name: string;
  legal_last_name: string;
  date_of_birth: string | null;
  country: string;
  region: string | null;
  id_type: string;
  id_last4: string;
  part_107_cert_number: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  document_urls: string[];
  pilot_notes: string | null;
  status: VerificationStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const ID_TYPES = [
  "Driver's License",
  "Passport",
  "National ID",
  "State ID",
  "Other Government ID",
] as const;

export const verificationSchema = z.object({
  legal_first_name: z.string().trim().min(1, "Required").max(80),
  legal_last_name: z.string().trim().min(1, "Required").max(80),
  date_of_birth: z.string().optional().nullable(),
  country: z.string().trim().min(2, "Required").max(80),
  region: z.string().trim().max(120).optional().nullable(),
  id_type: z.enum(ID_TYPES, { errorMap: () => ({ message: "Choose an ID type" }) }),
  id_last4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Enter the last 4 digits only"),
  part_107_cert_number: z.string().trim().max(40).optional().nullable(),
  insurance_provider: z.string().trim().max(120).optional().nullable(),
  insurance_policy_number: z.string().trim().max(80).optional().nullable(),
  pilot_notes: z.string().trim().max(800).optional().nullable(),
  document_urls: z.array(z.string().url()).max(8).default([]),
});

export async function getMyLatestVerification(userId: string): Promise<PilotVerification | null> {
  const { data, error } = await supabase
    .from("pilot_verifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as PilotVerification) ?? null;
}

export async function listVerifications(status?: VerificationStatus): Promise<PilotVerification[]> {
  let q = supabase
    .from("pilot_verifications")
    .select("*")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PilotVerification[];
}

export async function reviewVerification(
  id: string,
  decision: "verified" | "rejected",
  adminNotes: string,
  reviewerId: string,
) {
  const { error } = await supabase
    .from("pilot_verifications")
    .update({
      status: decision,
      admin_notes: adminNotes || null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  unverified: "Not submitted",
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
};
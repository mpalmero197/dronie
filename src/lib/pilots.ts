import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { IndustryVertical } from "./marketplace";

export interface PilotProfile {
  id: string;
  user_id: string;
  display_name: string;
  contact_email: string | null;
  phone: string | null;
  bio: string | null;
  years_experience: number;
  hourly_rate_cents: number | null;
  service_area_label: string | null;
  service_lat: number | null;
  service_lng: number | null;
  service_radius_km: number;
  verticals: IndustryVertical[];
  skills: string[];
  equipment: string[];
  part_107: boolean;
  insured: boolean;
  available: boolean;
  portfolio_url: string | null;
  show_on_map: boolean;
  location_privacy: boolean;
  display_lat: number | null;
  display_lng: number | null;
  accepted_terms_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchedPilot {
  pilot_id: string;
  display_name: string;
  service_area_label: string | null;
  distance_km: number | null;
  verticals: IndustryVertical[];
  hourly_rate_cents: number | null;
  years_experience: number;
  part_107: boolean;
  insured: boolean;
  portfolio_url: string | null;
}

export const SKILL_OPTIONS = [
  "Photogrammetry",
  "Aerial photography",
  "Aerial videography",
  "Cinematic editing",
  "Thermal imaging",
  "Multispectral / NDVI",
  "Roof inspection",
  "Tower inspection",
  "Solar inspection",
  "Volumetric surveys",
  "Mapping & GIS",
  "3D / Gaussian splat",
  "Indoor flight",
  "Night operations (waiver)",
];

export const EQUIPMENT_OPTIONS = [
  // DJI — consumer & prosumer
  "DJI Mavic 3",
  "DJI Mavic 3 Pro",
  "DJI Mavic 3 Classic",
  "DJI Mavic 3 Enterprise",
  "DJI Mavic 3 Thermal",
  "DJI Mini 4 Pro",
  "DJI Mini 3 Pro",
  "DJI Air 3",
  "DJI Air 3S",
  "DJI Avata 2",
  // DJI — survey & enterprise
  "DJI Phantom 4 RTK",
  "DJI Matrice 30",
  "DJI Matrice 30T",
  "DJI Matrice 300 RTK",
  "DJI Matrice 350 RTK",
  "DJI Matrice 4E",
  "DJI Matrice 4T",
  "DJI Inspire 3",
  // Autel
  "Autel EVO II Pro",
  "Autel EVO II Dual 640T",
  "Autel EVO Lite+",
  "Autel EVO Max 4T",
  "Autel Dragonfish",
  // Skydio
  "Skydio 2+",
  "Skydio X10",
  "Skydio X2",
  // Parrot
  "Parrot Anafi USA",
  "Parrot Anafi Ai",
  // Yuneec / Freefly / Wingtra
  "Yuneec H520E",
  "Freefly Astro",
  "Freefly Alta X",
  "Wingtra One Gen II",
  "senseFly eBee X",
  // Specialty
  "Custom / FPV rig",
];

export const pilotProfileSchema = z.object({
  display_name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  contact_email: z
    .string()
    .trim()
    .email("Invalid email")
    .max(255)
    .or(z.literal(""))
    .optional(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  bio: z.string().trim().max(800).optional().or(z.literal("")),
  years_experience: z.coerce.number().int().min(0).max(60),
  hourly_rate_cents: z.coerce.number().int().min(0).max(1_000_000).nullable(),
  service_area_label: z.string().trim().max(120).optional().or(z.literal("")),
  service_lat: z.coerce.number().min(-90).max(90).nullable(),
  service_lng: z.coerce.number().min(-180).max(180).nullable(),
  service_radius_km: z.coerce.number().int().min(1).max(2000),
  verticals: z.array(z.string()).max(8),
  skills: z.array(z.string().max(60)).max(20),
  equipment: z.array(z.string().max(60)).max(20),
  part_107: z.boolean(),
  insured: z.boolean(),
  available: z.boolean(),
  portfolio_url: z.string().trim().url("Invalid URL").max(255).or(z.literal("")).optional(),
  show_on_map: z.boolean(),
  location_privacy: z.boolean(),
  accepted_terms: z.boolean().refine((v) => v === true, "You must accept the responsibility notice"),
});

export type PilotProfileInput = z.infer<typeof pilotProfileSchema>;

export async function getMyPilotProfile(userId: string) {
  const { data, error } = await supabase
    .from("pilot_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as PilotProfile | null;
}

export async function findMatchingPilots(requestId: string) {
  const { data, error } = await supabase.rpc("find_matching_pilots", {
    _request_id: requestId,
  });
  if (error) throw error;
  return (data ?? []) as MatchedPilot[];
}
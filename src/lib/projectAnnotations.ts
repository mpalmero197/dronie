import { supabase } from "@/integrations/supabase/client";

export type AnnotationKind = "pin" | "distance" | "area" | "volume" | "rectangle";

export interface ProjectAnnotation {
  id: string;
  project_id: string;
  user_id: string;
  kind: AnnotationKind;
  label: string | null;
  body: string | null;
  geometry: { lat?: number; lng?: number; points?: { lat: number; lng: number }[] };
  measurement: { distance_m?: number; area_m2?: number; volume_m3?: number } | null;
  color: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

export async function listAnnotations(projectId: string): Promise<ProjectAnnotation[]> {
  const { data, error } = await supabase
    .from("project_annotations")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectAnnotation[];
}

export async function createAnnotation(input: Omit<ProjectAnnotation, "id" | "created_at" | "updated_at" | "resolved"> & { resolved?: boolean }) {
  const { data, error } = await supabase
    .from("project_annotations")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectAnnotation;
}

export async function toggleResolved(id: string, resolved: boolean) {
  const { error } = await supabase
    .from("project_annotations")
    .update({ resolved })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAnnotation(id: string) {
  const { error } = await supabase.from("project_annotations").delete().eq("id", id);
  if (error) throw error;
}

/** Haversine distance in meters between two lat/lng pairs. */
export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Shoelace formula on a small lat/lng polygon → square meters. */
export function polygonAreaM2(points: { lat: number; lng: number }[]): number {
  if (points.length < 3) return 0;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const xi = toRad(points[i].lng) * R * Math.cos(toRad(points[i].lat));
    const yi = toRad(points[i].lat) * R;
    const xj = toRad(points[j].lng) * R * Math.cos(toRad(points[j].lat));
    const yj = toRad(points[j].lat) * R;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area) / 2;
}
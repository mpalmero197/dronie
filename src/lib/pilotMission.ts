import { supabase } from "@/integrations/supabase/client";
import type { TrackedPosition } from "@/hooks/useGeolocationTracker";

export type MissionEventType =
  | "mission_start"
  | "mission_end"
  | "takeoff"
  | "landing"
  | "waypoint_reached"
  | "battery_check"
  | "photo_taken"
  | "obstacle"
  | "abort"
  | "note";

export interface MissionEvent {
  id: string;
  job_id: string;
  pilot_id: string;
  event_type: MissionEventType;
  payload: Record<string, unknown>;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  recorded_at: string;
}

export async function logMissionEvent(
  jobId: string,
  pilotId: string,
  eventType: MissionEventType,
  payload: Record<string, unknown> = {},
  position?: TrackedPosition | null,
) {
  const { error } = await supabase.from("mission_logs").insert({
    job_id: jobId,
    pilot_id: pilotId,
    event_type: eventType,
    payload: payload as never,
    latitude: position?.latitude ?? null,
    longitude: position?.longitude ?? null,
    altitude: position?.altitude ?? null,
  });
  if (error) console.warn("logMissionEvent failed", error);
}

export async function recordTrackPoint(
  jobId: string,
  pilotId: string,
  position: TrackedPosition,
) {
  const { error } = await supabase.from("pilot_tracks").insert({
    job_id: jobId,
    pilot_id: pilotId,
    latitude: position.latitude,
    longitude: position.longitude,
    altitude: position.altitude,
    accuracy: position.accuracy,
    heading: position.heading,
    speed: position.speed,
  });
  if (error) console.warn("recordTrackPoint failed", error);
}

/** Haversine in meters */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Bearing from a→b in degrees (0=N, 90=E) */
export function bearingDegrees(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function compassPoint(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight analytics tracker. Fire-and-forget — never blocks UI and
 * silently swallows errors so a failed insert can't break a CTA click.
 *
 * Events land in `public.analytics_events`; only admins can read them
 * (see RLS policies on that table). Anonymous visitors can insert, which
 * is required for marketing-page CTA tracking.
 */
export function track(
  eventName: string,
  properties: Record<string, unknown> = {},
): void {
  try {
    const path =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.hash
        : null;

    void supabase
      .from("analytics_events")
      .insert({
        event_name: eventName,
        path,
        properties: properties as never,
      })
      .then(({ error }) => {
        if (error && import.meta.env.DEV) {
          console.warn("[analytics] insert failed", error.message);
        }
      });
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[analytics] track threw", err);
  }
}
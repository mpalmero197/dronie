import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Props = Record<string, unknown>;

export function useTrack() {
  const { user } = useAuth();
  const track = useCallback(
    async (event_name: string, properties: Props = {}) => {
      try {
        await supabase.from("analytics_events").insert({
          event_name,
          properties: properties as any,
          path: typeof window !== "undefined" ? window.location.pathname : null,
          user_id: user?.id ?? null,
        });
      } catch {
        // analytics is best-effort, never block the UI
      }
    },
    [user?.id]
  );
  return track;
}

/** Mount once at the app root to log a page_view for each route change. */
export function usePageViewTracker() {
  const location = useLocation();
  const track = useTrack();
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    void track("page_view", { search: location.search });
  }, [location.pathname, location.search, track]);
}
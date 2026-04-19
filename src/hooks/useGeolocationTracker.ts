import { useEffect, useRef, useState } from "react";

export interface TrackedPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

interface Options {
  enabled: boolean;
  /** Called for every position update */
  onPosition?: (pos: TrackedPosition) => void;
  /** Throttle DB writes — minimum ms between onPosition calls */
  minIntervalMs?: number;
}

/**
 * Watches the device GPS and emits positions.
 * Uses high-accuracy mode and tolerates permission denial gracefully.
 */
export function useGeolocationTracker({ enabled, onPosition, minIntervalMs = 3000 }: Options) {
  const [position, setPosition] = useState<TrackedPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<"prompt" | "granted" | "denied" | "unknown">("unknown");
  const lastEmittedRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported on this device.");
      return;
    }

    let watchId: number | null = null;

    const start = () => {
      watchId = navigator.geolocation.watchPosition(
        (geo) => {
          const p: TrackedPosition = {
            latitude: geo.coords.latitude,
            longitude: geo.coords.longitude,
            altitude: geo.coords.altitude,
            accuracy: geo.coords.accuracy,
            heading: geo.coords.heading,
            speed: geo.coords.speed,
            timestamp: geo.timestamp,
          };
          setPosition(p);
          setPermission("granted");
          const now = Date.now();
          if (now - lastEmittedRef.current >= minIntervalMs) {
            lastEmittedRef.current = now;
            onPosition?.(p);
          }
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setPermission("denied");
            setError("Location permission denied. Enable it in your browser settings.");
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            setError("Position unavailable. Move outdoors for better GPS.");
          } else {
            setError(err.message);
          }
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
      );
    };

    // Check permission state if supported
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          setPermission(status.state as "granted" | "denied" | "prompt");
          start();
        })
        .catch(() => start());
    } else {
      start();
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { position, error, permission };
}

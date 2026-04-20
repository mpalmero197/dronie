// Best-effort detection of a nearby DJI controller via the local network.
// Browsers can't read SSIDs, so we probe well-known DJI controller IPs.
// Most DJI controllers expose a small HTTP server at 192.168.2.1 or similar.

interface ProbeResult {
  detected: boolean;
  suggestedModel?: string;
  hint: string;
}

const CANDIDATE_HOSTS = [
  "http://192.168.2.1",      // DJI RC / RC 2 / RC Pro
  "http://192.168.42.1",     // Older DJI Wi-Fi drones
  "http://192.168.10.1",     // DJI Tello
];

export async function probeForNearbyDrone(): Promise<ProbeResult> {
  const results = await Promise.all(
    CANDIDATE_HOSTS.map(async (host) => {
      try {
        // Use no-cors so we don't trip CORS — we only care if *something* responds.
        await fetch(host, {
          mode: "no-cors",
          signal: AbortSignal.timeout(1500),
          cache: "no-store",
        });
        return host;
      } catch {
        return null;
      }
    })
  );

  const found = results.find(Boolean);
  if (!found) {
    return {
      detected: false,
      hint: "No drone controller detected on this network. Make sure your phone is connected to the drone's Wi-Fi.",
    };
  }

  // Map the IP to a likely model family
  let suggestedModel = "DJI Drone";
  if (found.includes("192.168.10.1")) suggestedModel = "DJI Tello";
  else if (found.includes("192.168.42.1")) suggestedModel = "DJI (legacy Wi-Fi)";
  else if (found.includes("192.168.2.1")) suggestedModel = "DJI (RC controller)";

  return {
    detected: true,
    suggestedModel,
    hint: `Possible drone controller responding at ${found.replace("http://", "")}. Confirm details below.`,
  };
}

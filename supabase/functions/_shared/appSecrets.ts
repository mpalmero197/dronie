// Helper for edge functions to read an admin-managed encrypted secret.
// Falls back to a process env var with the same name so existing deployments
// keep working until the admin moves the value into the vault.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
const cache = new Map<string, { value: string | null; at: number }>();
const TTL_MS = 60_000;

export async function getAppSecret(name: string): Promise<string | null> {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const envValue = Deno.env.get(name) ?? null;
  let value: string | null = envValue;
  try {
    const { data, error } = await adminClient.rpc("decrypt_app_secret", {
      _name: name,
      _key: SERVICE_ROLE,
    });
    if (!error && typeof data === "string" && data.length > 0) {
      value = data;
    }
  } catch (_e) {
    // fall through to env
  }
  cache.set(name, { value, at: Date.now() });
  return value;
}
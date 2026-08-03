// Shared paid-access guard for edge functions.
// Non-admin users must have an active Stripe subscription to run any
// API-backed / cost-incurring operation.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const cache = new Map<string, { ok: boolean; at: number }>();
const TTL_MS = 60_000;

export interface PaidUser {
  id: string;
  email?: string | null;
}

/** Returns true when the user is an admin or has an active subscription. */
export async function hasPaidAccess(user: PaidUser): Promise<boolean> {
  const hit = cache.get(user.id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ok;

  let ok = false;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if ((roles ?? []).some((r: { role: string }) => r.role === "admin")) {
      ok = true;
    } else if (user.email) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        if (customers.data.length > 0) {
          const subs = await stripe.subscriptions.list({
            customer: customers.data[0].id,
            status: "active",
            limit: 1,
          });
          ok = subs.data.length > 0;
        }
      }
    }
  } catch (error) {
    console.error("[requirePaid] check failed", error instanceof Error ? error.message : error);
    ok = false;
  }

  cache.set(user.id, { ok, at: Date.now() });
  return ok;
}

/** Returns a 402 Response when the user is not entitled, otherwise null. */
export async function requirePaid(
  user: PaidUser,
  headers: Record<string, string>,
): Promise<Response | null> {
  if (await hasPaidAccess(user)) return null;
  return new Response(
    JSON.stringify({
      error: "subscription_required",
      message: "An active DronieApp subscription is required for this feature.",
    }),
    { status: 402, headers: { ...headers, "Content-Type": "application/json" } },
  );
}

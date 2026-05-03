import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) throw new Error("Not authenticated");

    const { data: row } = await admin
      .from("pilot_stripe_accounts")
      .select("stripe_account_id, charges_enabled, payouts_enabled, details_submitted")
      .eq("user_id", user.id)
      .maybeSingle();

    // Pull marketplace payments for this pilot from our DB (source of truth for pilot earnings)
    const { data: payments } = await admin
      .from("marketplace_payments")
      .select("id, request_id, amount_total_cents, amount_pilot_cents, fee_cents, currency, status, created_at, client_id")
      .eq("pilot_id", user.id)
      .order("created_at", { ascending: false });

    const succeeded = (payments || []).filter((p) => p.status === "succeeded" || p.status === "paid");
    const lifetime_pilot_cents = succeeded.reduce((s, p) => s + (p.amount_pilot_cents || 0), 0);
    const lifetime_fee_cents = succeeded.reduce((s, p) => s + (p.fee_cents || 0), 0);
    const lifetime_gross_cents = succeeded.reduce((s, p) => s + (p.amount_total_cents || 0), 0);
    const pending_pilot_cents = (payments || [])
      .filter((p) => p.status === "pending" || p.status === "processing")
      .reduce((s, p) => s + (p.amount_pilot_cents || 0), 0);
    const jobs_count = succeeded.length;

    let balance_available_cents = 0;
    let balance_pending_cents = 0;
    let next_payout: { amount_cents: number; arrival_date: number | null } | null = null;

    if (row?.stripe_account_id && row.charges_enabled) {
      try {
        const balance = await stripe.balance.retrieve({ stripeAccount: row.stripe_account_id });
        balance_available_cents = (balance.available || []).reduce((s: number, b: any) => s + b.amount, 0);
        balance_pending_cents = (balance.pending || []).reduce((s: number, b: any) => s + b.amount, 0);
        const payouts = await stripe.payouts.list({ limit: 1 }, { stripeAccount: row.stripe_account_id });
        if (payouts.data[0]) {
          next_payout = {
            amount_cents: payouts.data[0].amount,
            arrival_date: payouts.data[0].arrival_date,
          };
        }
      } catch (_e) {
        // ignore — account may not be ready
      }
    }

    return new Response(
      JSON.stringify({
        connected: !!row?.stripe_account_id,
        charges_enabled: row?.charges_enabled ?? false,
        payouts_enabled: row?.payouts_enabled ?? false,
        details_submitted: row?.details_submitted ?? false,
        currency: payments?.[0]?.currency || "usd",
        totals: {
          lifetime_pilot_cents,
          lifetime_fee_cents,
          lifetime_gross_cents,
          pending_pilot_cents,
          jobs_count,
        },
        balance: {
          available_cents: balance_available_cents,
          pending_cents: balance_pending_cents,
        },
        next_payout,
        recent: (payments || []).slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
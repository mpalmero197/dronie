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
    const { quote_id } = await req.json();
    if (!quote_id) throw new Error("quote_id required");

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
    const { data: userData, error: uerr } = await supabase.auth.getUser(token);
    if (uerr || !userData.user?.email) throw new Error("Not authenticated");
    const user = userData.user;

    // Load quote + request
    const { data: quote, error: qerr } = await admin
      .from("service_quotes")
      .select("id, request_id, pilot_id, price_cents")
      .eq("id", quote_id)
      .maybeSingle();
    if (qerr || !quote) throw new Error("Quote not found");

    const { data: request, error: rerr } = await admin
      .from("service_requests")
      .select("id, client_id, title")
      .eq("id", quote.request_id)
      .maybeSingle();
    if (rerr || !request) throw new Error("Request not found");
    if (request.client_id !== user.id) throw new Error("Only request owner can pay");

    // Pilot must have active Connect account
    const { data: pilotAcct } = await admin
      .from("pilot_stripe_accounts")
      .select("stripe_account_id, charges_enabled")
      .eq("user_id", quote.pilot_id)
      .maybeSingle();
    if (!pilotAcct?.stripe_account_id || !pilotAcct.charges_enabled) {
      throw new Error("Pilot has not completed payout setup yet. Ask them to finish Stripe onboarding.");
    }

    const pilotAmount = quote.price_cents;
    const fee = Math.max(50, Math.round(pilotAmount * 0.01)); // 1% client connection fee, $0.50 min
    const total = pilotAmount + fee;

    const origin = req.headers.get("origin") || "https://dronieapp.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: request.title,
              description: "Drone job booking via Dronie marketplace",
            },
            unit_amount: pilotAmount,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Dronie connection fee (1%)",
              description: "Platform fee for connecting you with this pilot",
            },
            unit_amount: fee,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: fee,
        transfer_data: { destination: pilotAcct.stripe_account_id },
        metadata: {
          quote_id: quote.id,
          request_id: request.id,
          client_id: user.id,
          pilot_id: quote.pilot_id,
        },
      },
      metadata: {
        quote_id: quote.id,
        request_id: request.id,
      },
      success_url: `${origin}/marketplace/${request.id}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/marketplace/${request.id}?canceled=1`,
    });

    await admin.from("marketplace_payments").insert({
      request_id: request.id,
      quote_id: quote.id,
      client_id: user.id,
      pilot_id: quote.pilot_id,
      amount_pilot_cents: pilotAmount,
      fee_cents: fee,
      amount_total_cents: total,
      stripe_session_id: session.id,
      status: "pending",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
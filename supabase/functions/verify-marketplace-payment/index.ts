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
    const { session_id } = await req.json();
    if (!session_id) throw new Error("session_id required");

    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ paid: false, status: session.payment_status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const quoteId = session.metadata?.quote_id;
    const requestId = session.metadata?.request_id;
    if (!quoteId || !requestId) throw new Error("Missing metadata");

    // Verify the caller is the request's owning client
    const { data: reqRow } = await admin
      .from("service_requests")
      .select("client_id")
      .eq("id", requestId)
      .maybeSingle();
    if (!reqRow || reqRow.client_id !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark payment paid
    await admin
      .from("marketplace_payments")
      .update({
        status: "paid",
        stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      })
      .eq("stripe_session_id", session_id);

    // Now actually accept the quote and assign the request
    const { data: quote } = await admin
      .from("service_quotes")
      .select("pilot_id")
      .eq("id", quoteId)
      .maybeSingle();

    await admin
      .from("service_quotes")
      .update({ status: "accepted", payment_status: "paid" })
      .eq("id", quoteId);

    if (quote?.pilot_id) {
      await admin
        .from("service_requests")
        .update({ status: "assigned", assigned_pilot_id: quote.pilot_id })
        .eq("id", requestId);
    }

    return new Response(JSON.stringify({ paid: true }), {
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
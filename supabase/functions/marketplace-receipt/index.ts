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
    const { request_id, session_id } = await req.json();
    if (!request_id) throw new Error("request_id required");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: request } = await admin
      .from("service_requests")
      .select("*")
      .eq("id", request_id)
      .maybeSingle();
    if (!request) throw new Error("Request not found");

    // Find payment: by session_id if provided, else latest for this request involving caller
    let paymentQuery = admin
      .from("marketplace_payments")
      .select("*")
      .eq("request_id", request_id)
      .order("created_at", { ascending: false });
    if (session_id) paymentQuery = paymentQuery.eq("stripe_session_id", session_id);

    const { data: payments } = await paymentQuery;
    const payment = (payments ?? []).find(
      (p: any) => p.client_id === callerId || p.pilot_id === callerId
    ) ?? null;

    if (!payment && request.client_id !== callerId && request.assigned_pilot_id !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let quote: any = null;
    if (payment?.quote_id) {
      const { data: q } = await admin
        .from("service_quotes")
        .select("*")
        .eq("id", payment.quote_id)
        .maybeSingle();
      quote = q;
    }

    let stripeSession: any = null;
    let stripePaymentIntent: any = null;
    if (payment?.stripe_session_id) {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });
      try {
        const s = await stripe.checkout.sessions.retrieve(payment.stripe_session_id);
        stripeSession = {
          id: s.id,
          status: s.status,
          payment_status: s.payment_status,
          amount_total: s.amount_total,
          currency: s.currency,
          customer_email: s.customer_details?.email ?? s.customer_email ?? null,
          created: s.created,
        };
        if (typeof s.payment_intent === "string") {
          try {
            const pi = await stripe.paymentIntents.retrieve(s.payment_intent);
            stripePaymentIntent = {
              id: pi.id,
              status: pi.status,
              amount: pi.amount,
              currency: pi.currency,
              receipt_email: pi.receipt_email,
              created: pi.created,
            };
          } catch (_) {}
        }
      } catch (_) {}
    }

    return new Response(
      JSON.stringify({ request, quote, payment, stripe_session: stripeSession, stripe_payment_intent: stripePaymentIntent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
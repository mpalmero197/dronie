import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin using their JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Check admin role
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin access required");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (req.method === "GET") {
      // List all users with their roles and profiles
      const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 500 });
      if (listError) throw listError;

      const { data: allRoles } = await adminClient
        .from("user_roles")
        .select("user_id, role");

      const { data: allProfiles } = await adminClient
        .from("profiles")
        .select("id, full_name, avatar_url, username, headline, portfolio_published, account_type, available_for_hire");

      const { data: projectCounts } = await adminClient
        .from("projects")
        .select("user_id");

      const projectCountMap: Record<string, number> = {};
      (projectCounts || []).forEach((p: any) => {
        projectCountMap[p.user_id] = (projectCountMap[p.user_id] || 0) + 1;
      });

      const rolesMap: Record<string, string[]> = {};
      (allRoles || []).forEach((r: any) => {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r.role);
      });

      const profilesMap: Record<string, any> = {};
      (allProfiles || []).forEach((p: any) => {
        profilesMap[p.id] = p;
      });

      // Subscription lookup via Stripe (one paginated scan)
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      const subMap: Record<string, { product_id: string | null; status: string; current_period_end: string | null }> = {};
      if (stripeKey) {
        try {
          const Stripe = (await import("https://esm.sh/stripe@18.5.0")).default;
          const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
          const subs = await stripe.subscriptions.list({
            status: "active",
            limit: 100,
            expand: ["data.customer"],
          });
          for (const sub of subs.data) {
            const customer: any = sub.customer;
            const email = customer?.email;
            if (!email) continue;
            subMap[email.toLowerCase()] = {
              product_id: (sub.items.data[0]?.price.product as string) ?? null,
              status: sub.status,
              current_period_end: sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null,
            };
          }
        } catch (e) {
          console.error("[admin-users] stripe fetch failed", e);
        }
      }

      const result = users.map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: profilesMap[u.id]?.full_name || null,
        avatar_url: profilesMap[u.id]?.avatar_url || null,
        username: profilesMap[u.id]?.username || null,
        headline: profilesMap[u.id]?.headline || null,
        portfolio_published: profilesMap[u.id]?.portfolio_published || false,
        account_type: profilesMap[u.id]?.account_type || null,
        available_for_hire: profilesMap[u.id]?.available_for_hire ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        roles: rolesMap[u.id] || [],
        project_count: projectCountMap[u.id] || 0,
        subscription: u.email ? subMap[u.email.toLowerCase()] || null : null,
      }));

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const { action, user_id, role } = await req.json();

      if (!user_id || !role || !["admin", "pilot", "viewer"].includes(role)) {
        throw new Error("Invalid user_id or role");
      }

      if (action === "add_role") {
        const { error } = await adminClient
          .from("user_roles")
          .upsert({ user_id, role }, { onConflict: "user_id,role" });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "remove_role") {
        // Prevent removing your own admin role
        if (user_id === user.id && role === "admin") {
          throw new Error("Cannot remove your own admin role");
        }
        const { error } = await adminClient
          .from("user_roles")
          .delete()
          .eq("user_id", user_id)
          .eq("role", role);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "set_role") {
        // Replace all roles with a single new role
        if (user_id === user.id && role !== "admin") {
          throw new Error("Cannot demote yourself from admin");
        }
        await adminClient
          .from("user_roles")
          .delete()
          .eq("user_id", user_id);
        const { error } = await adminClient
          .from("user_roles")
          .insert({ user_id, role });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error("Invalid action");
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

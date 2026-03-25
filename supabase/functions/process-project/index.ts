import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub;

  const { project_id } = await req.json();
  if (!project_id) {
    return new Response(JSON.stringify({ error: "project_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify user owns the project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id, status")
    .eq("id", project_id)
    .single();

  if (projectError || !project) {
    return new Response(JSON.stringify({ error: "Project not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (project.user_id !== userId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (project.status === "processing") {
    return new Response(JSON.stringify({ error: "Already processing" }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use service role to bypass RLS for background updates
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Mark as processing
  await serviceClient
    .from("projects")
    .update({ status: "processing", progress: 0 })
    .eq("id", project_id);

  // Start background processing (don't await — respond immediately)
  EdgeRuntime.waitUntil(runProcessing(serviceClient, project_id));

  return new Response(JSON.stringify({ success: true, message: "Processing started" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function runProcessing(serviceClient: ReturnType<typeof createClient>, projectId: string) {
  const steps = [
    { label: "Image alignment", progress: 20, delay: 3000 },
    { label: "Dense point cloud", progress: 42, delay: 4000 },
    { label: "Mesh generation", progress: 58, delay: 3500 },
    { label: "Orthomosaic", progress: 74, delay: 4000 },
    { label: "DSM / DTM", progress: 88, delay: 3000 },
    { label: "Contour extraction", progress: 95, delay: 2500 },
    { label: "Final export", progress: 100, delay: 2000 },
  ];

  for (const step of steps) {
    await sleep(step.delay);
    await serviceClient
      .from("projects")
      .update({ progress: step.progress })
      .eq("id", projectId);
  }

  await sleep(1000);

  const area = (Math.random() * 80 + 5).toFixed(1);

  await serviceClient
    .from("projects")
    .update({
      status: "complete",
      progress: 100,
      outputs: ["GeoTIFF", "LAZ Point Cloud", "DSM", "DTM", "Contours SHP", "Flight Report PDF"],
      area_ha: parseFloat(area),
    })
    .eq("id", projectId);
}

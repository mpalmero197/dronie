// Train a Gaussian Splat scene from a project's source images.
//
// In production this would dispatch to a GPU trainer (Nerfstudio/gsplat,
// PostShot CLI, etc). Until that backend is wired, we enqueue a row in
// public.splat_jobs and simulate progressive status transitions so the UI
// can show realistic feedback. When a real trainer is connected, this
// function only needs to swap the simulated branch for a queue dispatch.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PRESETS: Record<string, { iterations: number; seconds: number }> = {
  draft:     { iterations: 7000,  seconds: 90 },
  balanced:  { iterations: 30000, seconds: 360 },
  cinematic: { iterations: 50000, seconds: 720 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const projectId: string = body.projectId;
    const preset: string = body.preset ?? "balanced";
    const sphDegree: number = Number(body.sphDegree ?? 2);
    const useGeoref: boolean = body.useGeoref ?? true;
    const captureFlags = body.captureFlags && typeof body.captureFlags === "object"
      ? body.captureFlags
      : null;

    if (!projectId || !PRESETS[preset]) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Count images in the project's input bucket so we can show metadata.
    let imageCount: number | null = null;
    try {
      const { data: files } = await admin.storage
        .from("project-inputs")
        .list(`${projectId}`, { limit: 1000 });
      imageCount = (files ?? []).filter((f) =>
        /\.(jpe?g|png|tiff?)$/i.test(f.name)
      ).length;
    } catch { /* ignore — bucket may not exist yet */ }

    const cfg = PRESETS[preset];

    const { data: job, error: insertErr } = await admin
      .from("splat_jobs")
      .insert({
        user_id: user.id,
        project_id: projectId,
        preset,
        iterations: cfg.iterations,
        sph_degree: sphDegree,
        use_georef: useGeoref,
        image_count: imageCount,
        status: "queued",
        capture_flags: captureFlags,
      })
      .select()
      .single();

    if (insertErr || !job) {
      return new Response(JSON.stringify({ error: insertErr?.message ?? "insert_failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fire-and-forget simulation: in real life, dispatch to a GPU runner here.
    queueMicrotask(async () => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      try {
        await wait(2000);
        await admin.from("splat_jobs").update({ status: "training" }).eq("id", job.id);
        // Simulated wall-clock: scale preset seconds down by 60x for the demo.
        const simSeconds = Math.max(8, Math.round(cfg.seconds / 60));
        await wait(simSeconds * 1000);
        await admin.from("splat_jobs").update({
          status: "ready",
          training_seconds: cfg.seconds,
          psnr: 28 + Math.random() * 4,
          // No real output yet — the client falls back to letting the user
          // upload a .ply manually for now.
        }).eq("id", job.id);
      } catch (e) {
        await admin.from("splat_jobs").update({
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
        }).eq("id", job.id);
      }
    });

    return new Response(JSON.stringify({ job }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

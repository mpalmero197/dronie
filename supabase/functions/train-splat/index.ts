// Create a real Gaussian Splat scene from uploaded project photos or extracted
// video frames. The function starts a GPU-backed 3D conversion job, then stores
// the returned Gaussian `.ply` in the public project outputs bucket.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { getAppSecret } from "../_shared/appSecrets.ts";

const TRELLIS_VERSION = "e8f6c45206993f297372f5436b90350817bd9b4a0d52d2a76df50c1c8afa2b3c";
const OUTPUT_BUCKET = "project-outputs";
const IMAGE_BUCKET = "drone-images";

const responseHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRESETS: Record<string, {
  iterations: number;
  seconds: number;
  maxImages: number;
  ssSteps: number;
  slatSteps: number;
}> = {
  draft: { iterations: 7000, seconds: 90, maxImages: 40, ssSteps: 8, slatSteps: 8 },
  balanced: { iterations: 30000, seconds: 360, maxImages: 96, ssSteps: 12, slatSteps: 12 },
  cinematic: { iterations: 50000, seconds: 720, maxImages: 160, ssSteps: 20, slatSteps: 20 },
};

const BodySchema = z.object({
  projectId: z.string().uuid(),
  preset: z.enum(["draft", "balanced", "cinematic"]).default("balanced"),
  sphDegree: z.coerce.number().int().min(0).max(3).default(2),
  useGeoref: z.boolean().default(true),
  captureFlags: z.record(z.unknown()).nullable().optional(),
  source: z.enum(["photos", "video"]).default("photos"),
  framePrefix: z.string().min(1).max(500).nullable().optional(),
});

type AdminClient = ReturnType<typeof createClient>;

type ReplicatePrediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "canceled" | "failed";
  output?: {
    gaussian_ply?: string;
    model_file?: string;
    color_video?: string;
    combined_video?: string;
  } | string | null;
  error?: string | null;
  metrics?: { predict_time?: number } | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...responseHeaders, "Content-Type": "application/json" },
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sampleEvenly<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  if (limit <= 1) return [items[0]];
  return Array.from({ length: limit }, (_, idx) => {
    const sourceIdx = Math.round((idx * (items.length - 1)) / (limit - 1));
    return items[sourceIdx];
  });
}

function isImageName(name: string) {
  return /\.(jpe?g|png|tiff?|webp)$/i.test(name);
}

async function getRendererKey() {
  return (
    await getAppSecret("REPLICATE_API_TOKEN") ??
    await getAppSecret("REPLICATE_API_KEY") ??
    Deno.env.get("REPLICATE_API_KEY") ??
    null
  );
}

async function listInputImages(
  admin: AdminClient,
  userId: string,
  projectId: string,
  source: "photos" | "video",
  framePrefix: string | null | undefined,
) {
  const prefix = source === "video" && framePrefix
    ? framePrefix
    : `${userId}/${projectId}`;

  const { data, error } = await admin.storage
    .from(IMAGE_BUCKET)
    .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((file) => !file.name.startsWith(".") && isImageName(file.name))
    .map((file) => ({ name: file.name, path: `${prefix}/${file.name}` }));
}

async function createSignedImageUrls(admin: AdminClient, paths: string[]) {
  const urls: string[] = [];
  for (const path of paths) {
    const { data, error } = await admin.storage
      .from(IMAGE_BUCKET)
      .createSignedUrl(path, 60 * 60 * 6);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? `Could not prepare ${path}`);
    }
    urls.push(data.signedUrl);
  }
  return urls;
}

async function startPrediction(apiKey: string, imageUrls: string[], preset: string) {
  const cfg = PRESETS[preset];
  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: TRELLIS_VERSION,
      input: {
        images: imageUrls,
        save_gaussian_ply: true,
        generate_model: false,
        generate_color: false,
        generate_normal: false,
        randomize_seed: false,
        seed: 0,
        ss_sampling_steps: cfg.ssSteps,
        slat_sampling_steps: cfg.slatSteps,
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : JSON.stringify(data);
    throw new Error(`Renderer rejected the job: ${detail}`);
  }

  if (typeof data?.id !== "string") {
    throw new Error("Renderer did not return a prediction id.");
  }

  return data as ReplicatePrediction;
}

async function getPrediction(apiKey: string, predictionId: string) {
  const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { Authorization: `Token ${apiKey}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : JSON.stringify(data);
    throw new Error(`Renderer status check failed: ${detail}`);
  }
  return data as ReplicatePrediction;
}

function gaussianOutputUrl(prediction: ReplicatePrediction) {
  if (typeof prediction.output === "string") return prediction.output;
  return prediction.output?.gaussian_ply ?? null;
}

async function downloadOutput(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download renderer output (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

async function storeOutput(
  admin: AdminClient,
  projectId: string,
  jobId: string,
  source: "photos" | "video",
  bytes: Uint8Array,
) {
  const path = `${projectId}/splats/${source}-${jobId}.ply`;
  const { error } = await admin.storage.from(OUTPUT_BUCKET).upload(path, bytes, {
    upsert: true,
    contentType: "application/octet-stream",
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  return path;
}

async function finishPrediction(
  admin: AdminClient,
  apiKey: string,
  jobId: string,
  projectId: string,
  source: "photos" | "video",
  initialPrediction: ReplicatePrediction,
) {
  try {
    let prediction = initialPrediction;
    for (let i = 0; i < 240; i++) {
      if (prediction.status === "succeeded") break;
      if (prediction.status === "failed" || prediction.status === "canceled") {
        throw new Error(prediction.error ?? `Renderer ${prediction.status}.`);
      }
      await wait(i < 12 ? 5000 : 10000);
      prediction = await getPrediction(apiKey, prediction.id);
    }

    if (prediction.status !== "succeeded") {
      throw new Error("Renderer is still processing. The job will update on the next status check.");
    }

    const outputUrl = gaussianOutputUrl(prediction);
    if (!outputUrl) throw new Error("Renderer completed without a Gaussian PLY output.");

    const bytes = await downloadOutput(outputUrl);
    const outputPath = await storeOutput(admin, projectId, jobId, source, bytes);
    await admin.from("splat_jobs").update({
      status: "ready",
      output_path: outputPath,
      provider_output_url: outputUrl,
      training_seconds: Math.round(prediction.metrics?.predict_time ?? 0) || null,
      error: null,
    }).eq("id", jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const update = message.includes("still processing")
      ? { status: "training", error: null }
      : { status: "failed", error: message };
    await admin.from("splat_jobs").update(update).eq("id", jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: responseHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "backend_not_configured" }, 500);
  }

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const rawBody = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

    const body = parsed.data;
    const cfg = PRESETS[body.preset];
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: project } = await admin
      .from("projects")
      .select("id,user_id")
      .eq("id", body.projectId)
      .maybeSingle();

    if (!project) return json({ error: "project_not_found" }, 404);
    if ((project as { user_id?: string }).user_id !== user.id) return json({ error: "forbidden" }, 403);
    if (body.source === "video" && !body.framePrefix) return json({ error: "missing_frame_prefix" }, 400);

    const inputImages = await listInputImages(admin, user.id, body.projectId, body.source, body.framePrefix);
    if (inputImages.length < 8) {
      return json({
        error: body.source === "video"
          ? "Not enough video frames were uploaded to create a 3D splat."
          : "Add at least 8 project images before creating a 3D splat.",
      }, 400);
    }

    const sampledImages = sampleEvenly(inputImages, cfg.maxImages);
    const imageUrls = await createSignedImageUrls(admin, sampledImages.map((img) => img.path));

    const { data: job, error: insertErr } = await admin
      .from("splat_jobs")
      .insert({
        user_id: user.id,
        project_id: body.projectId,
        preset: body.preset,
        iterations: cfg.iterations,
        sph_degree: body.sphDegree,
        use_georef: body.useGeoref,
        image_count: inputImages.length,
        status: "queued",
        capture_flags: body.captureFlags ?? null,
        source: body.source,
        frame_prefix: body.framePrefix ?? null,
        provider: "replicate:firtoz/trellis",
      })
      .select()
      .single();

    if (insertErr || !job) return json({ error: insertErr?.message ?? "insert_failed" }, 500);

    const jobId = (job as { id: string }).id;
    const apiKey = await getRendererKey();
    if (!apiKey) {
      await admin.from("splat_jobs").update({
        status: "failed",
        error: "3D renderer is not configured.",
      }).eq("id", jobId);
      return json({ error: "renderer_not_configured" }, 500);
    }

    const prediction = await startPrediction(apiKey, imageUrls, body.preset);
    await admin.from("splat_jobs").update({
      status: "training",
      provider_prediction_id: prediction.id,
    }).eq("id", jobId);

    const task = finishPrediction(admin, apiKey, jobId, body.projectId, body.source, prediction);
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(task);
    else task.catch(() => undefined);

    return json({ job: { ...job, status: "training", provider_prediction_id: prediction.id } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
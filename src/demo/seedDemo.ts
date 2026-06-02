import { supabase } from "@/integrations/supabase/client";

const DEMO_NAME = "Demo \u2014 Riverside Quarry";
const DEMO_MARK = "__dronie_demo__";

// Public sample assets already present in the project-outputs bucket
const SAMPLE_PREFIX = "461d1d20-efbc-47f2-96bd-5778e4cbe4d1/0ad955e2-55fe-4153-bac2-2341d9b65ed2";

function publicUrl(path: string) {
  return supabase.storage.from("project-outputs").getPublicUrl(path).data.publicUrl;
}

function sampleUrls() {
  return {
    orthomosaic: publicUrl(`${SAMPLE_PREFIX}/orthomosaic.png`),
    dsm: publicUrl(`${SAMPLE_PREFIX}/dsm.asc`),
    dtm: publicUrl(`${SAMPLE_PREFIX}/dtm.asc`),
    contours: publicUrl(`${SAMPLE_PREFIX}/contours.geojson`),
    flight_report: publicUrl(`${SAMPLE_PREFIX}/flight_report.pdf`),
  };
}

/** Get or create the user's demo project. Returns its id. */
export async function ensureDemoProject(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  // Look for an existing demo project for this user
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", user.id)
    .eq("description", DEMO_MARK)
    .maybeSingle();

  if (existing?.id) {
    // Reset its processing state so the demo replays from the top
    await supabase.from("projects").update({
      status: "processing",
      progress: 0,
      current_stage: null,
      stage_progress: 0,
      stage_log: [],
      outputs: [],
      outputs_urls: {},
      eta_seconds: 1200,
      stage_started_at: new Date().toISOString(),
    }).eq("id", existing.id);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: DEMO_NAME,
      description: DEMO_MARK,
      status: "processing",
      progress: 0,
      area_ha: 12.4,
      image_count: 184,
      processing_settings: { demo: true },
      stage_log: [],
      outputs: [],
      outputs_urls: {},
      eta_seconds: 1200,
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

const STAGES: { key: string; label: string; threshold: number }[] = [
  { key: "alignment", label: "Feature matching", threshold: 18 },
  { key: "pointcloud", label: "Dense point cloud", threshold: 38 },
  { key: "mesh", label: "Mesh reconstruction", threshold: 56 },
  { key: "ortho", label: "Orthomosaic", threshold: 74 },
  { key: "dsm", label: "DSM / DTM", threshold: 88 },
  { key: "contours", label: "Contours", threshold: 96 },
  { key: "export", label: "Packaging deliverables", threshold: 100 },
];

let processingTimer: number | null = null;

/** Animate processing progress over ~20 seconds via DB updates. */
export async function animateProcessing(projectId: string) {
  if (processingTimer) {
    window.clearInterval(processingTimer);
    processingTimer = null;
  }

  await supabase.from("projects").update({
    status: "processing",
    progress: 0,
    current_stage: STAGES[0].key,
    stage_progress: 0,
    stage_started_at: new Date().toISOString(),
    stage_log: [{ ts: new Date().toISOString(), level: "info", message: "Demo: pipeline started" }],
    outputs: [],
    outputs_urls: {},
  }).eq("id", projectId);

  let progress = 0;
  const tickMs = 500;
  const incPerTick = 3; // ~20s to reach 100
  const log: Array<{ ts: string; level: string; message: string }> = [];

  processingTimer = window.setInterval(async () => {
    progress = Math.min(100, progress + incPerTick);
    const stage = STAGES.find((s) => progress <= s.threshold) ?? STAGES[STAGES.length - 1];
    const prevStage = log.length ? log[log.length - 1].message : "";
    if (!prevStage.includes(stage.label)) {
      log.push({
        ts: new Date().toISOString(),
        level: "info",
        message: `Stage: ${stage.label}`,
      });
    }
    await supabase.from("projects").update({
      progress,
      current_stage: stage.key,
      stage_progress: Math.min(100, ((progress - (STAGES[STAGES.findIndex(s=>s.key===stage.key)-1]?.threshold ?? 0)) /
        ((stage.threshold - (STAGES[STAGES.findIndex(s=>s.key===stage.key)-1]?.threshold ?? 0)) || 1)) * 100),
      stage_log: log.slice(-50),
      eta_seconds: Math.max(0, Math.round((100 - progress) * 0.2)),
    }).eq("id", projectId);

    if (progress >= 100 && processingTimer) {
      window.clearInterval(processingTimer);
      processingTimer = null;
    }
  }, tickMs);
}

/** Mark the demo project complete with sample deliverables. */
export async function completeProject(projectId: string) {
  if (processingTimer) {
    window.clearInterval(processingTimer);
    processingTimer = null;
  }
  const urls = sampleUrls();
  await supabase.from("projects").update({
    status: "complete",
    progress: 100,
    current_stage: "export",
    stage_progress: 100,
    eta_seconds: 0,
    outputs: ["Orthomosaic", "DSM", "DTM", "Contours", "Flight Report"],
    outputs_urls: urls,
    accuracy_report: {
      summary: "Demo accuracy report",
      rmse_xy_cm: 2.4,
      rmse_z_cm: 3.1,
      gcp_count: 6,
      gsd_cm: 1.8,
    },
    stage_log: [
      { ts: new Date().toISOString(), level: "info", message: "Processing complete \u2014 deliverables ready" },
    ],
  }).eq("id", projectId);
}

export function stopDemoTimers() {
  if (processingTimer) {
    window.clearInterval(processingTimer);
    processingTimer = null;
  }
}

/* ------------------------------------------------------------------ */
/*  Extra cinematic side-effects used by the expanded demo steps.      */
/* ------------------------------------------------------------------ */

let captureTimer: number | null = null;

/** Simulate image capture progress during the "Fly" step. */
export async function animateCapture(projectId: string) {
  if (captureTimer) {
    window.clearInterval(captureTimer);
    captureTimer = null;
  }
  let captured = 0;
  const target = 184;
  await supabase.from("projects").update({
    image_count: 0,
    stage_log: [{ ts: new Date().toISOString(), level: "info", message: "Demo: drone armed, mission start" }],
  }).eq("id", projectId);

  captureTimer = window.setInterval(async () => {
    captured = Math.min(target, captured + 12);
    await supabase.from("projects").update({
      image_count: captured,
    }).eq("id", projectId);
    if (captured >= target && captureTimer) {
      window.clearInterval(captureTimer);
      captureTimer = null;
    }
  }, 600);
}

/** Seed a Gaussian Splat job record for the splat reveal step. */
export async function seedSplatJob(projectId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Best-effort — table may not exist in every environment. Failures are silent.
    await supabase.from("splat_jobs" as any).insert({
      user_id: user.id,
      project_id: projectId,
      name: "Demo — Riverside Quarry splat",
      status: "ready",
      iterations: 30000,
      image_count: 184,
    } as any);
  } catch {
    /* no-op */
  }
}

/** Touch the project so it surfaces as a fresh portfolio moment. */
export async function publishPortfolioMoment(projectId: string) {
  try {
    await supabase.from("projects").update({
      updated_at: new Date().toISOString(),
    } as any).eq("id", projectId);
  } catch {
    /* no-op */
  }
}

/** Cancel every demo background timer. */
export function stopAllDemoTimers() {
  stopDemoTimers();
  if (captureTimer) {
    window.clearInterval(captureTimer);
    captureTimer = null;
  }
}
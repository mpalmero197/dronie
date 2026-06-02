import { animateProcessing, completeProject, animateCapture, seedSplatJob, publishPortfolioMoment } from "./seedDemo";

export type DemoStepContext = { projectId: string };

export type DemoStep = {
  id: string;
  title: string;
  caption: string;
  chapter: string;
  highlights?: string[];
  route: (projectId: string) => string;
  durationMs: number;
  onEnter?: (ctx: DemoStepContext) => Promise<void>;
};

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "plan",
    title: "Plan the mission",
    chapter: "Plan",
    caption: "Draw the area of interest, dial in altitude and overlap. Dronie solves for flight time, image count, GSD and battery splits in real time as you adjust.",
    highlights: ["Terrain-following grid", "Battery auto-split", "Live GSD & area readout"],
    route: () => "/plan",
    durationMs: 14000,
  },
  {
    id: "export",
    title: "Export to the controller",
    chapter: "Plan",
    caption: "One click exports a KMZ waypoint mission to DJI Fly, Litchi, or UgCS. Open it on the controller and the drone takes over autonomous flight.",
    highlights: ["KMZ / CSV / Litchi export", "Per-waypoint actions", "Pre-flight checklist baked in"],
    route: () => "/missions",
    durationMs: 9000,
  },
  {
    id: "fly",
    title: "Fly with live telemetry",
    chapter: "Fly",
    caption: "Watch the drone follow the planned grid. Live battery, link quality, RTK fix, gimbal feed and command history stream into the ops center.",
    highlights: ["1Hz telemetry to black box", "Live camera & gimbal", "Multi-pilot handoff"],
    route: () => "/fleet",
    durationMs: 11000,
    onEnter: async ({ projectId }) => { await animateCapture(projectId); },
  },
  {
    id: "complete",
    title: "Mission complete — images synced",
    chapter: "Fly",
    caption: "When the drone lands, captured images sync straight to Dronie. An image QA pass flags blur, exposure and coverage gaps before processing burns a credit.",
    highlights: ["184 images / 12.4 ha", "Auto blur + exposure QA", "Overlap heatmap"],
    route: () => "/dashboard",
    durationMs: 9000,
  },
  {
    id: "process",
    title: "Cloud processing pipeline",
    chapter: "Process",
    caption: "Watch every stage stream live: feature matching, dense reconstruction, mesh, orthomosaic, DSM and contours. No installs, no GPU rental \u2014 just the browser.",
    highlights: ["WebODM pipeline", "Survey-grade preset", "ETA + stage log"],
    route: (pid) => `/project/${pid}`,
    durationMs: 22000,
    onEnter: async ({ projectId }) => { await animateProcessing(projectId); },
  },
  {
    id: "deliver",
    title: "Survey-grade deliverables",
    chapter: "Deliver",
    caption: "GeoTIFF orthomosaic, DSM/DTM, point cloud, contour lines and an annotated PDF report. Pin notes, measure stockpile volume, compare versions with a before/after slider.",
    highlights: ["RMSE 2.4 cm / GSD 1.8 cm", "Annotated PDF report", "Before / after compare"],
    route: (pid) => `/project/${pid}`,
    durationMs: 16000,
    onEnter: async ({ projectId }) => { await completeProject(projectId); },
  },
  {
    id: "splat",
    title: "Gaussian Splat reveal",
    chapter: "Deliver",
    caption: "Spin up a 3D Gaussian Splat from the same imagery. Share a branded viewer or drop the embed into any site \u2014 no plugins, no downloads.",
    highlights: ["Cloud-trained splats", "Token-gated share links", "Embed anywhere"],
    route: () => "/splats",
    durationMs: 11000,
    onEnter: async ({ projectId }) => { await seedSplatJob(projectId); },
  },
  {
    id: "share",
    title: "Share with the client",
    chapter: "Deliver",
    caption: "Generate a revocable share link with view, comment or download permissions and an expiry date. The client sees a branded viewer with only the deliverables you picked.",
    highlights: ["Per-deliverable permissions", "Expiry + view counter", "Branded share viewer"],
    route: (pid) => `/project/${pid}`,
    durationMs: 9000,
  },
  {
    id: "portfolio",
    title: "Publish to your portfolio",
    chapter: "Grow",
    caption: "Promote the best frame to a cinematic public portfolio at /u/your-handle. Scrollytelling reels, SEO, OG cards and hire-me inquiries \u2014 all generated automatically.",
    highlights: ["Cinematic scrollytelling", "OG + JSON-LD per item", "Hire-me inquiry inbox"],
    route: () => "/portfolio",
    durationMs: 10000,
    onEnter: async ({ projectId }) => { await publishPortfolioMoment(projectId); },
  },
  {
    id: "marketplace",
    title: "Win the next job",
    chapter: "Grow",
    caption: "The marketplace ranks pilots by distance, verticals, response time and reviews. Escrow via Stripe Connect protects both sides through milestones.",
    highlights: ["Verified pilot badges", "Milestone escrow", "Realtime messaging"],
    route: () => "/marketplace",
    durationMs: 9000,
  },
];
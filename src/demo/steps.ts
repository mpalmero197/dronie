import { animateProcessing, completeProject } from "./seedDemo";

export type DemoStepContext = { projectId: string };

export type DemoStep = {
  id: string;
  title: string;
  caption: string;
  route: (projectId: string) => string;
  durationMs: number;
  onEnter?: (ctx: DemoStepContext) => Promise<void>;
};

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "plan",
    title: "1. Plan the mission",
    caption: "Draw the area of interest, set altitude and overlap. Dronie computes flight time, image count, and ground sampling distance in real time.",
    route: () => "/plan",
    durationMs: 12000,
  },
  {
    id: "export",
    title: "2. Export to DJI Fly",
    caption: "One click exports a KMZ waypoint mission. Open it on the controller and DJI Fly takes over autonomous flight.",
    route: () => "/missions",
    durationMs: 10000,
  },
  {
    id: "fly",
    title: "3. Fly the mission",
    caption: "The drone follows the planned grid while you monitor live telemetry, battery, and the camera feed from the fleet view.",
    route: () => "/fleet",
    durationMs: 10000,
  },
  {
    id: "complete",
    title: "4. Mission complete",
    caption: "When the drone lands, the captured images sync to Dronie and a new processing project appears in your dashboard.",
    route: () => "/dashboard",
    durationMs: 8000,
  },
  {
    id: "process",
    title: "5. Cloud processing",
    caption: "Watch each stage run: feature matching, dense reconstruction, mesh, orthomosaic, DSM and contours \u2014 all in the browser.",
    route: (pid) => `/project/${pid}`,
    durationMs: 22000,
    onEnter: async ({ projectId }) => { await animateProcessing(projectId); },
  },
  {
    id: "deliver",
    title: "6. Deliverables",
    caption: "Georeferenced orthomosaic, DSM, contours and a flight report \u2014 ready to download, share, or open in the map viewer.",
    route: (pid) => `/project/${pid}`,
    durationMs: 20000,
    onEnter: async ({ projectId }) => { await completeProject(projectId); },
  },
];
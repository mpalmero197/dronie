import { describe, it, expect } from "vitest";
import { estimateFramePlan } from "@/lib/splatVideoIngest";

describe("estimateFramePlan", () => {
  it("20s 1080p → draft preset with modest frame count", () => {
    const p = estimateFramePlan(20, 1920, 1080);
    expect(p.preset).toBe("draft");
    expect(p.frames).toBeGreaterThanOrEqual(40);
    expect(p.frames).toBeLessThan(120);
  });

  it("120s 4K → cinematic preset with dense frame count", () => {
    const p = estimateFramePlan(120, 3840, 2160);
    expect(p.preset).toBe("cinematic");
    expect(p.frames).toBeGreaterThan(320);
    expect(p.frames).toBeLessThanOrEqual(900);
  });

  it("60s 1080p → balanced preset", () => {
    const p = estimateFramePlan(60, 1920, 1080);
    expect(p.preset).toBe("balanced");
  });

  it("clamps floor for very short clips", () => {
    const p = estimateFramePlan(4, 640, 480);
    expect(p.frames).toBeGreaterThanOrEqual(40);
  });
});
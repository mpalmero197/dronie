/**
 * Time math for the editor timeline: mapping between global timeline seconds
 * and clip-local source seconds, snapping, and zoom helpers.
 */
import { AudioTrack, Clip, EditorProject, clipLength, clipStartGlobal, totalDuration } from "./types";

export const MIN_PX_PER_SEC = 6;
export const MAX_PX_PER_SEC = 320;
export const DEFAULT_PX_PER_SEC = 48;
/** Snap tolerance in pixels; converted to seconds using the current zoom. */
export const SNAP_PX = 8;

export interface ClipPlacement {
  index: number;
  clip: Clip;
  startS: number;
  endS: number;
}

export function clipPlacements(p: EditorProject): ClipPlacement[] {
  return p.clips.map((clip, index) => {
    const startS = clipStartGlobal(p, index);
    return { index, clip, startS, endS: startS + clipLength(clip) };
  });
}

/** Which clip is on screen at a global time, and where inside its source. */
export function resolvePlayhead(
  p: EditorProject,
  timeS: number,
): { index: number; clip: Clip; sourceTimeS: number; frozen: boolean } | null {
  const places = clipPlacements(p);
  if (places.length === 0) return null;
  const hit = places.find((pl) => timeS >= pl.startS && timeS < pl.endS) ?? places[places.length - 1];
  const c = hit.clip;
  const local = Math.max(0, Math.min(timeS - hit.startS, clipLength(c)));
  const playable = Math.max(0, (c.outS - c.inS) / Math.max(0.1, c.speed));
  const frozen = local > playable;
  const sourceTimeS = frozen
    ? c.outS
    : Math.min(c.outS, c.inS + local * Math.max(0.1, c.speed));
  return { index: hit.index, clip: c, sourceTimeS, frozen };
}

/** Global timeline time for a source time inside a given clip. */
export function sourceToGlobal(p: EditorProject, index: number, sourceTimeS: number): number {
  const c = p.clips[index];
  if (!c) return 0;
  const local = (Math.max(c.inS, Math.min(sourceTimeS, c.outS)) - c.inS) / Math.max(0.1, c.speed);
  return clipStartGlobal(p, index) + local;
}

export function audioTrackEnd(t: AudioTrack): number {
  return t.startS + Math.max(0, t.outS - t.inS);
}

/** All times worth snapping to: clip edges, overlays, cues, audio edges, playhead. */
export function snapTargets(p: EditorProject, playheadS: number): number[] {
  const targets = new Set<number>([0, playheadS, totalDuration(p)]);
  for (const pl of clipPlacements(p)) {
    targets.add(pl.startS);
    targets.add(pl.endS);
  }
  for (const t of p.texts) {
    targets.add(t.startS);
    targets.add(t.endS);
  }
  for (const c of p.captions.cues) {
    targets.add(c.startS);
    targets.add(c.endS);
  }
  for (const a of p.audioTracks) {
    targets.add(a.startS);
    targets.add(audioTrackEnd(a));
  }
  return [...targets].filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
}

export function snapTime(value: number, targets: number[], toleranceS: number): number {
  let best = value;
  let bestDelta = toleranceS;
  for (const t of targets) {
    const d = Math.abs(t - value);
    if (d <= bestDelta) {
      best = t;
      bestDelta = d;
    }
  }
  return best;
}

export function clampZoom(pxPerSec: number): number {
  return Math.max(MIN_PX_PER_SEC, Math.min(MAX_PX_PER_SEC, pxPerSec));
}

/** Spacing of ruler ticks so labels never collide at the current zoom. */
export function rulerStep(pxPerSec: number): number {
  const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  return candidates.find((s) => s * pxPerSec >= 70) ?? 600;
}

export function formatTimecode(sec: number, fps = 30): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const f = Math.floor((sec - Math.floor(sec)) * fps);
  return `${m}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}

export function frameStep(fps: number): number {
  return 1 / Math.max(1, fps);
}
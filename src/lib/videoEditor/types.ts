export type TransitionKind = "none" | "fade" | "dissolve" | "wipeleft" | "wiperight" | "slideleft" | "slideright" | "fadeblack" | "fadewhite";

export type FilterPreset = "none" | "warm" | "cool" | "cinematic" | "bw" | "vivid" | "vintage";

export interface Clip {
  id: string;
  src: string;            // object URL or remote URL
  name: string;
  durationS: number;      // source duration
  inS: number;            // trim start
  outS: number;           // trim end (<= durationS)
  speed: number;          // 0.5 - 2.0
  volume: number;         // 0 - 2
  filter: FilterPreset;
  transitionToNext: TransitionKind;
  transitionDurS: number; // 0.2 - 2.0
  width?: number;
  height?: number;
}

export interface TextOverlay {
  id: string;
  text: string;
  startS: number;         // global timeline seconds
  endS: number;
  x: number;              // 0..1 (center)
  y: number;              // 0..1
  fontSize: number;       // px at 1080p
  color: string;          // #rrggbb
  bgColor: string;        // hex or "transparent"
  bgOpacity: number;      // 0..1
  weight: "normal" | "bold";
  fontFamily: "Sans" | "Serif" | "Mono";
  align: "left" | "center" | "right";
}

export type CaptionStyle = "classic" | "yellow" | "outline" | "boxed" | "minimal";

export interface CaptionCue {
  id: string;
  startS: number;
  endS: number;
  text: string;
}

export interface CaptionTrack {
  enabled: boolean;
  burnIn: boolean;
  style: CaptionStyle;
  fontSize: number;
  position: "bottom" | "top";
  cues: CaptionCue[];
}

export interface EditorProject {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  clips: Clip[];
  texts: TextOverlay[];
  captions: CaptionTrack;
  audioVolume: number;        // master 0..2
  sourceItemId?: string;      // portfolio item id we started from
}

export function totalDuration(p: EditorProject): number {
  let total = 0;
  for (let i = 0; i < p.clips.length; i++) {
    const c = p.clips[i];
    const segLen = Math.max(0, (c.outS - c.inS) / Math.max(0.1, c.speed));
    total += segLen;
    if (i < p.clips.length - 1 && c.transitionToNext !== "none") {
      total -= Math.min(c.transitionDurS, segLen / 2);
    }
  }
  return Math.max(0, total);
}

export function clipStartGlobal(p: EditorProject, index: number): number {
  let t = 0;
  for (let i = 0; i < index; i++) {
    const c = p.clips[i];
    const segLen = (c.outS - c.inS) / Math.max(0.1, c.speed);
    t += segLen;
    if (c.transitionToNext !== "none") t -= Math.min(c.transitionDurS, segLen / 2);
  }
  return t;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
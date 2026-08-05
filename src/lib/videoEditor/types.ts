export type TransitionKind = "none" | "fade" | "dissolve" | "wipeleft" | "wiperight" | "slideleft" | "slideright" | "fadeblack" | "fadewhite";

export type FilterPreset = "none" | "warm" | "cool" | "cinematic" | "bw" | "vivid" | "vintage";

/** Per-clip geometry: crop (normalised 0..1), rotation, flips, and Ken Burns framing. */
export interface ClipTransform {
  cropX: number;      // 0..1 left edge
  cropY: number;      // 0..1 top edge
  cropW: number;      // 0..1 width of the kept region
  cropH: number;      // 0..1 height of the kept region
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  zoomStart: number;  // 1 = no zoom
  zoomEnd: number;
  panStartX: number;  // -1..1 offset of the framed centre
  panStartY: number;
  panEndX: number;
  panEndY: number;
}

/** Per-clip colour grade applied on top of the look preset. */
export interface ClipColor {
  exposure: number;    // -1..1
  contrast: number;    // 0.5..2
  saturation: number;  // 0..2
  temperature: number; // -1 (cool) .. 1 (warm)
}

export function defaultTransform(): ClipTransform {
  return {
    cropX: 0, cropY: 0, cropW: 1, cropH: 1,
    rotate: 0, flipH: false, flipV: false,
    zoomStart: 1, zoomEnd: 1,
    panStartX: 0, panStartY: 0, panEndX: 0, panEndY: 0,
  };
}

export function defaultColor(): ClipColor {
  return { exposure: 0, contrast: 1, saturation: 1, temperature: 0 };
}

export function isIdentityTransform(t: ClipTransform): boolean {
  const d = defaultTransform();
  return (Object.keys(d) as (keyof ClipTransform)[]).every((k) => t[k] === d[k]);
}

export function isIdentityColor(c: ClipColor): boolean {
  const d = defaultColor();
  return (Object.keys(d) as (keyof ClipColor)[]).every((k) => c[k] === d[k]);
}

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
  transform: ClipTransform;
  color: ClipColor;
  /** Hold the last frame for this many extra seconds (freeze frame). */
  freezeS: number;
}

export type AudioRole = "music" | "voiceover";

export interface AudioTrack {
  id: string;
  src: string;
  name: string;
  role: AudioRole;
  durationS: number;
  inS: number;           // trim start within the source
  outS: number;          // trim end within the source
  startS: number;        // where it lands on the global timeline
  gain: number;          // 0..2
  fadeInS: number;
  fadeOutS: number;
  loop: boolean;
  muted: boolean;
}

export interface WatermarkSettings {
  enabled: boolean;
  src: string | null;      // data/object URL of the logo
  name: string | null;
  position: "tl" | "tr" | "bl" | "br";
  scale: number;           // fraction of the canvas width (0.05..0.5)
  opacity: number;         // 0..1
  marginPct: number;       // margin as a fraction of the canvas width
}

export function defaultWatermark(): WatermarkSettings {
  return { enabled: false, src: null, name: null, position: "br", scale: 0.16, opacity: 0.85, marginPct: 0.03 };
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
  audioTracks: AudioTrack[];
  watermark: WatermarkSettings;
  /** Export quality: affects x264 CRF and target bitrate. */
  quality: "draft" | "standard" | "high";
  /** Automatically lower music under voiceover. */
  duckMusic: boolean;
}

/** Length of a clip on the timeline, including any freeze-frame hold. */
export function clipLength(c: Clip): number {
  return Math.max(0, (c.outS - c.inS) / Math.max(0.1, c.speed)) + Math.max(0, c.freezeS || 0);
}

/**
 * Brings projects saved by older versions of the editor up to the current
 * shape so a stored draft never crashes the timeline.
 */
export function migrateProject(raw: Partial<EditorProject> & { clips?: Partial<Clip>[] }): EditorProject {
  const clips: Clip[] = (raw.clips ?? []).map((c) => ({
    id: c.id ?? newId(),
    src: c.src ?? "",
    name: c.name ?? "clip.mp4",
    durationS: c.durationS ?? 0,
    inS: c.inS ?? 0,
    outS: c.outS ?? c.durationS ?? 0,
    speed: c.speed ?? 1,
    volume: c.volume ?? 1,
    filter: (c.filter ?? "none") as FilterPreset,
    transitionToNext: (c.transitionToNext ?? "none") as TransitionKind,
    transitionDurS: c.transitionDurS ?? 0.6,
    width: c.width,
    height: c.height,
    transform: { ...defaultTransform(), ...(c.transform ?? {}) },
    color: { ...defaultColor(), ...(c.color ?? {}) },
    freezeS: c.freezeS ?? 0,
  }));

  return {
    id: raw.id ?? newId(),
    name: raw.name ?? "Untitled edit",
    width: raw.width ?? 1920,
    height: raw.height ?? 1080,
    fps: raw.fps ?? 30,
    clips,
    texts: raw.texts ?? [],
    captions: raw.captions ?? { enabled: true, burnIn: true, style: "classic", fontSize: 48, position: "bottom", cues: [] },
    audioVolume: raw.audioVolume ?? 1,
    sourceItemId: raw.sourceItemId,
    audioTracks: raw.audioTracks ?? [],
    watermark: { ...defaultWatermark(), ...(raw.watermark ?? {}) },
    quality: raw.quality ?? "standard",
    duckMusic: raw.duckMusic ?? true,
  };
}

export function totalDuration(p: EditorProject): number {
  let total = 0;
  for (let i = 0; i < p.clips.length; i++) {
    const c = p.clips[i];
    const segLen = clipLength(c);
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
    const segLen = clipLength(c);
    t += segLen;
    if (c.transitionToNext !== "none") t -= Math.min(c.transitionDurS, segLen / 2);
  }
  return t;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
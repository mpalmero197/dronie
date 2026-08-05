import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Music, Mic, Type, Captions, ZoomIn, ZoomOut, Magnet, Film } from "lucide-react";
import { AudioTrack, Clip, EditorProject, clipLength } from "@/lib/videoEditor/types";
import {
  DEFAULT_PX_PER_SEC, SNAP_PX, audioTrackEnd, clampZoom, clipPlacements,
  formatTimecode, rulerStep, snapTargets, snapTime,
} from "@/lib/videoEditor/timeline";
import { cn } from "@/lib/utils";

interface Props {
  project: EditorProject;
  timeS: number;
  selectedClipIdx: number;
  thumbs: Record<string, string[]>;
  peaks: Record<string, number[]>;
  onSeek: (t: number) => void;
  onSelectClip: (i: number) => void;
  onSelectAudio: (id: string) => void;
  selectedAudioId: string | null;
  /** Live trim/move while dragging (not committed to undo history). */
  onTrimDrag: (index: number, patch: Partial<Clip>) => void;
  onAudioDrag: (id: string, patch: Partial<AudioTrack>) => void;
  onDragCommit: (label: string) => void;
  onReorder: (from: number, to: number) => void;
}

type DragState =
  | { kind: "playhead" }
  | { kind: "trim-in" | "trim-out"; index: number; startX: number; origIn: number; origOut: number }
  | { kind: "move-clip"; index: number; startX: number }
  | { kind: "move-audio"; id: string; startX: number; origStart: number }
  | null;

export default function Timeline(props: Props) {
  const {
    project, timeS, selectedClipIdx, thumbs, peaks, onSeek, onSelectClip,
    onSelectAudio, selectedAudioId, onTrimDrag, onAudioDrag, onDragCommit, onReorder,
  } = props;

  const [pxPerSec, setPxPerSec] = useState(DEFAULT_PX_PER_SEC);
  const [snapping, setSnapping] = useState(true);
  const [drag, setDrag] = useState<DragState>(null);
  const laneRef = useRef<HTMLDivElement | null>(null);

  const places = useMemo(() => clipPlacements(project), [project]);
  const total = places.length ? places[places.length - 1].endS : 0;
  const audioEnd = project.audioTracks.reduce((m, t) => Math.max(m, audioTrackEnd(t)), 0);
  const contentS = Math.max(total, audioEnd, 5);
  const widthPx = Math.max(320, contentS * pxPerSec + 80);

  const targets = useMemo(() => snapTargets(project, timeS), [project, timeS]);
  const maybeSnap = useCallback(
    (t: number) => (snapping ? snapTime(t, targets, SNAP_PX / pxPerSec) : t),
    [snapping, targets, pxPerSec],
  );

  const xToTime = useCallback(
    (clientX: number) => {
      const el = laneRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return Math.max(0, (clientX - rect.left + el.scrollLeft) / pxPerSec);
    },
    [pxPerSec],
  );

  // Global pointer handling for every drag interaction on the timeline.
  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      const t = xToTime(e.clientX);
      if (drag.kind === "playhead") {
        onSeek(Math.max(0, Math.min(maybeSnap(t), contentS)));
        return;
      }
      if (drag.kind === "trim-in" || drag.kind === "trim-out") {
        const place = places[drag.index];
        if (!place) return;
        const c = place.clip;
        const speed = Math.max(0.1, c.speed);
        const snapped = maybeSnap(t);
        if (drag.kind === "trim-in") {
          const deltaLocal = (snapped - place.startS) * speed;
          const nextIn = Math.max(0, Math.min(drag.origIn + deltaLocal, c.outS - 0.2));
          onTrimDrag(drag.index, { inS: nextIn });
        } else {
          const deltaLocal = (snapped - place.endS) * speed;
          const nextOut = Math.max(c.inS + 0.2, Math.min(drag.origOut + deltaLocal, c.durationS || drag.origOut + deltaLocal));
          onTrimDrag(drag.index, { outS: nextOut });
        }
        return;
      }
      if (drag.kind === "move-audio") {
        const dx = (e.clientX - drag.startX) / pxPerSec;
        onAudioDrag(drag.id, { startS: Math.max(0, maybeSnap(drag.origStart + dx)) });
      }
    };

    const onUp = () => {
      if (drag.kind === "trim-in" || drag.kind === "trim-out") onDragCommit("Trim clip");
      if (drag.kind === "move-audio") onDragCommit("Move audio");
      setDrag(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, xToTime, maybeSnap, onSeek, onTrimDrag, onAudioDrag, onDragCommit, places, contentS, pxPerSec]);

  const step = rulerStep(pxPerSec);
  const ticks: number[] = [];
  for (let t = 0; t <= contentS + step; t += step) ticks.push(t);

  const laneClass = "relative h-14 rounded-lg border border-border/60 bg-background/40";

  return (
    <div className="rounded-xl border border-border bg-secondary/30">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Timeline</p>
        <span className="text-[11px] font-mono text-muted-foreground">
          {formatTimecode(timeS, project.fps)} / {formatTimecode(total, project.fps)}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant={snapping ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => setSnapping((s) => !s)}
            aria-pressed={snapping}
            title="Toggle snapping"
          >
            <Magnet className="w-3.5 h-3.5 mr-1" /> Snap
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPxPerSec((z) => clampZoom(z / 1.4))} aria-label="Zoom out timeline">
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPxPerSec((z) => clampZoom(z * 1.4))} aria-label="Zoom in timeline">
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div ref={laneRef} className="overflow-x-auto overflow-y-hidden px-3 pb-3 pt-1">
        <div className="relative" style={{ width: widthPx }}>
          {/* Ruler */}
          <div
            className="relative h-6 mb-1 cursor-pointer select-none"
            onPointerDown={(e) => { setDrag({ kind: "playhead" }); onSeek(Math.max(0, Math.min(maybeSnap(xToTime(e.clientX)), contentS))); }}
          >
            {ticks.map((t) => (
              <div key={t} className="absolute top-0 h-full border-l border-border/70" style={{ left: t * pxPerSec }}>
                <span className="pl-1 text-[10px] font-mono text-muted-foreground">{formatTimecode(t, project.fps).slice(0, -3)}</span>
              </div>
            ))}
          </div>

          {/* Video lane */}
          <div className={cn(laneClass, "h-20")}>
            {places.length === 0 && (
              <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                No clips yet — add footage to start the timeline.
              </div>
            )}
            {places.map((pl) => {
              const w = Math.max(24, clipLength(pl.clip) * pxPerSec);
              const selected = pl.index === selectedClipIdx;
              const strip = thumbs[pl.clip.id] ?? [];
              return (
                <div
                  key={pl.clip.id}
                  className={cn(
                    "absolute top-1 bottom-1 rounded-md overflow-hidden border group",
                    selected ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50",
                  )}
                  style={{ left: pl.startS * pxPerSec, width: w }}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/clip-index", String(pl.index))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData("text/clip-index"));
                    if (!Number.isNaN(from) && from !== pl.index) onReorder(from, pl.index);
                  }}
                  onPointerDown={() => onSelectClip(pl.index)}
                >
                  <div className="absolute inset-0 flex">
                    {strip.length > 0 ? (
                      strip.map((src, i) => (
                        <img key={i} src={src} alt="" className="h-full w-auto object-cover opacity-80 pointer-events-none" />
                      ))
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/10" />
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-background/80 px-1.5 py-0.5 flex items-center gap-1">
                    <Film className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-[10px] font-semibold truncate">{pl.clip.name}</span>
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                      {clipLength(pl.clip).toFixed(1)}s
                    </span>
                  </div>

                  {/* Trim handles */}
                  <div
                    role="separator"
                    aria-label={`Trim start of ${pl.clip.name}`}
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-primary/0 hover:bg-primary/70 group-hover:bg-primary/40"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectClip(pl.index);
                      setDrag({ kind: "trim-in", index: pl.index, startX: e.clientX, origIn: pl.clip.inS, origOut: pl.clip.outS });
                    }}
                  />
                  <div
                    role="separator"
                    aria-label={`Trim end of ${pl.clip.name}`}
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-primary/0 hover:bg-primary/70 group-hover:bg-primary/40"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectClip(pl.index);
                      setDrag({ kind: "trim-out", index: pl.index, startX: e.clientX, origIn: pl.clip.inS, origOut: pl.clip.outS });
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Overlay lane */}
          <div className={cn(laneClass, "h-8 mt-1")}>
            <span className="absolute left-1 top-1 text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <Type className="w-3 h-3" />
            </span>
            {project.texts.map((t) => (
              <div
                key={t.id}
                className="absolute top-1 bottom-1 rounded bg-accent/40 border border-accent/60 px-1 text-[10px] truncate"
                style={{ left: t.startS * pxPerSec, width: Math.max(16, (t.endS - t.startS) * pxPerSec) }}
                title={t.text}
              >
                {t.text}
              </div>
            ))}
          </div>

          {/* Caption lane */}
          <div className={cn(laneClass, "h-6 mt-1")}>
            <span className="absolute left-1 top-0.5 text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <Captions className="w-3 h-3" />
            </span>
            {project.captions.cues.map((c) => (
              <div
                key={c.id}
                className="absolute top-1 bottom-1 rounded-sm bg-primary/40"
                style={{ left: c.startS * pxPerSec, width: Math.max(4, (c.endS - c.startS) * pxPerSec) }}
                title={c.text}
              />
            ))}
          </div>

          {/* Audio lanes */}
          {project.audioTracks.map((t) => {
            const w = Math.max(24, (t.outS - t.inS) * pxPerSec);
            const wave = peaks[t.id] ?? [];
            return (
              <div key={t.id} className={cn(laneClass, "h-12 mt-1")}>
                <div
                  className={cn(
                    "absolute top-1 bottom-1 rounded-md border overflow-hidden cursor-grab active:cursor-grabbing",
                    selectedAudioId === t.id ? "border-primary ring-2 ring-primary/40" : "border-border",
                    t.role === "music" ? "bg-primary/15" : "bg-accent/20",
                    t.muted && "opacity-50",
                  )}
                  style={{ left: t.startS * pxPerSec, width: w }}
                  onPointerDown={(e) => {
                    onSelectAudio(t.id);
                    setDrag({ kind: "move-audio", id: t.id, startX: e.clientX, origStart: t.startS });
                  }}
                >
                  <div className="absolute inset-0 flex items-center gap-px px-1">
                    {wave.map((p, i) => (
                      <span
                        key={i}
                        className="flex-1 bg-foreground/30 rounded-sm"
                        style={{ height: `${Math.max(4, p * 100)}%` }}
                      />
                    ))}
                  </div>
                  <span className="absolute left-1 top-0.5 text-[10px] font-semibold inline-flex items-center gap-1 bg-background/70 rounded px-1">
                    {t.role === "music" ? <Music className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    {t.name}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-primary pointer-events-none"
            style={{ left: timeS * pxPerSec }}
          >
            <div className="w-2.5 h-2.5 -ml-[5px] rounded-full bg-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}
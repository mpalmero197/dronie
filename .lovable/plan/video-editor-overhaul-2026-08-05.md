# Video Editor Overhaul

Rebuild the editor around a real timeline engine, then layer on creative tools, editing power, and a trustworthy render pipeline.

## 1. Timeline engine (foundation)

Replace the current "one clip selected, preview shows the raw source" model with a proper document model:

- **Tracks**: a video track (clips in sequence), an overlay track (text, logo/watermark, shapes), a caption track, and up to two audio tracks (music + voiceover).
- **Global playhead** that owns time. Every panel and the preview read from it instead of from the selected clip's video element.
- **Undo/redo** history over the whole project document, with a capped stack.
- **Autosave** to local storage plus an explicit "Save draft", so a refresh never loses an edit.

## 2. Timeline UI

- Zoomable, time-accurate ruler (pixels per second) instead of the current fixed-width clip chips.
- Drag to reorder clips; drag clip edges to trim in/out live.
- Split at playhead, ripple delete, duplicate clip.
- Snapping to the playhead, clip boundaries, and caption/text starts.
- Filmstrip thumbnails on clips and a waveform on audio tracks.
- Keyboard shortcuts: space play/pause, J/K/L, arrows for frame step, S split, Delete, Cmd/Ctrl+Z and Shift+Z, +/- zoom.

## 3. Creative tools

- **Audio**: import music and voiceover, trim, fade in/out, per-track gain, and auto-ducking of music under speech.
- **Crop, rotate, flip** per clip.
- **Ken Burns zoom/pan** with start and end framing.
- **Color controls**: exposure, contrast, saturation, temperature, alongside the existing look presets.
- **Speed ramps** and freeze-frame holds.
- **Logo / watermark overlay** with position, size, and opacity, reusing the existing portfolio watermark.
- **Lower-third and title templates** suited to drone-service branding.

## 4. Preview and output

- **Composited playback**: a canvas preview that draws the active clip plus crop, zoom, color, overlays, and captions at the playhead, so what you see matches the export.
- Scrub-accurate seeking with thumbnail previews, plus a fast draft-quality playback mode.
- Export dialog with the existing presets plus quality/bitrate control and an estimated file size.

## 5. Render reliability

- **Cancelable renders** with real per-stage progress and a failure message that names the stage and clip that failed.
- Move ffmpeg work off the main thread so the UI never freezes; process clips one at a time with cleanup between passes so long timelines don't exhaust memory.
- Guard rails: reject sources the browser cannot decode with actionable advice, handle clips with **no audio track** (the current transition path assumes every clip has audio and fails otherwise), and cap render resolution on low-memory devices.
- Pre-flight check before render: duration, source count, and estimated render time, so a long wait is never a surprise.
- Fall back to the plain concat path if the transition path fails, so a render still produces a file.

## Technical notes

- New model in `src/lib/videoEditor/types.ts`: `Track[]` with typed items, keyframes, and per-clip transform/color state, plus a migration shim so existing single-track projects still load.
- New `src/lib/videoEditor/timeline.ts` for time math (global-to-clip-local, snapping, zoom) and `history.ts` for undo/redo.
- `render.ts` split into staged passes driven by an `AbortSignal`; each ffmpeg call wrapped so failures report their stage. Audio presence probed per clip, with `anullsrc` synthesized when a clip is silent.
- Preview compositor in `src/lib/videoEditor/preview.ts` drawing to a canvas via `requestVideoFrameCallback`, mirroring the ffmpeg filter chain.
- `VideoEditor.tsx` (~980 lines today) splits into `components/videoEditor/`: `Timeline`, `TrackRow`, `PreviewCanvas`, `Transport`, and Inspector panels (Clip, Audio, Text, Captions, Effects, Export).
- No database or backend changes; captions keep using the existing transcribe and translate functions.

## Delivery order

1. Timeline engine, undo/redo, autosave, with existing features ported over.
2. New timeline UI: drag-trim, split, snapping, shortcuts.
3. Canvas preview compositor.
4. Render reliability pass: cancel, off-thread, no-audio fix, staged errors.
5. Creative tools: audio tracks, crop/rotate, Ken Burns, color, watermark, titles.
6. Export dialog polish.
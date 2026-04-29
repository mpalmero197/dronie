import { CaptionTrack, TextOverlay, EditorProject } from "./types";

function tc(secs: number): string {
  if (!isFinite(secs) || secs < 0) secs = 0;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const cs = Math.floor((secs - Math.floor(secs)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function hexToAssColor(hex: string, alpha = 0): string {
  // ASS color is &HAABBGGRR
  const h = hex.replace("#", "");
  const r = h.substring(0, 2);
  const g = h.substring(2, 4);
  const b = h.substring(4, 6);
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)))
    .toString(16)
    .padStart(2, "0");
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

function escapeAss(text: string): string {
  return text.replace(/\n/g, "\\N").replace(/\{/g, "(").replace(/\}/g, ")");
}

function captionStylePrimary(style: string): { primary: string; outline: string; back: string; borderStyle: number; outlineW: number; shadow: number } {
  switch (style) {
    case "yellow":
      return { primary: "#FFEE00", outline: "#000000", back: "#000000", borderStyle: 1, outlineW: 3, shadow: 0 };
    case "outline":
      return { primary: "#FFFFFF", outline: "#000000", back: "#000000", borderStyle: 1, outlineW: 4, shadow: 0 };
    case "boxed":
      return { primary: "#FFFFFF", outline: "#000000", back: "#000000", borderStyle: 3, outlineW: 8, shadow: 0 };
    case "minimal":
      return { primary: "#FFFFFF", outline: "#000000", back: "#000000", borderStyle: 1, outlineW: 1, shadow: 0 };
    case "classic":
    default:
      return { primary: "#FFFFFF", outline: "#000000", back: "#000000", borderStyle: 3, outlineW: 6, shadow: 0 };
  }
}

export function buildAss(project: EditorProject): string {
  const { width, height, captions, texts } = project;
  const cap = captionStylePrimary(captions.style);

  const styles: string[] = [];
  // Captions style
  styles.push(
    `Style: Caption,Arial,${captions.fontSize},${hexToAssColor(cap.primary)},&H000000FF,${hexToAssColor(cap.outline)},${hexToAssColor(cap.back, 0)},-1,0,0,0,100,100,0,0,${cap.borderStyle},${cap.outlineW},${cap.shadow},${captions.position === "top" ? 8 : 2},40,40,60,1`,
  );
  // One style per text overlay (so we can vary font/size/color)
  texts.forEach((t, i) => {
    const fontName = t.fontFamily === "Serif" ? "Times New Roman" : t.fontFamily === "Mono" ? "Courier New" : "Arial";
    const align = t.align === "left" ? 1 : t.align === "right" ? 3 : 2; // bottom-row alignments; we override pos with \\pos
    const bold = t.weight === "bold" ? -1 : 0;
    styles.push(
      `Style: Text${i},${fontName},${t.fontSize},${hexToAssColor(t.color)},&H000000FF,&H00000000,&H00000000,${bold},0,0,0,100,100,0,0,1,2,0,${align},20,20,20,1`,
    );
  });

  const events: string[] = [];

  // Captions
  if (captions.enabled) {
    for (const cue of captions.cues) {
      events.push(
        `Dialogue: 0,${tc(cue.startS)},${tc(cue.endS)},Caption,,0,0,0,,${escapeAss(cue.text)}`,
      );
    }
  }

  // Text overlays — positioned via \pos
  texts.forEach((t, i) => {
    const px = Math.round(t.x * width);
    const py = Math.round(t.y * height);
    let body = `{\\pos(${px},${py})}`;
    if (t.bgOpacity > 0 && t.bgColor) {
      // Use border box via inline override
      body += `{\\bord0\\shad0\\3c${hexToAssColor(t.bgColor).slice(2)}\\4a&H00&}`;
    }
    body += escapeAss(t.text);
    events.push(
      `Dialogue: 0,${tc(t.startS)},${tc(t.endS)},Text${i},,0,0,0,,${body}`,
    );
  });

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "ScaledBorderAndShadow: yes",
    "WrapStyle: 2",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    ...styles,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...events,
    "",
  ].join("\n");
}

export function cuesToSrt(cues: { startS: number; endS: number; text: string }[]): string {
  const fmt = (n: number) => {
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const s = Math.floor(n % 60);
    const ms = Math.floor((n - Math.floor(n)) * 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
  };
  return cues
    .map((c, i) => `${i + 1}\n${fmt(c.startS)} --> ${fmt(c.endS)}\n${c.text}\n`)
    .join("\n");
}
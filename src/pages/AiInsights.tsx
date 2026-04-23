import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Boxes, Download, FileText, Layers, Mountain, Ruler, Thermometer, TreePine, Wrench, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

type ClassKey = "earth" | "vegetation" | "concrete" | "utility" | "thermal";

interface ClassConfig {
  key: ClassKey;
  label: string;
  color: string;
  icon: typeof Mountain;
  coverage: number; // %
}

const CLASSES: ClassConfig[] = [
  { key: "earth",      label: "Bare earth",   color: "hsl(28 60% 45%)", icon: Mountain,    coverage: 38 },
  { key: "vegetation", label: "Vegetation",   color: "hsl(142 65% 38%)", icon: TreePine,   coverage: 27 },
  { key: "concrete",   label: "Concrete",     color: "hsl(210 8% 70%)",  icon: Boxes,      coverage: 21 },
  { key: "utility",    label: "Utility lines",color: "hsl(50 95% 55%)",  icon: Zap,        coverage: 6 },
  { key: "thermal",    label: "Thermal hotspot",color:"hsl(0 78% 55%)",  icon: Thermometer,coverage: 8 },
];

interface Metric {
  label: string;
  value: string;
  unit?: string;
  trend?: "up" | "down" | "flat";
  hint?: string;
}

export default function AiInsights() {
  const { toast } = useToast();
  const [active, setActive] = useState<Record<ClassKey, boolean>>({
    earth: true, vegetation: true, concrete: true, utility: true, thermal: true,
  });
  const [opacity, setOpacity] = useState([70]);
  const [generating, setGenerating] = useState(false);

  const metrics: Metric[] = useMemo(() => [
    { label: "Stockpile volume", value: "12,840", unit: "m³", trend: "up", hint: "+3.2% since last flight" },
    { label: "Roof area",        value: "4,182",  unit: "m²", trend: "flat" },
    { label: "Vegetation",       value: "27.0",   unit: "%",  trend: "up" },
    { label: "Thermal anomalies",value: "3",      unit: "zones", trend: "down" },
    { label: "Cut / fill",       value: "+184 / −96", unit: "m³" },
    { label: "Linear infra.",    value: "1,260",  unit: "m" },
  ], []);

  function toggle(k: ClassKey) {
    setActive((c) => ({ ...c, [k]: !c[k] }));
  }

  async function generateReport() {
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pad = 18;
      let y = pad;
      // header
      doc.setFillColor(36, 90, 60);
      doc.rect(0, 0, 210, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Dronie · Site Insights Report", pad, 14);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(new Date().toLocaleString(), 210 - pad, 14, { align: "right" });
      y = 30;
      doc.setTextColor(20, 20, 20);

      doc.setFont("helvetica", "bold").setFontSize(12);
      doc.text("Executive summary", pad, y); y += 6;
      doc.setFont("helvetica", "normal").setFontSize(10);
      const summary = `Automated photogrammetric analysis of the surveyed area returned ${metrics.length} primary metrics across ${CLASSES.length} segmented classes. Volumetric measurements, surface coverage, and detected anomalies are listed below for engineering review.`;
      doc.text(doc.splitTextToSize(summary, 174), pad, y);
      y += 18;

      doc.setFont("helvetica", "bold").setFontSize(12);
      doc.text("Key metrics", pad, y); y += 4;
      doc.setDrawColor(220);
      doc.line(pad, y, 210 - pad, y); y += 6;
      doc.setFontSize(10);
      metrics.forEach((m) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${m.value}${m.unit ? " " + m.unit : ""}`, pad, y);
        doc.setFont("helvetica", "normal");
        doc.text(m.label, pad + 60, y);
        if (m.hint) {
          doc.setTextColor(120);
          doc.text(m.hint, 210 - pad, y, { align: "right" });
          doc.setTextColor(20);
        }
        y += 7;
      });
      y += 6;

      doc.setFont("helvetica", "bold").setFontSize(12);
      doc.text("Semantic class breakdown", pad, y); y += 6;
      doc.setFontSize(10);
      const totalActive = CLASSES.filter((c) => active[c.key]).reduce((s, c) => s + c.coverage, 0) || 1;
      CLASSES.forEach((c) => {
        const on = active[c.key];
        doc.setTextColor(on ? 20 : 160);
        doc.text(`${c.label.padEnd(20, " ")} ${c.coverage.toString().padStart(4)} %  ${on ? "(included)" : "(excluded)"}`, pad, y);
        // bar
        const w = 80, h = 3;
        doc.setFillColor(225, 230, 226);
        doc.rect(110, y - 3, w, h, "F");
        const rgb = hslToRgb(c.color);
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.rect(110, y - 3, on ? (c.coverage / 100) * w : 0, h, "F");
        y += 7;
      });

      y += 4;
      doc.setTextColor(120);
      doc.setFontSize(8);
      doc.text(`Active classes represent ${totalActive}% of the surveyed area.`, pad, y);

      doc.save(`dronie-insights-${Date.now()}.pdf`);
      toast({ title: "Report generated", description: "PDF downloaded to your device." });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-display font-700 truncate">AI Insights · Semantic Analysis</h1>
              <p className="text-xs text-muted-foreground truncate">Class segmentation · automated measurements · one-click reports</p>
            </div>
          </div>
          <Button size="sm" onClick={generateReport} disabled={generating} className="gap-1.5">
            <FileText className="w-4 h-4" /> {generating ? "Generating…" : "Export PDF report"}
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Segmented site preview */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Segmented orthomosaic</h2>
              <span className="text-xs text-muted-foreground">Layer opacity {opacity[0]}%</span>
            </div>
            <div className="relative aspect-[16/9] bg-[hsl(220_25%_18%)]">
              {/* base image (faux ortho) */}
              <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(40_30%_45%)_0%,hsl(120_35%_38%)_50%,hsl(210_8%_55%)_100%)] opacity-90" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(0,0,0,0.4),transparent_60%)] mix-blend-multiply" />

              {/* class overlays */}
              {active.earth && (
                <div className="absolute inset-0" style={{ opacity: opacity[0] / 100 }}>
                  <div className="absolute left-0 top-0 w-1/2 h-2/3 bg-[radial-gradient(ellipse_at_30%_40%,hsl(28_60%_45%/0.7),transparent_70%)]" />
                </div>
              )}
              {active.vegetation && (
                <div className="absolute inset-0" style={{ opacity: opacity[0] / 100 }}>
                  <div className="absolute right-0 top-0 w-3/5 h-3/4 bg-[radial-gradient(ellipse_at_70%_40%,hsl(142_65%_38%/0.6),transparent_65%)]" />
                </div>
              )}
              {active.concrete && (
                <div className="absolute inset-0" style={{ opacity: opacity[0] / 100 }}>
                  <div className="absolute left-1/4 bottom-0 w-1/2 h-2/5 bg-[hsl(210_8%_70%/0.55)] rounded-t-3xl" />
                </div>
              )}
              {active.utility && (
                <div className="absolute inset-0" style={{ opacity: opacity[0] / 100 }}>
                  <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                    <path d="M5 90 L95 30" stroke="hsl(50 95% 55%)" strokeWidth="0.6" strokeDasharray="2 1" />
                    <path d="M5 60 L95 70" stroke="hsl(50 95% 55%)" strokeWidth="0.6" strokeDasharray="2 1" />
                  </svg>
                </div>
              )}
              {active.thermal && (
                <div className="absolute inset-0" style={{ opacity: opacity[0] / 100 }}>
                  {[
                    { l: "30%", t: "55%", s: 90 },
                    { l: "62%", t: "30%", s: 60 },
                    { l: "75%", t: "70%", s: 70 },
                  ].map((p, i) => (
                    <div
                      key={i}
                      className="absolute rounded-full bg-[radial-gradient(circle,hsl(0_78%_55%/0.7),transparent_70%)] animate-pulse"
                      style={{ left: p.l, top: p.t, width: p.s, height: p.s, transform: "translate(-50%,-50%)" }}
                    />
                  ))}
                </div>
              )}

              {/* legend */}
              <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 max-w-[70%]">
                {CLASSES.filter((c) => active[c.key]).map((c) => (
                  <span key={c.key} className="flex items-center gap-1.5 bg-black/55 backdrop-blur text-white text-[10px] font-mono rounded-full px-2 py-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                    {c.label} · {c.coverage}%
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-xl border border-border bg-card p-3">
                <p className="text-[11px] text-muted-foreground">{m.label}</p>
                <p className="font-display font-700 text-xl mt-1">
                  {m.value}
                  {m.unit && <span className="text-xs text-muted-foreground ml-1 font-sans font-normal">{m.unit}</span>}
                </p>
                {m.hint && <p className="text-[10px] text-primary mt-0.5">{m.hint}</p>}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3"><Ruler className="w-4 h-4 text-primary" /> Automated tools</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { i: Boxes, l: "Stockpile vol." },
                { i: Mountain, l: "Cut & fill" },
                { i: Wrench, l: "Roof measure" },
                { i: Thermometer, l: "Thermal scan" },
              ].map((t) => {
                const Icon = t.i;
                return (
                  <button key={t.l} className="rounded-lg border border-border hover:border-primary/40 hover:bg-secondary/40 px-3 py-2.5 text-xs font-semibold flex flex-col items-start gap-1.5 transition-colors">
                    <Icon className="w-4 h-4 text-primary" /> {t.l}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Layer controls */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Semantic layers</h3>
            {CLASSES.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.key} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-sm" style={{ background: c.color }} />
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.label}</p>
                      <p className="text-[10px] text-muted-foreground">{c.coverage}% coverage</p>
                    </div>
                  </div>
                  <Switch checked={active[c.key]} onCheckedChange={() => toggle(c.key)} />
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h3 className="font-semibold text-sm">Overlay opacity</h3>
            <Slider value={opacity} onValueChange={setOpacity} min={10} max={100} step={5} />
            <p className="text-[11px] text-muted-foreground">Adjust how strongly classes blend onto the orthomosaic.</p>
          </div>

          <Button className="w-full gap-2" onClick={generateReport} disabled={generating}>
            <Download className="w-4 h-4" /> {generating ? "Generating…" : "One-click report"}
          </Button>
        </aside>
      </div>
    </div>
  );
}

function hslToRgb(hslStr: string): [number, number, number] {
  // accepts "hsl(H S% L%)"
  const m = hslStr.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)/);
  if (!m) return [120, 120, 120];
  const h = parseFloat(m[1]) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

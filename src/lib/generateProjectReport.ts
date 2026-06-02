import jsPDF from "jspdf";
import type { Project } from "@/lib/supabase";
import type { ProjectAnnotation } from "@/lib/projectAnnotations";
import type { AccuracyData } from "@/components/project/AccuracyReport";

interface ReportOptions {
  project: Project;
  annotations: ProjectAnnotation[];
  pilotName?: string;
}

const MARGIN = 48;
const PAGE_W = 595; // A4 portrait points
const PAGE_H = 842;

/**
 * Generates a branded project deliverable PDF report covering metadata,
 * processing accuracy, deliverables, and resolved/open annotations.
 */
export function generateProjectReport({ project, annotations, pilotName }: ReportOptions): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = MARGIN;

  // ─── Header band ──────────────────────────────────────
  doc.setFillColor(20, 64, 48); // forest green
  doc.rect(0, 0, PAGE_W, 84, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Dronie · Project Report", MARGIN, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(new Date().toLocaleString(), PAGE_W - MARGIN, 50, { align: "right" });

  y = 120;
  doc.setTextColor(20, 20, 20);

  // ─── Project meta ─────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(project.name || "Untitled Project", MARGIN, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const meta = [
    ["Status", project.status],
    ["Progress", `${project.progress ?? 0}%`],
    ["Images", String(project.image_count ?? 0)],
    ["Area", project.area_ha ? `${project.area_ha} ha` : "—"],
    ["Created", new Date(project.created_at).toLocaleString()],
    ["Pilot", pilotName ?? "—"],
  ];
  meta.forEach(([k, v]) => {
    doc.setTextColor(110, 110, 110);
    doc.text(`${k}`, MARGIN, y);
    doc.setTextColor(20, 20, 20);
    doc.text(String(v), MARGIN + 90, y);
    y += 16;
  });

  if (project.description) {
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Description", MARGIN, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(project.description, PAGE_W - MARGIN * 2);
    doc.text(lines, MARGIN, y);
    y += lines.length * 12 + 8;
  }

  // ─── Accuracy ─────────────────────────────────────────
  const acc = (project.accuracy_report as AccuracyData | null) ?? null;
  if (acc) {
    y = section(doc, y, "Accuracy & Quality");
    const rows: [string, string][] = [
      ["RMSE horizontal", acc.rmse_horizontal_cm != null ? `${acc.rmse_horizontal_cm.toFixed(1)} cm` : "—"],
      ["RMSE vertical",   acc.rmse_vertical_cm != null ? `${acc.rmse_vertical_cm.toFixed(1)} cm` : "—"],
      ["GSD", acc.gsd_cm_px != null ? `${acc.gsd_cm_px.toFixed(2)} cm/px` : "—"],
      ["Overlap (fwd/side)", acc.overlap_forward != null && acc.overlap_side != null ? `${acc.overlap_forward}% / ${acc.overlap_side}%` : "—"],
      ["GCPs used", acc.gcp_count != null ? String(acc.gcp_count) : "—"],
    ];
    rows.forEach(([k, v]) => { y = kvRow(doc, y, k, v); });
  }

  // ─── Deliverables ─────────────────────────────────────
  const outs = project.outputs ?? [];
  if (outs.length) {
    y = section(doc, y, `Deliverables (${outs.length})`);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    outs.forEach((name) => {
      if (y > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
      doc.setTextColor(20, 64, 48);
      doc.text("•", MARGIN, y);
      doc.setTextColor(20, 20, 20);
      doc.text(name, MARGIN + 14, y);
      y += 14;
    });
  }

  // ─── Annotations ──────────────────────────────────────
  if (annotations.length) {
    y = section(doc, y, `Annotations (${annotations.length})`);
    const open = annotations.filter((a) => !a.resolved);
    const done = annotations.filter((a) => a.resolved);
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 110);
    doc.text(`${open.length} open · ${done.length} resolved`, MARGIN, y);
    y += 18;

    annotations.forEach((a, i) => {
      if (y > PAGE_H - MARGIN - 40) { doc.addPage(); y = MARGIN; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(a.resolved ? 130 : 20, 20, 20);
      doc.text(`${i + 1}. ${a.label || a.kind}${a.resolved ? "  ✓" : ""}`, MARGIN, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      const coord = a.geometry?.lat != null && a.geometry?.lng != null
        ? `${a.geometry.lat.toFixed(5)}, ${a.geometry.lng.toFixed(5)}`
        : "—";
      doc.text(`${a.kind} · ${coord}`, MARGIN, y);
      y += 12;
      if (a.body) {
        doc.setTextColor(60, 60, 60);
        const lines = doc.splitTextToSize(a.body, PAGE_W - MARGIN * 2);
        doc.text(lines, MARGIN, y);
        y += lines.length * 11;
      }
      y += 6;
    });
  }

  // ─── Footer on every page ─────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated by Dronie · ${project.id.slice(0, 8)}`, MARGIN, PAGE_H - 24);
    doc.text(`Page ${p} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 24, { align: "right" });
  }

  return doc.output("blob");
}

function section(doc: jsPDF, y: number, title: string): number {
  if (y > PAGE_H - MARGIN - 60) { doc.addPage(); y = MARGIN; }
  y += 12;
  doc.setDrawColor(20, 64, 48);
  doc.setLineWidth(1.2);
  doc.line(MARGIN, y, MARGIN + 40, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 64, 48);
  doc.text(title, MARGIN, y);
  y += 16;
  doc.setTextColor(20, 20, 20);
  return y;
}

function kvRow(doc: jsPDF, y: number, k: string, v: string): number {
  if (y > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text(k, MARGIN, y);
  doc.setTextColor(20, 20, 20);
  doc.text(v, MARGIN + 140, y);
  return y + 16;
}

/** Trigger a browser download of the generated PDF. */
export function downloadProjectReport(opts: ReportOptions) {
  const blob = generateProjectReport(opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = (opts.project.name || "project").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
  a.download = `${safe}-report.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
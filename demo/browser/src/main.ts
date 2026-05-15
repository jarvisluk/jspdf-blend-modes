import { jsPDF } from "jspdf";
import "svg2pdf.js";
import {
  registerBlendMode,
  renderSvgWithBlendModes,
  withBlendMode
} from "jspdf-blend-modes";

const SVG_NS = "http://www.w3.org/2000/svg";

const PAGE_W = 360;
const PAGE_H = 360;

function buildSampleSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("xmlns", SVG_NS);

  const bg = document.createElementNS(SVG_NS, "rect") as SVGElement;
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", "100");
  bg.setAttribute("height", "100");
  bg.setAttribute("fill", "#FFD700");
  svg.appendChild(bg);

  const stripe = document.createElementNS(SVG_NS, "rect") as SVGElement;
  stripe.setAttribute("x", "0");
  stripe.setAttribute("y", "40");
  stripe.setAttribute("width", "100");
  stripe.setAttribute("height", "20");
  stripe.setAttribute("fill", "#101015");
  svg.appendChild(stripe);

  // Big red "E" — multiply blends with the gold/black underneath.
  const e = document.createElementNS(SVG_NS, "text") as SVGElement;
  e.setAttribute("x", "50");
  e.setAttribute("y", "55");
  e.setAttribute("text-anchor", "middle");
  e.setAttribute("dominant-baseline", "central");
  e.setAttribute("font-family", "Helvetica, Arial, sans-serif");
  e.setAttribute("font-size", "70");
  e.setAttribute("font-weight", "700");
  e.setAttribute("fill", "#FF0000");
  e.setAttribute("class", "blend-target");
  e.style.mixBlendMode = "multiply";
  e.textContent = "E";
  svg.appendChild(e);

  return svg;
}

function downloadBlob(buf: ArrayBuffer, filename: string): void {
  const blob = new Blob([buf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const previewEl = document.getElementById("preview") as HTMLDivElement;
const logEl = document.getElementById("log") as HTMLPreElement;

const sample = buildSampleSvg();
previewEl.appendChild(sample);

function log(msg: string): void {
  const ts = new Date().toLocaleTimeString();
  logEl.textContent = `[${ts}] ${msg}\n` + logEl.textContent;
}

async function exportNaive(): Promise<void> {
  log("Naive: pdf.svg() with mix-blend-mode untouched (svg2pdf paints flat).");
  const pdf = new jsPDF({ unit: "pt", format: [PAGE_W, PAGE_H], compress: false });
  // svg2pdf augments pdf with .svg
  await (pdf as unknown as { svg(el: Element, opts: object): Promise<unknown> }).svg(sample, {
    x: 0,
    y: 0,
    width: PAGE_W,
    height: PAGE_H
  });
  downloadBlob(pdf.output("arraybuffer"), "naive.pdf");
}

async function exportLowLevel(): Promise<void> {
  log("Low-level: registerBlendMode + manual withBlendMode wrapping.");
  const pdf = new jsPDF({ unit: "pt", format: [PAGE_W, PAGE_H], compress: false });
  registerBlendMode(pdf, "Multiply");

  // Background
  pdf.setFillColor(255, 215, 0);
  pdf.rect(0, 0, PAGE_W, PAGE_H, "F");
  pdf.setFillColor(16, 16, 21);
  pdf.rect(0, PAGE_H * 0.4, PAGE_W, PAGE_H * 0.2, "F");

  // Multiply pass
  await withBlendMode(pdf, "Multiply", () => {
    pdf.setFillColor(255, 0, 0);
    pdf.setFont("Helvetica", "bold");
    pdf.setFontSize(220);
    pdf.text("E", PAGE_W / 2, PAGE_H / 2 + 80, { align: "center" });
  });

  downloadBlob(pdf.output("arraybuffer"), "low-level.pdf");
}

async function exportHighLevel(): Promise<void> {
  log("High-level: renderSvgWithBlendModes (auto two-pass + GState wiring).");
  const pdf = new jsPDF({ unit: "pt", format: [PAGE_W, PAGE_H], compress: false });
  await renderSvgWithBlendModes(pdf, sample, {
    x: 0,
    y: 0,
    width: PAGE_W,
    height: PAGE_H,
    blendSelector: ".blend-target"
  });
  downloadBlob(pdf.output("arraybuffer"), "high-level.pdf");
}

document.getElementById("btn-naive")!.addEventListener("click", () => {
  exportNaive().catch((e) => log(`error: ${(e as Error).message}`));
});
document.getElementById("btn-low")!.addEventListener("click", () => {
  exportLowLevel().catch((e) => log(`error: ${(e as Error).message}`));
});
document.getElementById("btn-high")!.addEventListener("click", () => {
  exportHighLevel().catch((e) => log(`error: ${(e as Error).message}`));
});

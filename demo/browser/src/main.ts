import { jsPDF } from "jspdf";
import "svg2pdf.js";
import {
  registerBlendMode,
  renderSvgWithBlendModes,
  withBlendMode
} from "jspdf-blend-modes";
import * as pdfjs from "pdfjs-dist";
// pdf.js requires its worker URL up front. Vite resolves the `?url` import
// to a hashed asset emitted next to the demo's bundle, so the worker keeps
// working when this demo is hosted behind a non-root path (GitHub Pages).
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const SVG_NS = "http://www.w3.org/2000/svg";

const PAGE_W = 360;
const PAGE_H = 360;

type CellId = "naive" | "low" | "high";

/** Builds the same demo SVG used in the README quickstart. */
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

const previewEl = document.getElementById("preview-source") as HTMLDivElement;
const logEl = document.getElementById("log") as HTMLPreElement;

const sample = buildSampleSvg();
previewEl.appendChild(sample);

function log(msg: string): void {
  const ts = new Date().toLocaleTimeString();
  logEl.textContent = `[${ts}] ${msg}\n` + logEl.textContent;
}

/**
 * Render the first page of `pdfBytes` into the canvas inside the cell with
 * id `cellId`, scaling to fit the cell's wrapper while staying crisp on
 * high-DPI displays.
 */
async function renderInto(cellId: CellId, pdfBytes: ArrayBuffer): Promise<void> {
  const cell = document.querySelector<HTMLElement>(`.pdf-cell[data-cell="${cellId}"]`);
  if (!cell) return;
  const wrap = cell.querySelector<HTMLDivElement>(".pdf-canvas-wrap")!;
  const status = cell.querySelector<HTMLSpanElement>(".status")!;
  const dl = cell.querySelector<HTMLAnchorElement>("a.download")!;

  // Provide the bytes to both pdf.js (which transfers the buffer) and the
  // download link (which needs the original bytes). Copy once so a second
  // copy survives the transferable.
  const forPdfjs = pdfBytes.slice(0);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);
  dl.hidden = false;
  dl.href = blobUrl;
  dl.download = `${cellId}.pdf`;
  dl.textContent = "Download .pdf";

  status.textContent = "rendering…";
  wrap.innerHTML = "";
  const canvas = document.createElement("canvas");
  wrap.appendChild(canvas);

  try {
    const doc = await pdfjs.getDocument({ data: forPdfjs }).promise;
    const page = await doc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });

    // Fit the page into the cell's content box, then bump for devicePixelRatio.
    const cellRect = wrap.getBoundingClientRect();
    const fitScale = Math.min(
      cellRect.width / baseViewport.width,
      cellRect.height / baseViewport.height
    );
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const viewport = page.getViewport({ scale: fitScale * dpr });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2d context unavailable");
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    status.textContent = `${doc.numPages} page · ${pdfBytes.byteLength.toLocaleString()} bytes`;
  } catch (err) {
    wrap.innerHTML = "";
    const msg = document.createElement("div");
    msg.className = "placeholder";
    msg.textContent = `pdf.js failed: ${(err as Error).message}`;
    wrap.appendChild(msg);
    status.textContent = "error";
  }
}

async function exportNaive(): Promise<void> {
  log("Naive: pdf.svg() with mix-blend-mode untouched (svg2pdf paints flat).");
  const pdf = new jsPDF({ unit: "pt", format: [PAGE_W, PAGE_H], compress: false });
  await (pdf as unknown as { svg(el: Element, opts: object): Promise<unknown> }).svg(sample, {
    x: 0,
    y: 0,
    width: PAGE_W,
    height: PAGE_H
  });
  await renderInto("naive", pdf.output("arraybuffer"));
}

async function exportLowLevel(): Promise<void> {
  log("Low-level: registerBlendMode + manual withBlendMode wrapping.");
  const pdf = new jsPDF({ unit: "pt", format: [PAGE_W, PAGE_H], compress: false });
  registerBlendMode(pdf, "Multiply");

  pdf.setFillColor(255, 215, 0);
  pdf.rect(0, 0, PAGE_W, PAGE_H, "F");
  pdf.setFillColor(16, 16, 21);
  pdf.rect(0, PAGE_H * 0.4, PAGE_W, PAGE_H * 0.2, "F");

  await withBlendMode(pdf, "Multiply", () => {
    pdf.setFillColor(255, 0, 0);
    pdf.setFont("Helvetica", "bold");
    pdf.setFontSize(220);
    pdf.text("E", PAGE_W / 2, PAGE_H / 2 + 80, { align: "center" });
  });

  await renderInto("low", pdf.output("arraybuffer"));
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
  await renderInto("high", pdf.output("arraybuffer"));
}

function wireButton(id: string, fn: () => Promise<void>): void {
  document.getElementById(id)!.addEventListener("click", () => {
    fn().catch((e) => log(`error: ${(e as Error).message}`));
  });
}

wireButton("btn-naive", exportNaive);
wireButton("btn-low", exportLowLevel);
wireButton("btn-high", exportHighLevel);

document.getElementById("btn-render-all")!.addEventListener("click", () => {
  // Sequential — each render is fast and we want deterministic logs.
  (async () => {
    await exportNaive();
    await exportLowLevel();
    await exportHighLevel();
  })().catch((e) => log(`error: ${(e as Error).message}`));
});

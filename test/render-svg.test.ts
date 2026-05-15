import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import "svg2pdf.js";
import { renderSvgWithBlendModes } from "../src/render-svg.js";
import { countMatches, pdfBytesToLatin1 } from "./helpers/pdf.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Builds a tiny SVG: gold background rect + a red rect marked
 * `mix-blend-mode: multiply`. This is the smallest fixture that exercises
 * the entire two-pass pipeline.
 */
function buildFixtureSvg(): SVGSVGElement {
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

  const accent = document.createElementNS(SVG_NS, "rect") as SVGElement;
  accent.setAttribute("x", "20");
  accent.setAttribute("y", "20");
  accent.setAttribute("width", "60");
  accent.setAttribute("height", "60");
  accent.setAttribute("fill", "#FF0000");
  accent.setAttribute("class", "accent");
  accent.style.mixBlendMode = "multiply";
  svg.appendChild(accent);

  return svg;
}

function makePdf(): jsPDF {
  return new jsPDF({ unit: "pt", format: [200, 200], compress: false });
}

describe("renderSvgWithBlendModes", () => {
  it("draws background then wraps blend element in `q /GsMultiply gs ... Q`", async () => {
    const svg = buildFixtureSvg();
    document.body.appendChild(svg);

    const pdf = makePdf();
    try {
      await renderSvgWithBlendModes(pdf, svg, {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        blendSelector: ".accent"
      });
    } finally {
      document.body.removeChild(svg);
    }

    const txt = pdfBytesToLatin1(pdf.output("arraybuffer"));

    // ExtGState object body present.
    expect(txt).toMatch(/\/Type\s*\/ExtGState[^<>]*\/BM\s*\/Multiply/);
    // Page Resources reference the GState.
    expect(txt).toMatch(/\/GsMultiply\s+\d+\s+0\s+R/);
    // Content stream has the blend-mode scope at least once.
    expect(countMatches(txt, /q\s+\/GsMultiply\s+gs/g)).toBeGreaterThanOrEqual(1);
  });

  it("restores the live DOM after the export pass", async () => {
    const svg = buildFixtureSvg();
    document.body.appendChild(svg);

    const accent = svg.querySelector<SVGElement>(".accent")!;
    expect(accent.style.display).toBe("");
    expect(accent.style.mixBlendMode).toBe("multiply");

    const pdf = makePdf();
    try {
      await renderSvgWithBlendModes(pdf, svg, {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        blendSelector: ".accent"
      });
    } finally {
      document.body.removeChild(svg);
    }

    expect(accent.style.display).toBe("");
    expect(accent.style.mixBlendMode).toBe("multiply");
  });

  it("is a no-op for the wrapper if no blend elements are found", async () => {
    const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
    svg.setAttribute("viewBox", "0 0 100 100");
    const r = document.createElementNS(SVG_NS, "rect") as SVGElement;
    r.setAttribute("width", "100");
    r.setAttribute("height", "100");
    r.setAttribute("fill", "#000");
    svg.appendChild(r);
    document.body.appendChild(svg);

    const pdf = makePdf();
    try {
      await renderSvgWithBlendModes(pdf, svg, { x: 0, y: 0, width: 200, height: 200 });
    } finally {
      document.body.removeChild(svg);
    }

    const txt = pdfBytesToLatin1(pdf.output("arraybuffer"));
    expect(txt).not.toMatch(/\/Type\s*\/ExtGState[^<>]*\/BM/);
    expect(txt).not.toMatch(/\/Gs\w+\s+gs/);
  });

  it("supports multiple distinct modes coexisting (by-mode grouping)", async () => {
    const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
    svg.setAttribute("viewBox", "0 0 100 100");

    const bg = document.createElementNS(SVG_NS, "rect") as SVGElement;
    bg.setAttribute("width", "100");
    bg.setAttribute("height", "100");
    bg.setAttribute("fill", "#FFD700");
    svg.appendChild(bg);

    const m = document.createElementNS(SVG_NS, "rect") as SVGElement;
    m.setAttribute("x", "10");
    m.setAttribute("y", "10");
    m.setAttribute("width", "30");
    m.setAttribute("height", "30");
    m.setAttribute("fill", "#FF0000");
    m.setAttribute("class", "m");
    m.style.mixBlendMode = "multiply";
    svg.appendChild(m);

    const s = document.createElementNS(SVG_NS, "rect") as SVGElement;
    s.setAttribute("x", "60");
    s.setAttribute("y", "60");
    s.setAttribute("width", "30");
    s.setAttribute("height", "30");
    s.setAttribute("fill", "#0000FF");
    s.setAttribute("class", "s");
    s.style.mixBlendMode = "screen";
    svg.appendChild(s);

    document.body.appendChild(svg);
    const pdf = makePdf();
    try {
      await renderSvgWithBlendModes(pdf, svg, {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        blendSelector: ".m, .s"
      });
    } finally {
      document.body.removeChild(svg);
    }

    const txt = pdfBytesToLatin1(pdf.output("arraybuffer"));
    expect(txt).toMatch(/\/BM\s*\/Multiply/);
    expect(txt).toMatch(/\/BM\s*\/Screen/);
    expect(txt).toMatch(/q\s+\/GsMultiply\s+gs/);
    expect(txt).toMatch(/q\s+\/GsScreen\s+gs/);
  });

  it("by-element grouping emits one scope per blend element", async () => {
    const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
    svg.setAttribute("viewBox", "0 0 100 100");

    const bg = document.createElementNS(SVG_NS, "rect") as SVGElement;
    bg.setAttribute("width", "100");
    bg.setAttribute("height", "100");
    bg.setAttribute("fill", "#FFD700");
    svg.appendChild(bg);

    for (let i = 0; i < 3; i++) {
      const r = document.createElementNS(SVG_NS, "rect") as SVGElement;
      r.setAttribute("x", String(i * 20));
      r.setAttribute("y", "10");
      r.setAttribute("width", "10");
      r.setAttribute("height", "10");
      r.setAttribute("fill", "#FF0000");
      r.setAttribute("class", "m");
      r.style.mixBlendMode = "multiply";
      svg.appendChild(r);
    }

    document.body.appendChild(svg);
    const pdf = makePdf();
    try {
      await renderSvgWithBlendModes(pdf, svg, {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        blendSelector: ".m",
        groupingStrategy: "by-element"
      });
    } finally {
      document.body.removeChild(svg);
    }

    const txt = pdfBytesToLatin1(pdf.output("arraybuffer"));
    // Three separate `q /GsMultiply gs ... Q` scopes — one per element.
    expect(countMatches(txt, /q\s+\/GsMultiply\s+gs/g)).toBe(3);
  });

  it("predicate selector returning a BlendMode string forces that mode", async () => {
    const svg = buildFixtureSvg();
    document.body.appendChild(svg);

    const pdf = makePdf();
    try {
      await renderSvgWithBlendModes(pdf, svg, {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        blendSelector: (el) => (el.classList.contains("accent") ? "Overlay" : false)
      });
    } finally {
      document.body.removeChild(svg);
    }

    const txt = pdfBytesToLatin1(pdf.output("arraybuffer"));
    expect(txt).toMatch(/\/BM\s*\/Overlay/);
    expect(txt).toMatch(/q\s+\/GsOverlay\s+gs/);
    expect(txt).not.toMatch(/\/BM\s*\/Multiply/);
  });

  it("throws a clear error when the SVG is not mounted in the document", async () => {
    const detached = buildFixtureSvg(); // never appended to document.body
    const pdf = makePdf();

    await expect(
      renderSvgWithBlendModes(pdf, detached, {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        blendSelector: ".accent"
      })
    ).rejects.toThrow(/must be\s+mounted in the document/);
  });

  it("removes parked isolated SVGs from document.body after the pass", async () => {
    const svg = buildFixtureSvg();
    document.body.appendChild(svg);

    const before = document.body.querySelectorAll("svg").length;

    const pdf = makePdf();
    try {
      await renderSvgWithBlendModes(pdf, svg, {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        blendSelector: ".accent"
      });
    } finally {
      document.body.removeChild(svg);
    }

    // No leftover off-screen parked SVGs.
    expect(document.body.querySelectorAll("svg").length).toBe(Math.max(before - 1, 0));
  });
});

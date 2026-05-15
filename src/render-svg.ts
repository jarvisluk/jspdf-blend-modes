import type { jsPDF } from "jspdf";
import { cssToPdfBlendMode, type BlendMode } from "./modes.js";
import { registerBlendMode, withBlendMode } from "./gstate.js";
import { hideElements, mirrorBaselines } from "./prepare.js";
import { buildIsolatedSvg } from "./isolate.js";

/**
 * Predicate for matching SVG elements that should be drawn under a custom
 * blend-mode pass. The predicate may return:
 *
 *   - `true`  → element participates in blending; mode read from
 *               `getComputedStyle(el).mixBlendMode`.
 *   - a `BlendMode` string → use this mode regardless of CSS.
 *   - `false` / `null` / `undefined` → skip element.
 */
export type BlendSelector =
  | string
  | ((el: SVGElement) => boolean | BlendMode | null | undefined);

export interface RenderSvgWithBlendModesOptions {
  /** Top-left X of the placed SVG in PDF user units. */
  x: number;
  /** Top-left Y of the placed SVG in PDF user units. */
  y: number;
  /** Placed width in PDF user units. */
  width: number;
  /** Placed height in PDF user units. */
  height: number;
  /**
   * How to identify elements that need a blend-mode pass.
   *
   * Defaults to scanning every descendant and using
   * `getComputedStyle(el).mixBlendMode` (anything ≠ `normal` participates).
   * Pass a CSS selector string for a quick coarse filter, or a predicate for
   * full control. See {@link BlendSelector}.
   */
  blendSelector?: BlendSelector;
  /**
   * Mirror `dominant-baseline` → `alignment-baseline` for the duration of
   * the export pass (svg2pdf.js reads the latter, but most authoring tools
   * emit the former). Default `true`.
   */
  fixDominantBaseline?: boolean;
  /**
   * Grouping strategy for the blend-mode passes:
   *
   *   - `"by-mode"` (default): one ExtGState pass per distinct blend mode.
   *     All elements sharing a mode are drawn together. Cheaper but does
   *     not preserve original z-order between elements with *different*
   *     blend modes.
   *   - `"by-element"`: one pass per element, in document order. Preserves
   *     z-order at the cost of more `pdf.svg(...)` calls.
   */
  groupingStrategy?: "by-mode" | "by-element";
  /**
   * Hook the library calls right before invoking `pdf.svg()` for the
   * background pass. Useful for last-minute DOM tweaks. Returns nothing.
   */
  onBeforeBasePass?: (svg: SVGSVGElement) => void;
  /**
   * Optional injection point for the svg2pdf.js module. If omitted, the
   * library lazy-imports `svg2pdf.js` (the recommended path), which has the
   * side-effect of monkey-patching `pdf.svg`. Pass an explicit module if
   * you've already imported it elsewhere or want to avoid dynamic import.
   */
  svg2pdfModule?: unknown;
}

/**
 * `pdf.svg(svgElement, opts) => Promise<jsPDF>` is a runtime augmentation
 * added by the `svg2pdf.js` plugin. We type only the surface we use.
 */
interface PdfWithSvg {
  svg(
    el: Element,
    opts: { x: number; y: number; width: number; height: number }
  ): Promise<unknown>;
}

let svg2pdfLoaded: Promise<void> | null = null;
async function ensureSvg2Pdf(custom?: unknown): Promise<void> {
  if (custom !== undefined) return;
  if (!svg2pdfLoaded) {
    svg2pdfLoaded = (async () => {
      try {
        await import(/* @vite-ignore */ "svg2pdf.js");
      } catch (e) {
        throw new Error(
          "[jspdf-blend-modes] `renderSvgWithBlendModes` requires the optional peer dependency " +
            "`svg2pdf.js`. Install it with: npm i svg2pdf.js\n" +
            `Underlying error: ${(e as Error).message}`
        );
      }
    })();
  }
  await svg2pdfLoaded;
}

function ensurePdfHasSvg(pdf: jsPDF): asserts pdf is jsPDF & PdfWithSvg {
  if (typeof (pdf as unknown as { svg?: unknown }).svg !== "function") {
    throw new Error(
      "[jspdf-blend-modes] `pdf.svg` is not available. Did `svg2pdf.js` load? " +
        "If you're tree-shaking, import it once at app startup so it can attach " +
        "itself to jsPDF's prototype."
    );
  }
}

/**
 * Resolves an element-set + per-element mode pair from the user's selector.
 * Precondition: the SVG is in `document` (so `getComputedStyle` works).
 */
function collectBlendTargets(
  svg: SVGSVGElement,
  selector: BlendSelector | undefined
): Array<{ el: SVGElement; mode: BlendMode }> {
  const out: Array<{ el: SVGElement; mode: BlendMode }> = [];
  const win = svg.ownerDocument.defaultView;
  if (!win) return out;

  const candidates: SVGElement[] =
    typeof selector === "string"
      ? Array.from(svg.querySelectorAll<SVGElement>(selector))
      : Array.from(svg.querySelectorAll<SVGElement>("*"));

  for (const el of candidates) {
    let mode: BlendMode | null = null;
    if (typeof selector === "function") {
      const result = selector(el);
      if (result === true) mode = cssToPdfBlendMode(win.getComputedStyle(el).mixBlendMode);
      else if (typeof result === "string") mode = result as BlendMode;
      else mode = null;
    } else {
      mode = cssToPdfBlendMode(win.getComputedStyle(el).mixBlendMode);
    }
    if (mode) out.push({ el, mode });
  }

  return out;
}

interface ParkedSvg {
  svg: SVGSVGElement;
  remove(): void;
}

/**
 * Mounts an isolated SVG into the document at an off-screen position so
 * svg2pdf.js can call `getBoundingClientRect()` on it. Caller MUST call
 * `remove()` in a `finally` block.
 */
function parkSvg(svg: SVGSVGElement, viewBoxWidth: number, viewBoxHeight: number): ParkedSvg {
  svg.style.position = "absolute";
  svg.style.left = "-99999px";
  svg.style.top = "0";
  svg.setAttribute("width", String(viewBoxWidth));
  svg.setAttribute("height", String(viewBoxHeight));
  const doc = svg.ownerDocument;
  doc.body.appendChild(svg);
  return {
    svg,
    remove: () => {
      if (svg.parentNode) svg.parentNode.removeChild(svg);
    }
  };
}

/**
 * Parses a `viewBox` string into `[minX, minY, width, height]`. Falls back to
 * the `width` / `height` attributes (or `0 0 0 0`) when missing. We only need
 * width and height, so the return is just those two.
 */
function getViewBoxSize(svg: SVGSVGElement): { width: number; height: number } {
  const vb = svg.getAttribute("viewBox");
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return { width: parts[2] as number, height: parts[3] as number };
    }
  }
  const w = parseFloat(svg.getAttribute("width") ?? "0");
  const h = parseFloat(svg.getAttribute("height") ?? "0");
  return { width: Number.isFinite(w) ? w : 0, height: Number.isFinite(h) ? h : 0 };
}

/**
 * High-level glue around svg2pdf.js + jsPDF that round-trips CSS
 * `mix-blend-mode` into native PDF 1.4 blend modes via the low-level
 * `withBlendMode` API.
 *
 * Algorithm:
 *
 *   1. Identify all elements that need blending (per `blendSelector`).
 *   2. Optionally mirror `dominant-baseline` → `alignment-baseline`.
 *   3. Pass 1: hide every blend element, then `pdf.svg(svg, ...)` to draw
 *      the background once, in original z-order.
 *   4. For each group (per `groupingStrategy`):
 *        a. Build an isolated SVG containing only the group's elements,
 *           with `display:none` stripped so they actually paint.
 *        b. Park it off-screen so `getBoundingClientRect` works.
 *        c. Wrap a `pdf.svg(...)` call in `q /<gs> gs ... Q` so the PDF
 *           viewer composites it under the chosen blend mode.
 *   5. Restore all DOM mutations.
 *
 * The function is fully reversible: every DOM write is undone in `finally`,
 * so it is safe to run on a `<svg>` that is currently mounted in a live
 * preview. It does **not** call `pdf.save(...)` — that's the caller's
 * responsibility.
 */
export async function renderSvgWithBlendModes(
  pdf: jsPDF,
  svg: SVGSVGElement,
  opts: RenderSvgWithBlendModesOptions
): Promise<void> {
  await ensureSvg2Pdf(opts.svg2pdfModule);
  ensurePdfHasSvg(pdf);

  const placement = { x: opts.x, y: opts.y, width: opts.width, height: opts.height };
  const groupingStrategy = opts.groupingStrategy ?? "by-mode";

  // Collect blend targets BEFORE we mutate the DOM (mirror baselines, hide
  // elements). The list is just a snapshot of references; the elements
  // themselves are not modified yet.
  const targets = collectBlendTargets(svg, opts.blendSelector);

  const baselineRestore = opts.fixDominantBaseline === false ? null : mirrorBaselines(svg);
  const hideRestore =
    targets.length > 0 ? hideElements(targets.map((t) => t.el)) : null;

  try {
    opts.onBeforeBasePass?.(svg);
    // Pass 1 — draw the background with all blend elements hidden.
    await pdf.svg(svg, placement);

    if (targets.length === 0) return;

    // Pre-register every distinct mode so all GState dictionary entries are
    // emitted on first content write. (Idempotent.)
    const distinctModes = new Set(targets.map((t) => t.mode));
    for (const mode of distinctModes) registerBlendMode(pdf, mode);

    const { width: vbW, height: vbH } = getViewBoxSize(svg);
    const safeVbW = vbW > 0 ? vbW : opts.width;
    const safeVbH = vbH > 0 ? vbH : opts.height;

    const groups: Array<{ mode: BlendMode; els: SVGElement[] }> = [];
    if (groupingStrategy === "by-element") {
      for (const t of targets) groups.push({ mode: t.mode, els: [t.el] });
    } else {
      const byMode = new Map<BlendMode, SVGElement[]>();
      for (const t of targets) {
        let arr = byMode.get(t.mode);
        if (!arr) {
          arr = [];
          byMode.set(t.mode, arr);
        }
        arr.push(t.el);
      }
      for (const [mode, els] of byMode) groups.push({ mode, els });
    }

    for (const group of groups) {
      const isolated = buildIsolatedSvg(svg, group.els);
      if (!isolated) continue;

      const parked = parkSvg(isolated, safeVbW, safeVbH);
      try {
        await withBlendMode(pdf, group.mode, async () => {
          await pdf.svg(parked.svg, placement);
        });
      } finally {
        parked.remove();
      }
    }
  } finally {
    if (hideRestore) hideRestore();
    if (baselineRestore) baselineRestore();
  }
}

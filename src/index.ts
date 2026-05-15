/**
 * jspdf-blend-modes — Real PDF 1.4 blend modes for jsPDF and svg2pdf.js.
 *
 * Two layers:
 *
 *   - Low level (`./gstate` subpath, also re-exported here): pure jsPDF, no
 *     DOM. Use `registerBlendMode` / `withBlendMode` to paint your own
 *     drawing operations under any of the 16 PDF 1.4 blend modes.
 *
 *   - High level (this entry point only): browser-only. Use
 *     `renderSvgWithBlendModes` to round-trip CSS `mix-blend-mode` from a
 *     live SVG into a vector PDF, via svg2pdf.js (optional peer dep).
 *
 * Node / SSR consumers who only need the low-level API should import from
 * `jspdf-blend-modes/gstate` instead of the bare specifier — that avoids
 * pulling the DOM-touching `render-svg.ts` into their bundle.
 */

export {
  registerBlendMode,
  withBlendMode,
  BLEND_MODES,
  defaultGStateName,
  cssToPdfBlendMode,
  isBlendMode
} from "./gstate.js";

export type { BlendMode, RegisterBlendModeOptions } from "./gstate.js";

export { renderSvgWithBlendModes } from "./render-svg.js";

export type {
  RenderSvgWithBlendModesOptions,
  BlendSelector
} from "./render-svg.js";

export { hideElements, mirrorBaselines } from "./prepare.js";
export { buildIsolatedSvg } from "./isolate.js";
export type { BuildIsolatedSvgOptions } from "./isolate.js";

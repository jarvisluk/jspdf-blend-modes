import type { jsPDF } from "jspdf";
import { defaultGStateName, isBlendMode, type BlendMode } from "./modes.js";
import { forceExtGStateDict, getInternal } from "./internal-api.js";

/**
 * Per-(pdf, name) memo of already-registered ExtGStates so that calling
 * `registerBlendMode` repeatedly with the same arguments is cheap and
 * deterministic. Keyed by `name|mode` so a typo or a mode change surfaces
 * as a fresh registration rather than silently reusing the wrong one.
 */
const REGISTRY = new WeakMap<jsPDF, Map<string, BlendMode>>();

function registryFor(pdf: jsPDF): Map<string, BlendMode> {
  let m = REGISTRY.get(pdf);
  if (!m) {
    m = new Map();
    REGISTRY.set(pdf, m);
  }
  return m;
}

export interface RegisterBlendModeOptions {
  /**
   * Resource name to use inside the PDF (without leading `/`).
   * Defaults to `Gs<Mode>` (e.g. `GsMultiply`). Must be unique per (pdf, mode)
   * combo. Reusing a name with a *different* mode throws — that almost
   * always indicates a bug.
   */
  name?: string;
  /**
   * Constant non-stroking alpha to bake into the ExtGState. Defaults to `1`.
   * Useful when you want a permanent translucent multiply effect, for example.
   */
  ca?: number;
  /** Constant stroking alpha. Defaults to `1`. */
  CA?: number;
}

/**
 * Registers a custom PDF ExtGState resource that switches the blend mode
 * (`/BM`) to the given value, to be referenced as `/<name> gs` in any
 * subsequent content stream.
 *
 * Why this exists: jsPDF's public `GState` only exposes `opacity` and
 * `stroke-opacity` (its internal `putGState` switch hardcodes `/ca` and
 * `/CA`). PDF's native blend modes (per PDF 1.4) are simply not surfaced.
 * We use jsPDF's documented `internal` API to inject our own ExtGState
 * object alongside the regular gStates dictionary.
 *
 * The function is idempotent: calling it twice with the same `(pdf, mode, name)`
 * is a no-op and returns the same name. Calling it with a colliding name for
 * a different mode throws.
 *
 * @returns The resource name (with no leading `/`) to use in `/<name> gs`.
 */
export function registerBlendMode(
  pdf: jsPDF,
  mode: BlendMode,
  opts: RegisterBlendModeOptions = {}
): string {
  if (!isBlendMode(mode)) {
    throw new TypeError(
      `[jspdf-blend-modes] Unsupported blend mode: ${String(mode)}. ` +
        `Expected one of the 16 PDF 1.4 blend modes (e.g. "Multiply").`
    );
  }

  const name = opts.name ?? defaultGStateName(mode);
  const ca = opts.ca ?? 1;
  const CA = opts.CA ?? 1;

  const reg = registryFor(pdf);
  const existing = reg.get(name);
  if (existing) {
    if (existing !== mode) {
      throw new Error(
        `[jspdf-blend-modes] GState name "${name}" already registered for blend mode ` +
          `"${existing}" — cannot reuse for "${mode}". Pass an explicit \`name\` option.`
      );
    }
    return name;
  }
  reg.set(name, mode);

  const internal = getInternal(pdf);

  let oid: number | null = null;

  // Phase 1 — when jsPDF asks plugins to add extra resource objects (this
  // fires *before* the resource dictionary is written), emit our ExtGState
  // object and remember its PDF object id.
  internal.events.subscribe("putResources", () => {
    oid = internal.newObject();
    internal.write(`<< /Type /ExtGState /BM /${mode} /ca ${ca} /CA ${CA} >>`);
    internal.write("endobj");
  });

  // Phase 2 — when jsPDF emits the /ExtGState dictionary in the page's
  // Resources, append our entry: `/<name> <oid> 0 R`.
  internal.events.subscribe("putGStateDict", () => {
    if (oid !== null) internal.out(`/${name} ${oid} 0 R`);
  });

  forceExtGStateDict(pdf, name);

  return name;
}

/**
 * Wraps a drawing closure in a `q /<name> gs ... Q` graphics-state scope so
 * that everything painted inside is composited through the given blend mode.
 *
 * If `modeOrName` is a {@link BlendMode}, the GState is auto-registered on
 * first use (lazy registration). If it is a string that is *not* one of the
 * 16 standard modes, it is treated as a pre-registered resource name.
 *
 * `fn` may return a Promise — `withBlendMode` will `await` it before emitting
 * the closing `Q`. This is essential when the wrapped work calls async APIs
 * such as `pdf.svg(...)` from svg2pdf.js.
 *
 * @example
 * ```ts
 * await withBlendMode(pdf, "Multiply", async () => {
 *   await pdf.svg(myAccentSvg, { x, y, width, height });
 * });
 * ```
 */
export function withBlendMode<T>(
  pdf: jsPDF,
  modeOrName: BlendMode | string,
  fn: () => T | Promise<T>
): Promise<T> {
  const internal = getInternal(pdf);
  const name = isBlendMode(modeOrName) ? registerBlendMode(pdf, modeOrName) : modeOrName;

  internal.out(`q /${name} gs`);
  // Wrap in a Promise so we always emit the closing `Q` exactly once, even
  // if `fn` throws synchronously or returns a rejected promise.
  return Promise.resolve()
    .then(() => fn())
    .then(
      (value) => {
        internal.out("Q");
        return value;
      },
      (err) => {
        internal.out("Q");
        throw err;
      }
    );
}

export type { BlendMode } from "./modes.js";
export { BLEND_MODES, defaultGStateName, cssToPdfBlendMode, isBlendMode } from "./modes.js";

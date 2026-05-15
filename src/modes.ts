/**
 * The 16 standard PDF 1.4 blend modes, plus the trivial `Normal` (the default
 * source-over composite). These names map 1:1 to the `/BM /<Mode>` value in
 * an ExtGState dictionary and are case-sensitive in the PDF spec.
 *
 * They also align with the CSS `mix-blend-mode` keyword set, with the only
 * caveat being the capitalization (CSS uses kebab/lower-case, PDF uses
 * upper-camel-case). See `cssToPdfBlendMode` for the conversion.
 */
export const BLEND_MODES = [
  "Normal",
  "Multiply",
  "Screen",
  "Overlay",
  "Darken",
  "Lighten",
  "ColorDodge",
  "ColorBurn",
  "HardLight",
  "SoftLight",
  "Difference",
  "Exclusion",
  "Hue",
  "Saturation",
  "Color",
  "Luminosity"
] as const;

export type BlendMode = (typeof BLEND_MODES)[number];

const BLEND_MODE_SET: ReadonlySet<string> = new Set<string>(BLEND_MODES);

/** Type guard: is `value` one of the supported PDF blend modes? */
export function isBlendMode(value: unknown): value is BlendMode {
  return typeof value === "string" && BLEND_MODE_SET.has(value);
}

/**
 * Computes the default ExtGState resource name for a given mode.
 * Examples: `Multiply` → `GsMultiply`, `SoftLight` → `GsSoftLight`.
 *
 * The `Gs` prefix avoids colliding with jsPDF's internal `/Gxxx` names (which
 * are purely numeric) and makes generated content streams readable when
 * grepping the raw PDF (`/GsMultiply gs`).
 */
export function defaultGStateName(mode: BlendMode): string {
  return `Gs${mode}`;
}

/**
 * Maps a CSS `mix-blend-mode` keyword to its PDF blend-mode counterpart.
 * Returns `null` for `normal` / unknown / unsupported values (e.g. `plus-lighter`),
 * letting the caller skip the wrapper entirely.
 */
const CSS_TO_PDF: Readonly<Record<string, BlendMode>> = {
  normal: "Normal",
  multiply: "Multiply",
  screen: "Screen",
  overlay: "Overlay",
  darken: "Darken",
  lighten: "Lighten",
  "color-dodge": "ColorDodge",
  "color-burn": "ColorBurn",
  "hard-light": "HardLight",
  "soft-light": "SoftLight",
  difference: "Difference",
  exclusion: "Exclusion",
  hue: "Hue",
  saturation: "Saturation",
  color: "Color",
  luminosity: "Luminosity"
};

export function cssToPdfBlendMode(cssMode: string | null | undefined): BlendMode | null {
  if (!cssMode) return null;
  const key = cssMode.trim().toLowerCase();
  if (key === "" || key === "normal") return null;
  return CSS_TO_PDF[key] ?? null;
}

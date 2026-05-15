# jspdf-blend-modes

[![CI](https://github.com/JarvisLuk/jspdf-blend-modes/actions/workflows/ci.yml/badge.svg)](https://github.com/JarvisLuk/jspdf-blend-modes/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/jspdf-blend-modes.svg)](https://www.npmjs.com/package/jspdf-blend-modes)
[![bundle size](https://img.shields.io/bundlephobia/minzip/jspdf-blend-modes?label=gzip)](https://bundlephobia.com/package/jspdf-blend-modes)
[![license](https://img.shields.io/npm/l/jspdf-blend-modes.svg)](./LICENSE)

Real **PDF 1.4 blend modes** for [jsPDF](https://github.com/parallax/jsPDF) and
[svg2pdf.js](https://github.com/yWorks/svg2pdf.js) — all 16 modes, plus a
one-call helper that round-trips CSS `mix-blend-mode` from a live SVG into
the PDF. Closes [svg2pdf.js#194](https://github.com/yWorks/svg2pdf.js/issues/194)
and [jsPDF#1255](https://github.com/parallax/jsPDF/issues/1255).

## Install

```bash
npm install jspdf-blend-modes jspdf svg2pdf.js
# or, if you only need the low-level DOM-free API:
npm install jspdf-blend-modes jspdf
```

`jspdf` is a peer dependency; `svg2pdf.js` is an **optional** peer used only
by `renderSvgWithBlendModes`.

## Quickstart

```ts
import { jsPDF } from "jspdf";
import "svg2pdf.js";
import { renderSvgWithBlendModes } from "jspdf-blend-modes";

const pdf = new jsPDF({ unit: "pt", format: [432, 432] });
const svg = document.querySelector<SVGSVGElement>("#my-sticker")!;

await renderSvgWithBlendModes(pdf, svg, { x: 0, y: 0, width: 432, height: 432 });
pdf.save("sticker.pdf");
```

Low-level, DOM-free (SSR-safe):

```ts
import { withBlendMode } from "jspdf-blend-modes/gstate";

await withBlendMode(pdf, "Multiply", () => {
  pdf.setFillColor(255, 0, 0);
  pdf.rect(20, 20, 60, 60, "F");
});
```

## API

- **`jspdf-blend-modes/gstate`** (DOM-free): `registerBlendMode`,
  `withBlendMode`, `BLEND_MODES`, `cssToPdfBlendMode`, `isBlendMode`.
- **`jspdf-blend-modes`** (browser): `renderSvgWithBlendModes(pdf, svg, opts)`
  — opts: `x/y/width/height`, `blendSelector?`, `groupingStrategy?:
"by-mode" | "by-element"`, `fixDominantBaseline?`.

All 16 PDF 1.4 modes: `Normal`, `Multiply`, `Screen`, `Overlay`, `Darken`,
`Lighten`, `ColorDodge`, `ColorBurn`, `HardLight`, `SoftLight`, `Difference`,
`Exclusion`, `Hue`, `Saturation`, `Color`, `Luminosity`.

## Compatibility

jsPDF `>=2.5.0 <6.0.0` · svg2pdf.js `>=2.5.0 <3.0.0` (peer) · Node 18/20/22.
All jsPDF internals are isolated in [`src/internal-api.ts`](./src/internal-api.ts).

## Limitations

- **Z-order across modes.** `groupingStrategy: "by-mode"` (the default)
  collapses all same-mode elements into one pass, which can reorder them
  relative to elements in *other* mode groups. Pass
  `groupingStrategy: "by-element"` to preserve strict document order at the
  cost of one extra `pdf.svg(...)` call per blend element.
- **The high-level API is browser-only.** `renderSvgWithBlendModes` calls
  `getComputedStyle()` and mounts isolated SVGs off-screen. Node and SSR
  consumers should import from the DOM-free
  [`jspdf-blend-modes/gstate`](#api) subpath instead.
- **The SVG must be in the document tree.** `renderSvgWithBlendModes`
  throws an actionable error if the SVG isn't connected: both
  `getComputedStyle` and `getBoundingClientRect` need a live DOM to
  produce meaningful values. Mount the SVG (off-screen if necessary) before
  calling, or render it in your UI normally.
- **ICC color spaces.** Output is sRGB; the library does not set an
  `OutputIntent`. For PDF/X printing pipelines, set the OutputIntent
  yourself and validate against your printer's ICC profile.
- **Isolation boundaries.** PDF blend modes composite against the current
  transparency group. The library uses the page-level group, which matches
  CSS for the common cases. If you wrap a blend in a non-`Normal` parent
  group, results may differ from CSS — file an issue with a reproduction
  and we can add a `groupSelector` option.
- **Fonts.** The library does not register fonts for you. If your SVG uses
  a custom font, register it on the `pdf` instance (`addFileToVFS` /
  `addFont`) before calling `renderSvgWithBlendModes`.
- **CSS keywords outside the PDF spec.** Values like `plus-lighter`,
  `plus-darker`, and `mix-blend-mode: var(--…)` aren't part of the PDF 1.4
  spec; `cssToPdfBlendMode` returns `null` for those and the matched
  element is skipped (drawn under `Normal`). Force a specific mode with the
  predicate form of `blendSelector` if you need an approximation.

## Migrating from a manual ExtGState workaround

If you've been hand-rolling the ExtGState injection through jsPDF's internal
events, the library replaces all of it with a one-liner.

**Before** — direct `internal` access, hand-wired event subscriptions, a
dummy GState to force `/ExtGState` into the page Resources, and a manual
`q ... Q` scope around the second-pass render:

```ts
const internal = (pdf as any).internal;
internal.events.subscribe("putResources", () => {
  const oid = internal.newObject();
  internal.write("<< /Type /ExtGState /BM /Multiply /ca 1 /CA 1 >>");
  internal.write("endobj");
  // ... separate subscription wires the oid into putGStateDict ...
});
// ... force the dictionary to actually be written ...
pdf.addGState("__force__", new (pdf as any).GState({ opacity: 1 }));

internal.out("q /GsMul gs");
await (pdf as any).svg(accentSvg, { x, y, width, height });
internal.out("Q");
```

**After** — low-level helper that handles the registration, the force-emit
hack, and the scope brackets, and is idempotent:

```ts
import { withBlendMode } from "jspdf-blend-modes/gstate";

await withBlendMode(pdf, "Multiply", () =>
  pdf.svg(accentSvg, { x, y, width, height })
);
```

Or, if you're round-tripping a CSS `mix-blend-mode` SVG end-to-end, replace
the entire two-pass orchestration with `renderSvgWithBlendModes`:

```ts
import { renderSvgWithBlendModes } from "jspdf-blend-modes";

await renderSvgWithBlendModes(pdf, svg, {
  x: 0,
  y: 0,
  width: pageWidthPt,
  height: pageHeightPt
});
```

Behavioural notes during migration:

- **No more direct `(pdf as any).internal`** — `withBlendMode` always emits
  the closing `Q`, even if your callback throws.
- **Idempotent registration** — call `registerBlendMode(pdf, "Multiply")` as
  many times as you want; the library deduplicates by `(pdf, mode, name)`.
- **GState names changed** — the default name is `Gs<Mode>` (e.g.
  `GsMultiply`) instead of the ad-hoc `GsMul`. Pass
  `registerBlendMode(pdf, "Multiply", { name: "GsMul" })` if you have
  consumers parsing the raw bytes who depend on the old name.

## Demo

**Live**: <https://jarvisluk.github.io/jspdf-blend-modes/> — runs all three
exports of the same SVG side by side and renders each generated PDF inline
with [pdf.js](https://mozilla.github.io/pdf.js/), so you can see the
multiply blend land or fail without leaving the page.

**Local**:

```bash
npm install && cd demo/browser && npm install && npm run dev
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md)
for local setup, coding style, testing expectations, commit-message conventions,
and the pull request checklist.

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). For
security-sensitive reports, please follow [SECURITY.md](./SECURITY.md) instead
of opening a public issue.

## License

[MIT](./LICENSE)

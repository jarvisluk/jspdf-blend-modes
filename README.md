# jspdf-blend-modes

Real **PDF 1.4 blend modes** for [jsPDF](https://github.com/parallax/jsPDF) and
[svg2pdf.js](https://github.com/yWorks/svg2pdf.js) — all 16 modes, plus a
one-call helper that round-trips CSS `mix-blend-mode` from a live SVG into
the PDF. Closes [svg2pdf.js#194](https://github.com/yWorks/svg2pdf.js/issues/194)
and [jsPDF#1255](https://github.com/parallax/jsPDF/issues/1255).

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

## Demo

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

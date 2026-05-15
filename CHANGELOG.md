# Changelog

All notable changes to this project will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Project contribution guidelines, pull request template, issue templates,
  code of conduct, and security policy.
- GitHub Actions CI matrix: Node 18 / 20 / 22 × jsPDF 2.5 / 3.x / 4.x, plus
  a single static lane (lint + typecheck + build + size + DOM-free import
  check on the `gstate` subpath).
- `size-limit` budget enforced in CI: `gstate` (DOM-free) ≤ 5 KB gzip,
  full library entry ≤ 12 KB gzip. Current numbers: 1.19 KB and 3.38 KB.
- Changesets workflow (`.changeset/`, `release.yml`) for versioning and
  publishing. The `@changesets/cli` is invoked through `npx`, not pinned
  as a `devDependency`, so day-to-day `npm ci` stays light.
- README badges, install instructions, expanded **Limitations** section,
  and a **Migrating from a manual ExtGState workaround** guide.
- Demo (`demo/browser/`) now renders each generated PDF inline with
  pdfjs-dist, so the broken naive svg2pdf export and the two library
  exports are visible side by side without leaving the page.
- `.github/workflows/pages.yml` builds the demo on every push to `main`
  and deploys it to GitHub Pages, giving the README a working live demo
  link.
- Optional zero-dependency pre-commit hook (`.githooks/pre-commit`) that
  runs Prettier, ESLint, and `tsc --noEmit` on staged files. Enable per
  clone with `git config core.hooksPath .githooks`. CONTRIBUTING covers
  the opt-in flow.

### Changed

- `package.json`: real `repository` / `homepage` / `bugs` URLs, `author`,
  `engines.node >=18`, `publishConfig` for npm provenance, and an
  expanded `keywords` set for npm discoverability.
- `src/internal-api.ts`: `getInternal()` now performs an O(1) shape sanity
  check on the jsPDF `internal` surface and throws a single actionable
  `[jspdf-blend-modes]` error on incompatible jsPDF versions, instead of
  failing late with a confusing `TypeError`.
- `src/render-svg.ts`: detect a detached SVG up-front and throw an
  actionable error pointing at `document.body` / the `gstate` subpath,
  preventing the silent "no blend rendered" trap.
- Test environment: `gstate.test.ts` now runs in `node` mode (no
  happy-dom) so the DOM-free contract of the `gstate` subpath is
  enforced from CI. New `gstate.ssr-smoke.test.ts` statically asserts no
  DOM globals appear in the source files reachable through that subpath.

## [0.2.0] — 2026-05-15

### Added

- High-level `renderSvgWithBlendModes(pdf, svg, opts)` — round-trips CSS
  `mix-blend-mode` from a live SVG into PDF 1.4 blend modes via svg2pdf.js.
- `groupingStrategy: "by-mode" | "by-element"` to trade z-order accuracy
  for fewer render passes.
- `BlendSelector` predicate form; lets callers force a specific PDF blend
  mode regardless of computed CSS.
- `hideElements` / `mirrorBaselines` / `buildIsolatedSvg` utility exports.
- `happy-dom` integration tests covering the full two-pass pipeline.
- Minimal Vite demo (`demo/browser/`) with three side-by-side export modes.

## [0.1.0] — 2026-05-15

### Added

- Initial release with the low-level `registerBlendMode` /
  `withBlendMode` API.
- Support for all 16 PDF 1.4 blend modes.
- `jspdf-blend-modes/gstate` subpath export for DOM-free / SSR usage.
- PDF byte-stream unit tests asserting on `/Type /ExtGState /BM /<Mode>`
  and page Resources references.
- TypeScript strict, ESM + CJS dual build via `tsup`.

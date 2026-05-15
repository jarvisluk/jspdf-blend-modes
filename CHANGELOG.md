# Changelog

All notable changes to this project will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Project contribution guidelines, pull request template, issue templates,
  code of conduct, and security policy.

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

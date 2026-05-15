---
"jspdf-blend-modes": patch
---

Internal hardening: stricter jsPDF compatibility check in
`src/internal-api.ts` (early actionable error if the `internal` events
surface is renamed by a future jsPDF major), and a clearer error from
`renderSvgWithBlendModes` when the SVG is not mounted in the document.
DOM-free contract of the `jspdf-blend-modes/gstate` subpath is now
enforced by a Node-environment SSR smoke test. No public API changes.

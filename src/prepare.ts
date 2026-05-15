/**
 * DOM-side preparation helpers for `renderSvgWithBlendModes`.
 *
 * Both functions mutate the live DOM and return a `restore()` function that
 * undoes every change. They are deliberately tiny and side-effect-symmetric
 * so that callers can compose them under a single `try/finally` and never
 * leak DOM state into the live preview.
 *
 * No project-specific logic lives here — that part stays in user code.
 */

/**
 * Sets `display: none !important` on every element in `els` and returns a
 * `restore()` that puts the original `display` value (and its priority) back.
 *
 * Used by `renderSvgWithBlendModes` Pass 1 so svg2pdf.js doesn't draw
 * blend-mode elements as flat opaque fills before we redraw them in
 * Pass 2 under an ExtGState.
 *
 * Iteration over a snapshot: `els` is consumed eagerly so the caller can
 * pass a live `NodeList` from `querySelectorAll` without worrying about it
 * being mutated mid-flight.
 */
export function hideElements(els: Iterable<SVGElement> | ArrayLike<SVGElement>): () => void {
  const snapshot: SVGElement[] = Array.isArray(els)
    ? (els as SVGElement[]).slice()
    : Array.from(els as Iterable<SVGElement>);
  const restorers: Array<() => void> = [];

  for (const el of snapshot) {
    const prevDisplay = el.style.display;
    const prevPriority = el.style.getPropertyPriority("display");
    el.style.setProperty("display", "none", "important");
    restorers.push(() => {
      if (prevDisplay) el.style.setProperty("display", prevDisplay, prevPriority);
      else el.style.removeProperty("display");
    });
  }

  return () => {
    for (const fn of restorers) fn();
  };
}

/**
 * Mirrors every element's `dominant-baseline` attribute into
 * `alignment-baseline` and returns a `restore()` that undoes the writes.
 *
 * Why: svg2pdf.js (as of 2.5–2.7) reads `alignment-baseline` for vertical
 * text alignment but not `dominant-baseline`. Our SVGs commonly use the
 * latter (because that's the CSS-attached property browsers actually
 * respect), so the two need to be kept in sync just for the export pass.
 */
export function mirrorBaselines(svg: SVGSVGElement): () => void {
  const restorers: Array<() => void> = [];
  const els = svg.querySelectorAll<SVGElement>("[dominant-baseline]");

  for (const el of Array.from(els)) {
    const db = el.getAttribute("dominant-baseline");
    if (db === null) continue;
    const prevAb = el.getAttribute("alignment-baseline");
    el.setAttribute("alignment-baseline", db);
    restorers.push(() => {
      if (prevAb !== null) el.setAttribute("alignment-baseline", prevAb);
      else el.removeAttribute("alignment-baseline");
    });
  }

  return () => {
    for (const fn of restorers) fn();
  };
}

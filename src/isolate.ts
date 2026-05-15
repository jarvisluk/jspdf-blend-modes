const SVG_NS = "http://www.w3.org/2000/svg";

export interface BuildIsolatedSvgOptions {
  /**
   * Class names to strip from each cloned element (without the leading dot).
   * Typically the `mix-blend-mode` marker class — blending is handled by the
   * surrounding ExtGState wrapper, not by CSS, so leaving the class on the
   * clone would either be a no-op or trigger external CSS that paints the
   * wrong thing.
   */
  stripClasses?: string[];
  /**
   * Inline `fill` to force on each cloned root element. Belt-and-suspenders
   * for cases where class-based fill rules don't carry over to svg2pdf.js's
   * isolated render pass (it parses `<style>` but resolution can be brittle
   * when only a subset of the original DOM is present).
   */
  inlineFill?: string;
  /**
   * Whether to copy the *first* `<style>` block found in `source` into the
   * isolated SVG. Default `true`. Disable if your CSS rules reference IDs
   * that no longer exist in the isolated tree (those become dead rules
   * which is harmless but wastes parsing).
   */
  keepStyleBlock?: boolean;
}

/**
 * Builds a fresh standalone `<svg>` containing only deep clones of the given
 * `targets`, suitable for being passed back into `pdf.svg(...)` for an
 * isolated render pass under a custom blend-mode ExtGState.
 *
 * Invariants the library guarantees and tests:
 *
 *  1. The returned SVG carries the original `viewBox` and
 *     `preserveAspectRatio` so coordinate math matches the source render.
 *  2. Every cloned element has its inline `display: none` / `visibility: hidden`
 *     stripped — `cloneNode(true)` brings inline styles with it, and the
 *     hide-then-clone flow used by `renderSvgWithBlendModes` would otherwise
 *     produce an isolated SVG that paints absolutely nothing.
 *  3. Class names listed in `stripClasses` are removed (e.g. the
 *     `mix-blend-mode` marker class).
 *
 * Returns the freshly created SVG. The caller owns its lifecycle (mounting,
 * styling, removal). Returns `null` only if `targets` is empty.
 */
export function buildIsolatedSvg(
  source: SVGSVGElement,
  targets: ArrayLike<Element> | Iterable<Element>,
  opts: BuildIsolatedSvgOptions = {}
): SVGSVGElement | null {
  const list = Array.isArray(targets)
    ? (targets as Element[])
    : Array.from(targets as Iterable<Element>);
  if (list.length === 0) return null;

  const ownerDoc: Document = source.ownerDocument;
  const svg = ownerDoc.createElementNS(SVG_NS, "svg") as SVGSVGElement;

  const viewBox = source.getAttribute("viewBox");
  if (viewBox) svg.setAttribute("viewBox", viewBox);

  const preserve = source.getAttribute("preserveAspectRatio");
  if (preserve) svg.setAttribute("preserveAspectRatio", preserve);

  svg.setAttribute("xmlns", SVG_NS);

  if (opts.keepStyleBlock !== false) {
    const styleEl = source.querySelector("style");
    if (styleEl) svg.appendChild(styleEl.cloneNode(true));
  }

  const stripSet = new Set(opts.stripClasses ?? []);

  for (const el of list) {
    const clone = el.cloneNode(true) as Element;

    // CRITICAL: clear the `display:none` / `visibility:hidden` that
    // `hideElements()` set on the source. cloneNode brings inline styles
    // with it, which would suppress drawing in svg2pdf.js.
    if (clone instanceof (ownerDoc.defaultView?.SVGElement ?? Element)) {
      const styled = clone as unknown as SVGElement;
      if (styled.style) {
        styled.style.removeProperty("display");
        styled.style.removeProperty("visibility");
      }
    }

    if (stripSet.size > 0) {
      const cls = clone.getAttribute("class");
      if (cls) {
        const stripped = cls
          .split(/\s+/)
          .filter((c) => c.length > 0 && !stripSet.has(c))
          .join(" ");
        if (stripped) clone.setAttribute("class", stripped);
        else clone.removeAttribute("class");
      }
    }

    if (opts.inlineFill && (clone as { style?: CSSStyleDeclaration }).style) {
      (clone as unknown as SVGElement).style.setProperty("fill", opts.inlineFill, "important");
      clone.setAttribute("fill", opts.inlineFill);
    }

    svg.appendChild(clone);
  }

  return svg;
}

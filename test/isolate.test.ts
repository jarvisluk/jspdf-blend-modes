import { describe, expect, it } from "vitest";
import { buildIsolatedSvg } from "../src/isolate.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function makeSvg(opts: {
  viewBox?: string;
  preserveAspectRatio?: string;
  styleText?: string;
}): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  if (opts.viewBox) svg.setAttribute("viewBox", opts.viewBox);
  if (opts.preserveAspectRatio) svg.setAttribute("preserveAspectRatio", opts.preserveAspectRatio);
  if (opts.styleText) {
    const style = document.createElementNS(SVG_NS, "style");
    style.textContent = opts.styleText;
    svg.appendChild(style);
  }
  return svg;
}

describe("buildIsolatedSvg", () => {
  it("returns null for an empty target list", () => {
    const svg = makeSvg({ viewBox: "0 0 100 100" });
    const out = buildIsolatedSvg(svg, []);
    expect(out).toBeNull();
  });

  it("copies viewBox and preserveAspectRatio from the source", () => {
    const svg = makeSvg({ viewBox: "0 0 200 300", preserveAspectRatio: "xMidYMid meet" });
    const rect = document.createElementNS(SVG_NS, "rect");
    svg.appendChild(rect);

    const out = buildIsolatedSvg(svg, [rect])!;
    expect(out.getAttribute("viewBox")).toBe("0 0 200 300");
    expect(out.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
  });

  it("strips display:none from the cloned target (the cloneNode-display trap)", () => {
    const svg = makeSvg({ viewBox: "0 0 10 10" });
    const rect = document.createElementNS(SVG_NS, "rect") as SVGElement;
    rect.style.setProperty("display", "none", "important");
    rect.style.setProperty("visibility", "hidden");
    svg.appendChild(rect);

    const out = buildIsolatedSvg(svg, [rect])!;
    const cloned = out.querySelector("rect") as SVGElement;
    expect(cloned).not.toBeNull();
    expect(cloned.style.display).toBe("");
    expect(cloned.style.visibility).toBe("");
  });

  it("does not mutate the original element", () => {
    const svg = makeSvg({ viewBox: "0 0 10 10" });
    const rect = document.createElementNS(SVG_NS, "rect") as SVGElement;
    rect.style.setProperty("display", "none", "important");
    rect.setAttribute("class", "blend marker");
    svg.appendChild(rect);

    buildIsolatedSvg(svg, [rect], { stripClasses: ["blend"] });

    expect(rect.style.display).toBe("none");
    expect(rect.getAttribute("class")).toBe("blend marker");
  });

  it("strips listed classes from the clone, keeping the others", () => {
    const svg = makeSvg({ viewBox: "0 0 10 10" });
    const rect = document.createElementNS(SVG_NS, "rect") as SVGElement;
    rect.setAttribute("class", "blend marker");
    svg.appendChild(rect);

    const out = buildIsolatedSvg(svg, [rect], { stripClasses: ["blend"] })!;
    const cloned = out.querySelector("rect") as SVGElement;
    expect(cloned.getAttribute("class")).toBe("marker");
  });

  it("removes the class attribute entirely when all classes are stripped", () => {
    const svg = makeSvg({ viewBox: "0 0 10 10" });
    const rect = document.createElementNS(SVG_NS, "rect") as SVGElement;
    rect.setAttribute("class", "blend");
    svg.appendChild(rect);

    const out = buildIsolatedSvg(svg, [rect], { stripClasses: ["blend"] })!;
    const cloned = out.querySelector("rect") as SVGElement;
    expect(cloned.hasAttribute("class")).toBe(false);
  });

  it("copies the source <style> block by default", () => {
    const svg = makeSvg({ viewBox: "0 0 10 10", styleText: ".foo { fill: red; }" });
    const rect = document.createElementNS(SVG_NS, "rect") as SVGElement;
    rect.setAttribute("class", "foo");
    svg.appendChild(rect);

    const out = buildIsolatedSvg(svg, [rect])!;
    const styleEl = out.querySelector("style");
    expect(styleEl?.textContent).toContain(".foo");
  });

  it("forces inline fill when requested", () => {
    const svg = makeSvg({ viewBox: "0 0 10 10" });
    const rect = document.createElementNS(SVG_NS, "rect") as SVGElement;
    svg.appendChild(rect);

    const out = buildIsolatedSvg(svg, [rect], { inlineFill: "#FF0000" })!;
    const cloned = out.querySelector("rect") as SVGElement;
    expect(cloned.getAttribute("fill")).toBe("#FF0000");
    // Browsers normalize the inline value to `rgb(255, 0, 0)`, happy-dom
    // keeps the original hex. Either is acceptable as long as the value
    // resolves to red. Just check it parses non-empty.
    expect(cloned.style.getPropertyValue("fill")).not.toBe("");
    // And `!important` was preserved.
    expect(cloned.style.getPropertyPriority("fill")).toBe("important");
  });
});

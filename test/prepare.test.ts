import { describe, expect, it } from "vitest";
import { hideElements, mirrorBaselines } from "../src/prepare.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 100 100");
  return svg;
}

describe("hideElements", () => {
  it("sets display:none !important and restores prior value", () => {
    const svg = makeSvg();
    const a = document.createElementNS(SVG_NS, "rect") as SVGElement;
    a.style.setProperty("display", "block");
    svg.appendChild(a);

    const restore = hideElements([a]);
    expect(a.style.display).toBe("none");
    expect(a.style.getPropertyPriority("display")).toBe("important");

    restore();
    expect(a.style.display).toBe("block");
  });

  it("clears display when there was none originally", () => {
    const svg = makeSvg();
    const a = document.createElementNS(SVG_NS, "rect") as SVGElement;
    svg.appendChild(a);
    expect(a.style.display).toBe("");

    const restore = hideElements([a]);
    expect(a.style.display).toBe("none");

    restore();
    expect(a.style.display).toBe("");
  });

  it("snapshots the iterable so live NodeList mutations are safe", () => {
    const svg = makeSvg();
    const a = document.createElementNS(SVG_NS, "rect") as SVGElement;
    const b = document.createElementNS(SVG_NS, "rect") as SVGElement;
    svg.appendChild(a);
    svg.appendChild(b);

    const live = svg.querySelectorAll<SVGElement>("rect");
    const restore = hideElements(live);

    // Mutate the DOM after starting (would mutate `live` if it were not snapshotted).
    const c = document.createElementNS(SVG_NS, "rect") as SVGElement;
    svg.appendChild(c);

    expect(a.style.display).toBe("none");
    expect(b.style.display).toBe("none");
    expect(c.style.display).toBe(""); // not in original snapshot

    restore();
    expect(a.style.display).toBe("");
    expect(b.style.display).toBe("");
  });
});

describe("mirrorBaselines", () => {
  it("copies dominant-baseline into alignment-baseline and reverts", () => {
    const svg = makeSvg();
    const text = document.createElementNS(SVG_NS, "text") as SVGElement;
    text.setAttribute("dominant-baseline", "central");
    svg.appendChild(text);
    document.body.appendChild(svg);

    const restore = mirrorBaselines(svg);
    expect(text.getAttribute("alignment-baseline")).toBe("central");

    restore();
    expect(text.getAttribute("alignment-baseline")).toBeNull();
    document.body.removeChild(svg);
  });

  it("preserves an existing alignment-baseline on restore", () => {
    const svg = makeSvg();
    const text = document.createElementNS(SVG_NS, "text") as SVGElement;
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("alignment-baseline", "baseline");
    svg.appendChild(text);
    document.body.appendChild(svg);

    const restore = mirrorBaselines(svg);
    expect(text.getAttribute("alignment-baseline")).toBe("central");

    restore();
    expect(text.getAttribute("alignment-baseline")).toBe("baseline");
    document.body.removeChild(svg);
  });
});

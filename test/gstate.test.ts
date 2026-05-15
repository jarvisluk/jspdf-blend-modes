import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import {
  BLEND_MODES,
  cssToPdfBlendMode,
  defaultGStateName,
  isBlendMode,
  registerBlendMode,
  withBlendMode
} from "../src/gstate.js";
import { countMatches, pdfBytesToLatin1 } from "./helpers/pdf.js";

/**
 * These tests don't render anything visually — they assert on the raw PDF
 * byte stream. That is the strongest signal we have in a unit-test
 * environment: if `/Type /ExtGState /BM /Multiply` ends up in the bytes
 * and `/GsMultiply <oid> 0 R` ends up in the page Resources, then any
 * compliant PDF viewer will composite under that mode at render time.
 */

function makePdf(): jsPDF {
  // compress:false keeps the page content stream in ASCII so we can grep
  // for `q`, `Q`, `gs`, etc.
  return new jsPDF({ unit: "pt", format: [200, 200], compress: false });
}

describe("modes", () => {
  it("exposes all 16 PDF 1.4 blend modes", () => {
    expect(BLEND_MODES).toContain("Multiply");
    expect(BLEND_MODES).toContain("Luminosity");
    expect(BLEND_MODES).toHaveLength(16);
  });

  it("isBlendMode is a sound type guard", () => {
    expect(isBlendMode("Multiply")).toBe(true);
    expect(isBlendMode("multiply")).toBe(false); // case-sensitive
    expect(isBlendMode("Plus")).toBe(false);
    expect(isBlendMode(undefined)).toBe(false);
  });

  it("defaultGStateName uses the Gs<Mode> convention", () => {
    expect(defaultGStateName("Multiply")).toBe("GsMultiply");
    expect(defaultGStateName("SoftLight")).toBe("GsSoftLight");
  });

  it("cssToPdfBlendMode normalizes the keyword set", () => {
    expect(cssToPdfBlendMode("multiply")).toBe("Multiply");
    expect(cssToPdfBlendMode("soft-light")).toBe("SoftLight");
    expect(cssToPdfBlendMode("color-dodge")).toBe("ColorDodge");
    expect(cssToPdfBlendMode("normal")).toBeNull();
    expect(cssToPdfBlendMode("")).toBeNull();
    expect(cssToPdfBlendMode(null)).toBeNull();
    expect(cssToPdfBlendMode("plus-lighter")).toBeNull();
  });
});

describe("registerBlendMode", () => {
  it("emits an ExtGState object with the requested /BM in the byte stream", () => {
    const pdf = makePdf();
    registerBlendMode(pdf, "Multiply");
    pdf.rect(0, 0, 10, 10, "F");

    const bytes = pdf.output("arraybuffer");
    const txt = pdfBytesToLatin1(bytes);

    expect(txt).toMatch(/<<[^<>]*\/Type\s*\/ExtGState[^<>]*\/BM\s*\/Multiply[^<>]*>>/);
  });

  it("references the GState by name in the page Resources / ExtGState dict", () => {
    const pdf = makePdf();
    registerBlendMode(pdf, "Screen");
    pdf.rect(0, 0, 10, 10, "F");

    const txt = pdfBytesToLatin1(pdf.output("arraybuffer"));

    // Page Resources contain `/ExtGState << ... /GsScreen <oid> 0 R ... >>`.
    // We don't pin the exact oid; just check the name + an indirect ref.
    expect(txt).toMatch(/\/ExtGState\s*<<[^<>]*\/GsScreen\s+\d+\s+0\s+R[^<>]*>>/);
  });

  it("respects a custom name", () => {
    const pdf = makePdf();
    const name = registerBlendMode(pdf, "Overlay", { name: "MyMul" });
    expect(name).toBe("MyMul");
    pdf.rect(0, 0, 10, 10, "F");

    const txt = pdfBytesToLatin1(pdf.output("arraybuffer"));
    expect(txt).toMatch(/\/MyMul\s+\d+\s+0\s+R/);
  });

  it("is idempotent for repeated (mode, name) pairs", () => {
    const pdf = makePdf();
    const a = registerBlendMode(pdf, "Multiply");
    const b = registerBlendMode(pdf, "Multiply");
    expect(a).toBe(b);
    pdf.rect(0, 0, 10, 10, "F");

    const txt = pdfBytesToLatin1(pdf.output("arraybuffer"));
    // Exactly one ExtGState object body for Multiply.
    expect(countMatches(txt, /\/Type\s*\/ExtGState\s*\/BM\s*\/Multiply/g)).toBe(1);
  });

  it("throws when reusing a name with a different mode", () => {
    const pdf = makePdf();
    registerBlendMode(pdf, "Multiply", { name: "GsX" });
    expect(() => registerBlendMode(pdf, "Screen", { name: "GsX" })).toThrow(/already registered/);
  });

  it("throws on an unsupported blend mode", () => {
    const pdf = makePdf();
    expect(() =>
      registerBlendMode(pdf, "Plus" as unknown as Parameters<typeof registerBlendMode>[1])
    ).toThrow(/Unsupported blend mode/);
  });

  it("supports multiple distinct modes coexisting on one page", () => {
    const pdf = makePdf();
    registerBlendMode(pdf, "Multiply");
    registerBlendMode(pdf, "Screen");
    pdf.rect(0, 0, 10, 10, "F");

    const txt = pdfBytesToLatin1(pdf.output("arraybuffer"));
    expect(txt).toMatch(/\/BM\s*\/Multiply/);
    expect(txt).toMatch(/\/BM\s*\/Screen/);
    expect(txt).toMatch(/\/GsMultiply\s+\d+\s+0\s+R/);
    expect(txt).toMatch(/\/GsScreen\s+\d+\s+0\s+R/);
  });
});

describe("withBlendMode", () => {
  it("wraps drawing in a `q /<name> gs ... Q` scope in the content stream", async () => {
    const pdf = makePdf();
    await withBlendMode(pdf, "Multiply", () => {
      pdf.rect(10, 10, 50, 50, "F");
    });

    const txt = pdfBytesToLatin1(pdf.output("arraybuffer"));
    // The scope brackets must appear, with the gs operator in between.
    expect(txt).toMatch(/q\s+\/GsMultiply\s+gs[\s\S]*?Q/);
  });

  it("auto-registers the GState on first use (lazy)", async () => {
    const pdf = makePdf();
    await withBlendMode(pdf, "ColorDodge", () => {
      pdf.rect(0, 0, 10, 10, "F");
    });

    const txt = pdfBytesToLatin1(pdf.output("arraybuffer"));
    expect(txt).toMatch(/\/Type\s*\/ExtGState[^<>]*\/BM\s*\/ColorDodge/);
    expect(txt).toMatch(/\/GsColorDodge\s+\d+\s+0\s+R/);
  });

  it("emits the closing `Q` even when the body throws", async () => {
    const pdf = makePdf();
    await expect(
      withBlendMode(pdf, "Screen", () => {
        pdf.rect(0, 0, 10, 10, "F");
        throw new Error("boom");
      })
    ).rejects.toThrow(/boom/);

    const txt = pdfBytesToLatin1(pdf.output("arraybuffer"));
    // Both the opening and closing operators should still be there.
    expect(txt).toMatch(/q\s+\/GsScreen\s+gs/);
    expect(countMatches(txt, /\bQ\b/g)).toBeGreaterThanOrEqual(1);
  });

  it("awaits async bodies before emitting the closing `Q`", async () => {
    const pdf = makePdf();
    let drewInsideScope = false;

    await withBlendMode(pdf, "Multiply", async () => {
      await Promise.resolve();
      pdf.rect(0, 0, 10, 10, "F");
      drewInsideScope = true;
    });

    expect(drewInsideScope).toBe(true);
    const txt = pdfBytesToLatin1(pdf.output("arraybuffer"));
    // The order in the content stream must be: `q /GsMultiply gs` ... rect operator ... `Q`.
    const scope = txt.match(/q\s+\/GsMultiply\s+gs([\s\S]*?)Q/);
    expect(scope).not.toBeNull();
    // Rect operator in jsPDF: `re` (followed by paint operator). Body must contain it.
    expect(scope?.[1] ?? "").toMatch(/\bre\b/);
  });

  it("accepts a pre-registered name that is not a BlendMode literal", async () => {
    const pdf = makePdf();
    registerBlendMode(pdf, "Multiply", { name: "MyCustomGs" });

    await withBlendMode(pdf, "MyCustomGs", () => {
      pdf.rect(0, 0, 10, 10, "F");
    });

    const txt = pdfBytesToLatin1(pdf.output("arraybuffer"));
    expect(txt).toMatch(/q\s+\/MyCustomGs\s+gs[\s\S]*?Q/);
  });
});

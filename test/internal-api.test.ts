// @vitest-environment node
//
// Regression tests for `getInternal`'s shape sanity check.
//
// jsPDF v5+ may rename or remove pieces of the `internal` event surface
// (see plan.md §6, "jsPDF v5+ rewrites internal events"). When that happens
// we want the failure to be loud, immediate, and self-explanatory, not a
// late `TypeError: undefined is not a function` from the GState pipeline.

import { describe, expect, it } from "vitest";
import type { jsPDF } from "jspdf";
import { getInternal } from "../src/internal-api.js";

function makeFakePdf(internal: unknown): jsPDF {
  return { internal } as unknown as jsPDF;
}

describe("getInternal compatibility check", () => {
  it("accepts a complete internal surface", () => {
    const pdf = makeFakePdf({
      newObject: () => 1,
      write: () => undefined,
      out: () => undefined,
      events: { subscribe: () => undefined }
    });

    const internal = getInternal(pdf);
    expect(typeof internal.newObject).toBe("function");
    expect(typeof internal.events.subscribe).toBe("function");
  });

  it("throws when `internal` is missing entirely", () => {
    expect(() => getInternal(makeFakePdf(undefined))).toThrow(
      /incompatible jsPDF instance: missing `internal`/
    );
  });

  it("throws when `internal` is not an object", () => {
    expect(() => getInternal(makeFakePdf("not-an-object"))).toThrow(
      /incompatible jsPDF instance: missing `internal`/
    );
  });

  it("throws with the missing key name when a required method is absent", () => {
    const pdf = makeFakePdf({
      // newObject missing
      write: () => undefined,
      out: () => undefined,
      events: { subscribe: () => undefined }
    });
    expect(() => getInternal(pdf)).toThrow(/`internal\.newObject` is missing/);
  });

  it("throws when `events.subscribe` is not a function", () => {
    const pdf = makeFakePdf({
      newObject: () => 1,
      write: () => undefined,
      out: () => undefined,
      events: {} // no subscribe
    });
    expect(() => getInternal(pdf)).toThrow(/`internal\.events\.subscribe` is not a function/);
  });
});

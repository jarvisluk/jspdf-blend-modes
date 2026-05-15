// @vitest-environment node
//
// SSR / DOM-free contract check. The `jspdf-blend-modes/gstate` subpath is
// promised to be safe to import on the server, in Node, and from any non-DOM
// runtime. This test enforces that contract from two angles:
//
//   1. The module's source must not statically reference any DOM global.
//   2. Importing the module must succeed even when `document` / `window` /
//      `navigator` / `getComputedStyle` are not present on `globalThis`.
//
// If either of those breaks, this test fails to load — which is exactly the
// signal we want before a regression escapes into a published version.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("jspdf-blend-modes/gstate — SSR / DOM-free contract", () => {
  it("does not reference any DOM global from the source", () => {
    // Strip line and block comments first so prose like "no `document` access"
    // in JSDoc never trips the regex. We're checking *executable* references.
    const sources = ["src/gstate.ts", "src/modes.ts", "src/internal-api.ts"].map((p) =>
      readFileSync(resolve(__dirname, "..", p), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
    );

    const banned = ["document", "window", "navigator", "getComputedStyle", "HTMLElement"];

    for (const [i, code] of sources.entries()) {
      for (const sym of banned) {
        const re = new RegExp(`\\b${sym}\\b`);
        expect(re.test(code), `${["src/gstate.ts", "src/modes.ts", "src/internal-api.ts"][i]} references DOM global \`${sym}\``).toBe(false);
      }
    }
  });

  it("imports cleanly under Node without DOM globals on globalThis", async () => {
    // Confidence check: in this Node-environment test, the DOM globals
    // genuinely aren't there.
    expect((globalThis as Record<string, unknown>).document).toBeUndefined();
    expect((globalThis as Record<string, unknown>).window).toBeUndefined();

    const mod = await import("../src/gstate.js");

    // Spot-check the public API surface so we know we're importing the
    // right thing and not silently getting an empty module.
    expect(typeof mod.registerBlendMode).toBe("function");
    expect(typeof mod.withBlendMode).toBe("function");
    expect(typeof mod.cssToPdfBlendMode).toBe("function");
    expect(Array.isArray(mod.BLEND_MODES)).toBe(true);
    expect(mod.BLEND_MODES).toHaveLength(16);
  });
});

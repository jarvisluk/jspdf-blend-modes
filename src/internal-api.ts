import type { jsPDF } from "jspdf";

/**
 * Centralized, narrow view of the jsPDF `internal` surface we rely on.
 *
 * jsPDF intentionally exposes a low-level "internal" object for plugins; it is
 * documented but not part of the strict public TypeScript types. Every cast
 * to this shape lives in this single file so the rest of the library can stay
 * fully typed and a future jsPDF release that renames events / methods only
 * needs one patch site.
 */
export interface JsPDFInternal {
  /** Allocates a new indirect PDF object and returns its object id. */
  newObject(): number;
  /** Writes one or more strings into the current PDF object body. */
  write(...parts: string[]): void;
  /** Writes a string into the current page content stream (or active body). */
  out(s: string): void;
  /** Plugin event bus. We use `putResources` and `putGStateDict`. */
  events: { subscribe(event: string, cb: () => void): void };
}

/**
 * Constructor for jsPDF's public `GState` class. Used only to register a
 * harmless opacity:1 GState that forces jsPDF to actually emit an
 * `/ExtGState` entry into the page Resources dictionary (without it, the
 * GStateDict pipeline is short-circuited and our injected ExtGState is
 * unreferenced — see `forceExtGStateDict`).
 */
export interface GStateLike {
  // Brand only — actual shape is opaque to us.
  readonly __brand?: "jspdf.GState";
}
export interface GStateConstructor {
  new (params: { opacity?: number; "stroke-opacity"?: number }): GStateLike;
}

interface JsPDFLike {
  internal: JsPDFInternal;
  GState: GStateConstructor;
  addGState: (name: string, gstate: GStateLike) => unknown;
}

/**
 * Returns a typed view onto the jsPDF instance's internal API.
 *
 * Every other module imports `getInternal` instead of casting directly. If
 * a future jsPDF version renames `events.subscribe` or `newObject`, this is
 * the only file that needs to change.
 *
 * Performs a runtime shape sanity check before returning, so that on an
 * incompatible jsPDF version the user sees a single, actionable error
 * (`[jspdf-blend-modes] incompatible jsPDF instance: ...`) instead of
 * a confusing late-bound `TypeError: undefined is not a function` from
 * deep inside the GState pipeline. The check is O(1) — a few `typeof`
 * lookups on properties we'd touch anyway.
 */
export function getInternal(pdf: jsPDF): JsPDFInternal {
  const internal = (pdf as unknown as JsPDFLike).internal as JsPDFInternal | undefined;
  assertCompatibleInternal(internal);
  return internal;
}

function assertCompatibleInternal(
  internal: JsPDFInternal | undefined
): asserts internal is JsPDFInternal {
  if (!internal || typeof internal !== "object") {
    throw new Error(
      "[jspdf-blend-modes] incompatible jsPDF instance: missing `internal` object. " +
        "This library targets jsPDF >=2.5.0 <6.0.0; received an unrecognised build."
    );
  }
  const required: Array<keyof JsPDFInternal> = ["newObject", "write", "out", "events"];
  const bag = internal as unknown as Record<string, unknown>;
  for (const key of required) {
    if (typeof bag[key as string] === "undefined") {
      throw new Error(
        `[jspdf-blend-modes] incompatible jsPDF instance: \`internal.${String(key)}\` is missing. ` +
          "This library targets jsPDF >=2.5.0 <6.0.0; please file an issue with your jsPDF version."
      );
    }
  }
  if (typeof internal.events?.subscribe !== "function") {
    throw new Error(
      "[jspdf-blend-modes] incompatible jsPDF instance: `internal.events.subscribe` is not a function. " +
        "This library targets jsPDF >=2.5.0 <6.0.0; please file an issue with your jsPDF version."
    );
  }
}

/**
 * Returns the jsPDF `GState` constructor exposed on the instance.
 *
 * jsPDF attaches `GState` directly on the document instance (not a static
 * export), so we read it off the same `pdf` object the caller already has.
 */
export function getGStateCtor(pdf: jsPDF): GStateConstructor {
  return (pdf as unknown as JsPDFLike).GState;
}

/**
 * Calls `pdf.addGState` (typed) without dragging unsafe casts elsewhere.
 */
export function addGState(pdf: jsPDF, name: string, gstate: GStateLike): void {
  (pdf as unknown as JsPDFLike).addGState(name, gstate);
}

/**
 * Forces jsPDF to actually emit the `/ExtGState` sub-dictionary into the page
 * Resources by registering a harmless opacity:1 GState via the public API.
 *
 * Why this is needed: jsPDF's `putGStateDict` event (which we hook to inject
 * our custom `/Gs<Name> oid 0 R` entry) is gated behind there being at least
 * one entry in the public gStates map. Without this nudge, `/ExtGState` is
 * never written to the page Resources and the entire blend-mode mechanism
 * silently no-ops.
 *
 * The forced GState's name is namespaced (`__force_extgstate_<name>`) so it
 * never collides with a user-supplied resource name. It is only written
 * once per (pdf, name) pair — repeat calls return immediately.
 */
const forced = new WeakMap<jsPDF, Set<string>>();
export function forceExtGStateDict(pdf: jsPDF, name: string): void {
  let seen = forced.get(pdf);
  if (!seen) {
    seen = new Set<string>();
    forced.set(pdf, seen);
  }
  if (seen.has(name)) return;
  seen.add(name);

  const GStateCtor = getGStateCtor(pdf);
  addGState(pdf, `__force_extgstate_${name}`, new GStateCtor({ opacity: 1 }));
}

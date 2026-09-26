// src/event-keys.ts — the PURE half of the dual-layer webhook idempotency (ADR-0229 rows 50 + 51,
// carved out under ADR-0396). This module decides what a claim key may be and how the per-effect
// composite is spelled; it never touches a database. Its only non-relative edge is the browser-safe
// `@caisson-sh/kernel` barrel, which is what lets it ride the `./browser` entry.
//
// The claim ITSELF — `INSERT INTO billing_processed_event … ON CONFLICT DO NOTHING RETURNING`, run
// inside the caller's `withTenant` transaction against a `TenantExecutor` — stays in idempotency.ts
// and is irreducibly server-only. Nothing here weakens that: a caller holding these two functions can
// validate and spell a key, and can claim nothing.
//
// idempotency.ts is the only in-package caller, so the guards live in exactly one place and the
// messages below are the ones the published `processEvent` / `withIdempotentSideEffect` have always
// thrown, verbatim.
import { ValidationError } from "@caisson-sh/kernel";

/**
 * The outer `sourceEventId` key and the per-effect composite `${sourceEventId}:${sideEffect}`
 * share this one table's namespace. A `sourceEventId` containing `:` could therefore alias a
 * side-effect key (e.g. outer id `"abc:x"` collides with the composite of outer id `"abc"` +
 * side-effect `"x"`) — reject it outright so the two key shapes can never overlap. A blank key would
 * collapse every unattributed event onto one row. Both fail closed, before any claim is attempted.
 *
 * `caller` names the entry point in the thrown message, so a rejection points at the layer the
 * caller actually invoked.
 */
export function assertValidSourceEventId(
  sourceEventId: string,
  caller: string,
): void {
  if (sourceEventId.length === 0) {
    throw new ValidationError(`${caller} requires a non-empty sourceEventId`);
  }
  if (sourceEventId.includes(":")) {
    throw new ValidationError(
      `${caller} requires a sourceEventId without ':' — it would alias the composite side-effect key namespace`,
    );
  }
}

/**
 * The per-effect claim key for {@link import("./idempotency.ts").withIdempotentSideEffect}: validate
 * the sourceEventId INPUT (never the composite, which carries the `:` by construction), refuse a
 * blank effect name, then compose. The caller name is fixed to `withIdempotentSideEffect` because
 * that is the one layer this key shape belongs to — the message is the published one, unchanged.
 */
export function sideEffectEventKey(
  sourceEventId: string,
  sideEffect: string,
): string {
  assertValidSourceEventId(sourceEventId, "withIdempotentSideEffect");
  if (sideEffect.length === 0) {
    throw new ValidationError(
      "withIdempotentSideEffect requires a non-empty sideEffect",
    );
  }
  return `${sourceEventId}:${sideEffect}`;
}

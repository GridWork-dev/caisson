// src/redact.ts — allowlist-based field redaction (binding for the trust page, SPEC piece 3).
//
// Deliberately the OPPOSITE security posture from `@caisson-sh/kernel`'s `scrubDeep`: that scrubber is a
// DENYLIST (a key matching a PHI/secret NAME pattern drops; everything else passes through — opt-out,
// fail-open on an unrecognized field). An adopter-hosted trust page instead needs an ALLOWLIST: a field
// absent from the caller's explicit allowlist never renders, full stop — opt-in, fail-closed on an
// unrecognized field. The two compose (kernel's scrubber is still the right tool for an unstructured
// egress log); this is the tool for a curated, adopter-controlled PUBLIC artifact.
import type { JsonValue } from "@caisson-sh/kernel";

/** A flat fact record — the shape every caller flattens its structured input into before redacting. */
export type FlatFacts = Readonly<Record<string, JsonValue>>;

/**
 * Return a NEW record containing only the keys present in BOTH `facts` and `allowlist`. A key in
 * `allowlist` that `facts` doesn't carry is simply absent from the result (no error — the allowlist is
 * a ceiling, not a required-fields contract). Pure; the input is never mutated. Deterministic key
 * order: iterates `allowlist` (not `facts`), so the result's key order is caller-controlled and stable
 * regardless of the source object's own enumeration order.
 */
export function redactToAllowlist(
  facts: FlatFacts,
  allowlist: readonly string[],
): FlatFacts {
  const out: Record<string, JsonValue> = {};
  for (const key of allowlist) {
    if (Object.hasOwn(facts, key)) out[key] = facts[key] as JsonValue;
  }
  return out;
}

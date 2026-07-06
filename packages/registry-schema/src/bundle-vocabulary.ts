/**
 * Bundle vocabulary (ADR-0257) — the locked bundle-id set and the legacy purchased-id alias map.
 * The four personas plus Provenance and Everything replace the edition purchase ids; historical
 * `kind:"edition"` ledger/index entries stay valid forever, and every legacy purchased id keeps
 * resolving forever through `LEGACY_ENTITLEMENT_ALIASES` (renaming without the alias would 422 the
 * server path and silently downgrade the edge Worker path — the exact failure ADR-0257 forbids).
 *
 * This module is the SHARED vocabulary constant: `expandEntitlements` (the single resolve-time
 * alias point) and every cross-package consumer (Kickoff E's RENEWAL_BOOK lookup, the standards-gate
 * hand-copy, site pricing) normalize through it — consumers never re-key.
 */

/** The locked bundle ids (ADR-0257 §1 / ADR-0258). */
export const BUNDLE_IDS = [
  "compliance",
  "ai-production",
  "local-first",
  "agentic-dev",
  "provenance",
  "everything",
] as const;

export type BundleId = (typeof BUNDLE_IDS)[number];

const BUNDLE_ID_SET: ReadonlySet<string> = new Set<string>(BUNDLE_IDS);

export function isBundleId(id: string): id is BundleId {
  return BUNDLE_ID_SET.has(id);
}

/**
 * Legacy purchased id → new bundle id. A `Map`, not a plain record — purchased ids arrive from
 * stored books/tokens, and a record lookup on a hostile key (`"constructor"`, `"__proto__"`) would
 * leak `Object.prototype` members instead of missing. `compliance` is the identity alias (the
 * compliance bundle keeps its id); `bundle` was the ADR-0012 "buy everything" sentinel.
 */
export const LEGACY_ENTITLEMENT_ALIASES: ReadonlyMap<string, BundleId> =
  new Map([
    ["compliance", "compliance"],
    ["ai-kit", "ai-production"],
    ["local-ai", "local-first"],
    ["agent-dev", "agentic-dev"],
    ["bundle", "everything"],
  ]);

/**
 * Normalize a purchased entitlement id: a legacy edition/bundle-sentinel id maps to its new bundle
 * id; every other id (new bundle ids, module ids, bare slugs — known or not) passes through
 * unchanged. Pure vocabulary — classification and fail-closed rejection of unknown ids stay in
 * `expandEntitlements` (TM-E), which this function must never pre-empt.
 */
export function normalizeEntitlementId(id: string): string {
  return LEGACY_ENTITLEMENT_ALIASES.get(id) ?? id;
}

/**
 * Every stored spelling of one entitlement: the canonical id plus each legacy alias that
 * normalizes to it (identity for module slugs and un-aliased ids). Grant rows written under the
 * old vocabulary (`ai-kit`, `bundle`, …) stay reachable when a caller holds the canonical id —
 * the read-side reverse of `normalizeEntitlementId` (ADR-0257: legacy ids resolve forever).
 */
export function entitlementIdAliasGroup(id: string): readonly string[] {
  const canonical = normalizeEntitlementId(id);
  const group = [canonical];
  for (const [legacy, bundle] of LEGACY_ENTITLEMENT_ALIASES) {
    if (bundle === canonical && legacy !== canonical) group.push(legacy);
  }
  return group;
}

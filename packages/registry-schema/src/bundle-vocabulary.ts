/**
 * Bundle vocabulary (ADR-0257) + the purchased-id alias spine (ADR-0270).
 *
 * The six bundle ids are the locked purchase vocabulary. `LEGACY_ENTITLEMENT_ALIASES` is the SINGLE
 * resolve-time alias point for a purchased id whose spelling has changed — a MODULE RENAME or a carve
 * extraction (ADR-0257 §1 / ADR-0258): a bare slug bought under an old name keeps resolving forever, on
 * every path (server resolver, edge Worker, MCP gate), because `expandEntitlements` normalizes through
 * this one map and no caller pre-normalizes.
 *
 * ADR-0270 (edition-trace purge) NARROWED this spine to nothing-but-the-mechanism: the four dissolved
 * edition ids (`ai-kit`/`local-ai`/`agent-dev`) and the legacy `bundle` "buy-everything" sentinel were
 * REMOVED from this map — zero real buyers hold them (the drain proves it, ADR-0270 §4), so they are the
 * one sanctioned drop. The map is therefore EMPTY today; it stays because the NEXT module rename adds an
 * entry here (never scattered at a caller). The removable-vs-load-bearing rule: an entry is removable iff
 * no live grant row and no issued perpetual token can carry its key; a module-rename/carve entry is
 * load-bearing forever (an offline Ed25519 token signed with the old slug MUST still resolve the same
 * member set) — extend it, never drop it.
 *
 * NOTE: the legacy edition→bundle relation that the INDEX resolution still needs (a bundle purchase must
 * resolve the members its historical `kind:"edition"` meta-package contributes) is NOT here — it moved to
 * `EDITION_BUNDLE_ID` in `./entitlements`, decoupled from this purchase spine. An edition id is no longer
 * a purchasable/normalizable id; it is only a served ledger/index artifact.
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
 * Legacy purchased id → its current spelling. A `Map`, not a plain record — purchased ids arrive from
 * stored books/tokens, and a record lookup on a hostile key (`"constructor"`, `"__proto__"`) would leak
 * `Object.prototype` members instead of missing. Value type is `string` (any canonical id), not `BundleId`
 * — a future module rename maps an old bare slug to a new bare slug, not necessarily to a bundle.
 *
 * EMPTY since ADR-0270 (the edition/bundle-sentinel entries were removed after the grant drain). A future
 * module rename lands its `["old-slug", "new-slug"]` entry here.
 */
export const LEGACY_ENTITLEMENT_ALIASES: ReadonlyMap<string, string> =
  new Map();

/**
 * Normalize a purchased entitlement id: a renamed id maps to its current spelling; every other id (bundle
 * ids, module ids, bare slugs — known or not) passes through unchanged. Pure vocabulary — classification
 * and fail-closed rejection of unknown ids stay in `expandEntitlements` (TM-E), which this function must
 * never pre-empt. With the ADR-0270-narrowed map empty, this is identity today; it stays as the single
 * point the next rename plugs into.
 */
export function normalizeEntitlementId(id: string): string {
  return LEGACY_ENTITLEMENT_ALIASES.get(id) ?? id;
}

/**
 * Every stored spelling of one entitlement: the canonical id plus each legacy alias that normalizes to it
 * (identity for module slugs and un-aliased ids). Grant rows written under an old spelling stay reachable
 * when a caller holds the canonical id — the read-side reverse of `normalizeEntitlementId`. With the map
 * empty (ADR-0270) every id is its own singleton group; a future rename makes the group non-trivial again,
 * and every read-back that folds stored grant ids keeps calling this so it picks the rename up for free.
 */
export function entitlementIdAliasGroup(id: string): readonly string[] {
  const canonical = normalizeEntitlementId(id);
  const group = [canonical];
  for (const [legacy, current] of LEGACY_ENTITLEMENT_ALIASES) {
    if (current === canonical && legacy !== canonical) group.push(legacy);
  }
  return group;
}

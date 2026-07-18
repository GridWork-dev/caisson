// The bundle UPGRADE book (ADR-0247 F7/F8, catalog-rework ADR-0257 §1.2 / ADR-0258 numbers). Two
// pre-declared datasets a buyer's checkout + entitlement resolution read, NEVER computing ad-hoc:
//
//  1. F7 — the bundle-membership TIMELINE (`BUNDLE_MEMBERSHIP_BOOK`): when each member SKU joined
//     each bundle, backfilled with the ADR lock dates. Snapshot-at-sale (F7): a member that joined a
//     bundle AFTER a buyer's `entitledSince` for it is outside that buyer's snapshot. This book is
//     the DATA; the fail-soft filter lives in `@caisson/registry-schema`'s `expandEntitlements`
//     (the open base can't depend "up" on this commercial book, so the caller injects the timeline).
//  2. F8 — the item×bundle upgrade-CREDIT map: upgrading from owned modules/packages to a bundle
//     credits `bundle retail − Σ(owned members' retail)`, floor $0 (ADR-0247 F8). The credit an
//     owned item contributes toward a bundle = that item's retail IF it is a member of the bundle;
//     `resolveUpgradeCredit` is FAIL-CLOSED — an item that is not a creditable member of the bundle
//     (an "unmapped pair") THROWS rather than silently crediting $0 and overcharging the buyer.
//
// Amounts are integer USD (money is never a float, ADR-0007), the ADR-0258/0260 locked catalog. The
// per-price-id `PURCHASE_BOOK`/`PLAN_BOOK` keep NO dollar amount (those live on the Paddle product +
// the site display sheet); the F8 credit map is a DIFFERENT structure that inherently carries the
// retail it credits, so it is the commerce SOT for upgrade arithmetic (ADR-0247 §Consequences:
// "the map lives in pricebook"). Append-only + versioned like the sibling books (ADR-0006).
import { ConfigError } from "@caisson/kernel";
import { BUNDLE_IDS, type BundleId } from "@caisson/registry-schema";

/** Append-only version stamp — an upgrade-book change bumps this, never edits it in place. */
export const UPGRADE_BOOK_VERSION = "2026-07-18.1";

/**
 * Every creditable commercial SKU → its retail price (integer USD, ADR-0258/0260). The single
 * amounts table: an item's F8 upgrade credit toward ANY bundle it belongs to is its retail here.
 * Base/Apache modules (kernel, tenancy-rls, …) are free and never à-la-carte, so they are absent —
 * a buyer never OWNS them as a purchase, so they never contribute a credit. `@caisson/brand`
 * (private, never sold) is likewise absent.
 *
 * Kept in USD (not cents) to mirror `apps/site/lib/pricing.ts`, the display SOT these numbers must
 * agree with; a pricing move re-runs the ADR-0260 §2 formula and bumps both. NOTE: a few source
 * manifests still carry a stale `priceCents` (e.g. tool-exec 4900 vs the ADR-0260 $99 lock) — the
 * ADR numbers here are authoritative; the manifest reprice is a later (W5/W7) wave.
 */
export const SKU_RETAIL: Readonly<Record<string, number>> = {
  // Compliance carves (ADR-0257 §2b) + members
  "compliance-core": 299,
  "frameworks-pack": 249,
  "signing-primitive": 199,
  "audit-worm": 149,
  "field-crypto": 199,
  alerting: 149,
  "retention-runner": 199,
  // AI-Production members (+ credits fold-in, ADR-0258 §2)
  "ai-meter": 199,
  "ai-evals": 199,
  guardrails: 149,
  "prompt-registry": 99,
  credits: 149,
  // Local-first 3-way carve (ADR-0258 §1) + members
  "local-sync": 199,
  "local-inference": 249,
  "local-privacy": 99,
  "local-store": 99,
  // Agentic-Dev members
  "agent-kernel": 199,
  "agent-runner": 49,
  "agent-trajectory": 49,
  "tool-exec": 99,
  // Standalone commercial SKUs (in Everything, not in a persona bundle)
  "org-controls": 249,
  "billing-orchestration": 99,
  "ui-pro": 129,
};

/** Each bundle's retail (integer USD, ADR-0258 final numbers) — the `bundle − owned` base of an F8
 *  upgrade quote. Keyed by the shared `BundleId` vocabulary (ADR-0257 — never re-keyed). */
export const BUNDLE_RETAIL: Readonly<Record<BundleId, number>> = {
  compliance: 1049,
  "ai-production": 739,
  "local-first": 629,
  "agentic-dev": 329,
  provenance: 399,
  everything: 2059,
};

/** The lock-date anchors the timeline is backfilled with (there are no live buyers pre-launch, so
 *  these seed the machinery; exactness is cosmetic until checkout is live). */
const GENESIS = "2026-06-01T00:00:00.000Z"; // original edition members (ADR-0020-0023 lineage)
const STAGE2 = "2026-07-01T00:00:00.000Z"; // Stage-2 harvest members (alerting/retention/tool-exec/agent-runner)
const CATALOG_REWORK = "2026-07-06T00:00:00.000Z"; // ADR-0257/0258 carves, fold-ins, net-new bundles
const AGENT_RUNTIME = "2026-07-18T00:00:00.000Z"; // agent-runtime wave: agent-trajectory joins agentic-dev

/**
 * F7 bundle-membership TIMELINE: `bundleId → (memberSku → ISO join instant)`. A member's join date
 * is when THAT (bundle, member) relationship was established — an original edition member is GENESIS;
 * a Stage-2 harvest member is STAGE2; a catalog-rework carve/fold-in, or any member of the net-new
 * Provenance bundle, is CATALOG_REWORK. `everything` is deliberately ABSENT (see
 * {@link bundleMembershipTimeline}) — it is the whole catalog, grandfathered, never member-filtered.
 * The KEYS of each entry are the bundle's creditable commercial members; every key MUST have a
 * `SKU_RETAIL` price (`upgrades.test.ts` pins it).
 */
export const BUNDLE_MEMBERSHIP_BOOK: Readonly<
  Record<Exclude<BundleId, "everything">, Readonly<Record<string, string>>>
> = {
  compliance: {
    "compliance-core": CATALOG_REWORK,
    "frameworks-pack": CATALOG_REWORK,
    "signing-primitive": CATALOG_REWORK,
    "audit-worm": GENESIS,
    "field-crypto": GENESIS,
    alerting: STAGE2,
    "retention-runner": STAGE2,
  },
  "ai-production": {
    "ai-meter": GENESIS,
    "ai-evals": CATALOG_REWORK, // fold-in: standaloneOnly dropped, joins the bundle now
    guardrails: GENESIS,
    "prompt-registry": GENESIS,
    "field-crypto": GENESIS,
    credits: CATALOG_REWORK, // credits joins AI-Production (ADR-0258 §2)
  },
  "local-first": {
    "local-sync": CATALOG_REWORK,
    "local-inference": CATALOG_REWORK,
    "local-privacy": CATALOG_REWORK,
    "local-store": GENESIS,
    "field-crypto": GENESIS,
  },
  "agentic-dev": {
    "agent-kernel": GENESIS,
    "agent-runner": STAGE2,
    "agent-trajectory": AGENT_RUNTIME,
    "tool-exec": STAGE2,
    "local-store": GENESIS,
  },
  provenance: {
    // net-new bundle (ADR-0257) — every membership is established at catalog-rework
    "signing-primitive": CATALOG_REWORK,
    "audit-worm": CATALOG_REWORK,
    "field-crypto": CATALOG_REWORK,
  },
};

const EMPTY_TIMELINE: Readonly<Record<string, string>> = {};

/** The persona bundle's timeline (the `?? EMPTY_TIMELINE` fallback is unreachable — the book is a
 *  full record over every non-`everything` bundle — but satisfies `noUncheckedIndexedAccess`). */
function personaTimeline(
  bundleId: Exclude<BundleId, "everything">,
): Readonly<Record<string, string>> {
  return BUNDLE_MEMBERSHIP_BOOK[bundleId] ?? EMPTY_TIMELINE;
}

/**
 * The per-member join-date timeline for `bundleId` — the map the `@caisson/registry-schema`
 * snapshot filter consumes (its keys are the creditable members). `everything` returns `{}`: the
 * whole catalog is grandfathered, so no member is snapshot-filtered (fail-soft by lock, ADR-0257).
 */
export function bundleMembershipTimeline(
  bundleId: BundleId,
): Readonly<Record<string, string>> {
  return bundleId === "everything" ? EMPTY_TIMELINE : personaTimeline(bundleId);
}

/** The creditable member SKUs of `bundleId`: a persona bundle's timeline keys, or — for
 *  `everything` (the whole catalog) — every priced SKU. */
export function creditableMembers(bundleId: BundleId): readonly string[] {
  return bundleId === "everything"
    ? Object.keys(SKU_RETAIL)
    : Object.keys(personaTimeline(bundleId));
}

/** True iff `itemId` is a creditable member of `bundleId` (owning it credits toward the upgrade). */
export function isCreditableMember(
  itemId: string,
  bundleId: BundleId,
): boolean {
  return bundleId === "everything"
    ? Object.hasOwn(SKU_RETAIL, itemId)
    : Object.hasOwn(personaTimeline(bundleId), itemId);
}

const BUNDLE_ID_SET: ReadonlySet<string> = new Set<string>(BUNDLE_IDS);

/**
 * The F8 upgrade credit an owned `itemId` contributes toward upgrading to `bundleId` — its retail.
 * FAIL-CLOSED (ADR-0247 F8): an unknown bundle, or an item that is NOT a creditable member of the
 * bundle (an unmapped pair), THROWS — never a silent $0 that would undercredit and overcharge the
 * buyer. A member with no `SKU_RETAIL` price is a data gap and likewise throws. Callers crediting a
 * buyer's mixed owned set filter to members first ({@link upgradeQuote}); this primitive is the
 * guard against asking for a pair that should not resolve.
 */
export function resolveUpgradeCredit(itemId: string, bundleId: string): number {
  if (!BUNDLE_ID_SET.has(bundleId)) {
    throw new ConfigError(`unknown bundle id for upgrade credit: ${bundleId}`);
  }
  const bundle = bundleId as BundleId;
  if (!isCreditableMember(itemId, bundle)) {
    throw new ConfigError(
      `no upgrade-credit mapping for item ${itemId} toward bundle ${bundleId} (not a creditable member)`,
    );
  }
  const retail = Object.hasOwn(SKU_RETAIL, itemId)
    ? SKU_RETAIL[itemId]
    : undefined;
  if (retail === undefined) {
    throw new ConfigError(
      `creditable member ${itemId} has no retail price (upgrade-credit data gap)`,
    );
  }
  return retail;
}

/** An F8 upgrade quote: what the buyer pays to move from owned items to `bundle`. */
export interface UpgradeQuote {
  readonly bundleId: BundleId;
  /** The bundle's retail (integer USD). */
  readonly bundleRetail: number;
  /** The owned items (of the input set) that are creditable members of the bundle. */
  readonly creditedItems: readonly string[];
  /** Σ of the credited items' retail (integer USD). */
  readonly credit: number;
  /** `bundleRetail − credit`, floored at $0 (ADR-0247 F8) — never ad-hoc arithmetic in the cart. */
  readonly upgradePrice: number;
}

/**
 * Compute the F8 upgrade quote to `bundleId` for a buyer who OWNS `ownedItemIds` (edition/module
 * ids). `bundleId` is a plain string, narrowed fail-closed here (an unknown bundle THROWS) so the
 * checkout can pass a raw catalog id without importing the bundle-vocabulary type. Only owned items
 * that are creditable members of the bundle contribute their retail credit (owning an unrelated SKU
 * is ignored — not a fail-closed case); each credited item resolves through the fail-closed
 * {@link resolveUpgradeCredit}. `upgradePrice = max(0, bundleRetail − Σ credits)`. Pure + integer
 * USD, so the cart reads a pre-declared number and never recomputes `bundle − owned` ad-hoc.
 */
export function upgradeQuote(
  bundleId: string,
  ownedItemIds: readonly string[],
): UpgradeQuote {
  if (!BUNDLE_ID_SET.has(bundleId)) {
    throw new ConfigError(`unknown bundle id for upgrade quote: ${bundleId}`);
  }
  const bundle = bundleId as BundleId;
  const bundleRetail = BUNDLE_RETAIL[bundle];
  const creditedItems = [...new Set(ownedItemIds)].filter((id) =>
    isCreditableMember(id, bundle),
  );
  const credit = creditedItems.reduce(
    (sum, id) => sum + resolveUpgradeCredit(id, bundle),
    0,
  );
  return {
    bundleId: bundle,
    bundleRetail,
    creditedItems,
    credit,
    upgradePrice: Math.max(0, bundleRetail - credit),
  };
}

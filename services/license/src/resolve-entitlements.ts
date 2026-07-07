// The account entitlement RESOLVER (ADR-0071): an account → its entitled member-module slug set.
// Reads the account's stored PURCHASED IDS (editions/bundle/modules, entitlement-store.ts) and
// expands them against the BUILT registry index (`expandEntitlements`). Membership derives from the
// index alone (ADR-0071 binding) — never from a frozen list — so a module added to an edition reaches
// existing buyers through the index, with no store rewrite. Expansion is fail-closed: a stored
// purchased id absent from the index THROWS (never a silent grant or silent drop, threat TM-E). Run
// inside `withTenant` so the underlying store read is RLS-scoped to the buyer.
//
// This is the SERVER-SIDE entitlement truth. The Ed25519 license issuer (a follow-on Bucket-B slice)
// signs an account's purchased ids into a license token; the registry Worker then verifies that token
// offline at the edge and expands it the same way (ADR-0010/0047) — both paths share this one
// expansion, so the edge view and the server truth never diverge.
import { bundleMembershipTimeline } from "@caisson/pricebook";
import {
  BUNDLE_IDS,
  type RegistryIndex,
  expandEntitlements,
} from "@caisson/registry-schema";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import { computeEntitledSince, readEntitlements } from "./entitlement-store.ts";

/**
 * The full bundle-membership TIMELINE (ADR-0247 F7 / ADR-0257 §1.2), built ONCE from
 * `@caisson/pricebook` — the DATA half of the snapshot-at-sale member filter. `@caisson/registry-schema`
 * is the open Apache base and never depends "up" on the commercial pricebook that owns this data, so
 * the GATE injects it (the D side of the D/E boundary). Static, so it is computed at module load.
 */
const MEMBERSHIP_TIMELINE: Record<
  string,
  Readonly<Record<string, string>>
> = Object.fromEntries(
  BUNDLE_IDS.map((id) => [id, bundleMembershipTimeline(id)]),
);

/**
 * Resolve an account's entitled member-module slug set: read its stored purchased ids, expand each
 * against the registry index (editions/bundle → member slugs, à-la-carte module → itself). An account
 * with no entitlements resolves to the empty set (no access). Fail-closed via `expandEntitlements`.
 *
 * ADR-0257 §1.2 (SHIP-audit F3): the expansion also applies the per-member snapshot-at-sale filter —
 * a bundle member that joined AFTER the buyer's `entitledSince` (DB truth via `computeEntitledSince`,
 * the same instant the issuer signs into the token) is dropped, fail-soft. This is the SERVER-side
 * sibling of the registry Worker's edge filter; both inject the pricebook timeline at expansion.
 */
export async function resolveAccountEntitlements(
  tx: TenantExecutor,
  accountId: string,
  index: RegistryIndex,
): Promise<Set<string>> {
  const purchased = await readEntitlements(tx, accountId);
  const entitledSince = await computeEntitledSince(tx, accountId);
  return expandEntitlements(index, purchased, {
    entitledSince,
    membershipTimeline: MEMBERSHIP_TIMELINE,
  });
}

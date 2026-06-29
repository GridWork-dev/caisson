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
import {
  type RegistryIndex,
  expandEntitlements,
} from "@caisson/registry-schema";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import { readEntitlements } from "./entitlement-store.ts";

/**
 * Resolve an account's entitled member-module slug set: read its stored purchased ids, expand each
 * against the registry index (editions/bundle → member slugs, à-la-carte module → itself). An account
 * with no entitlements resolves to the empty set (no access). Fail-closed via `expandEntitlements`.
 */
export async function resolveAccountEntitlements(
  tx: TenantExecutor,
  accountId: string,
  index: RegistryIndex,
): Promise<Set<string>> {
  const purchased = await readEntitlements(tx, accountId);
  return expandEntitlements(index, purchased);
}

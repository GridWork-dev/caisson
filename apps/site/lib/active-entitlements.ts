import { withTenant, type Transactor } from "@caisson/tenancy-rls";
import { readEntitlementGrants } from "./dashboard-reads.ts";

export async function activeEntitlementIds(
  db: Transactor,
  accountId: string,
): Promise<string[]> {
  const grants = await withTenant(db, accountId, (tx) =>
    readEntitlementGrants(tx, accountId),
  );
  return grants
    .filter((grant) => grant.status === "active")
    .map((grant) => grant.entitlementId);
}

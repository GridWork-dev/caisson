// src/evidence/collectors/rls-force.ts — tenant-isolation (FORCE-RLS) evidence (ADR-0058, ADR-0005).
//
// Evidences that every tenant table enforces row-level security the fail-closed way: RLS ENABLED,
// RLS FORCED (so even the table owner is policed), AND a tenant policy present. The posture snapshot
// is gathered at the edge (a catalog read over `pg_class.relrowsecurity`/`relforcerowsecurity` + the
// tenant policy from `buildTenantPolicySql` in `@caisson-sh/tenancy-rls`). Empty snapshot → `unresolved` (nothing
// was inspected, so isolation cannot be attested); any deficient table → `flagged`.
import {
  flaggedResult,
  passResult,
  unresolvedResult,
  type CollectorResult,
  type EvidenceCollector,
  type ManualAttachmentSlot,
} from "../collector.ts";

/** The RLS posture of one tenant-scoped table, as read from the catalog at the edge. */
export interface RlsTableFact {
  readonly table: string;
  /** `pg_class.relrowsecurity` — RLS is enabled on the table. */
  readonly rowSecurityEnabled: boolean;
  /** `pg_class.relforcerowsecurity` — RLS applies even to the table owner (fail-closed). */
  readonly rowSecurityForced: boolean;
  /** A tenant-scoping policy (e.g. from `buildTenantPolicySql`) is attached to the table. */
  readonly tenantPolicyPresent: boolean;
}

/** The base fact: the RLS posture across all tenant-scoped tables in scope. */
export interface RlsForceFact {
  readonly tables: readonly RlsTableFact[];
}

export interface RlsForceCollectorOptions {
  /** The canonical control id this evidences; defaults to the logical-access-control control. */
  readonly controlId?: string;
}

const DEFAULT_CONTROL_ID = "ACCESS-CONTROL.LOGICAL";
const COLLECTOR_ID = "substrate.tenant-isolation-force-rls";
const TITLE = "Tenant isolation enforced by FORCE row-level security";

/** A table is adequately isolated iff RLS is enabled, forced, AND a tenant policy is present. */
function isForced(t: RlsTableFact): boolean {
  return t.rowSecurityEnabled && t.rowSecurityForced && t.tenantPolicyPresent;
}

/** Build the FORCE-RLS tenant-isolation collector. Pure: a posture snapshot in, a result out. */
export function rlsForceCollector(
  options: RlsForceCollectorOptions = {},
): EvidenceCollector<RlsForceFact> {
  const controlId = options.controlId ?? DEFAULT_CONTROL_ID;
  // A passing automated check still invites a manual pentest report to strengthen the evidence.
  const manualSlots: readonly ManualAttachmentSlot[] = [
    {
      id: "tenant-isolation-test-report",
      label: "Tenant-isolation / penetration test report",
      required: false,
    },
  ];

  return {
    id: COLLECTOR_ID,
    controlId,
    title: TITLE,
    manualSlots,
    collect(fact: RlsForceFact): CollectorResult {
      const tableCount = fact.tables.length;

      // Nothing inspected → isolation cannot be attested. Refuse to guess a pass.
      if (tableCount === 0) {
        return unresolvedResult(
          {
            collectorId: COLLECTOR_ID,
            controlId,
            title: TITLE,
            summary: "no tenant-scoped tables were inspected for RLS posture",
            facts: { tableCount: 0, forcedCount: 0, deficientTables: [] },
            manualSlots,
          },
          "no RLS posture was gathered; tenant isolation cannot be attested",
        );
      }

      const deficientTables = fact.tables
        .filter((t) => !isForced(t))
        .map((t) => t.table);
      const forcedCount = tableCount - deficientTables.length;
      const facts = { tableCount, forcedCount, deficientTables };

      if (deficientTables.length === 0) {
        return passResult({
          collectorId: COLLECTOR_ID,
          controlId,
          title: TITLE,
          summary: `all ${String(tableCount)} tenant tables enforce FORCE row-level security`,
          facts,
          manualSlots,
        });
      }

      return flaggedResult(
        {
          collectorId: COLLECTOR_ID,
          controlId,
          title: TITLE,
          summary: `${String(deficientTables.length)} of ${String(tableCount)} tenant tables do not enforce FORCE RLS`,
          facts,
          manualSlots,
        },
        `tables missing enabled+forced RLS or a tenant policy: ${deficientTables.join(", ")}`,
      );
    },
  };
}

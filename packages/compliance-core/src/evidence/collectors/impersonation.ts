// src/evidence/collectors/impersonation.ts — support-impersonation dual-trail evidence (ADR-0187,
// ADR-0058).
//
// Evidences that every support-impersonation session is fully accounted for ACROSS ITS WHOLE
// LIFECYCLE: the target tenant's audit chain verifies; every session carries BOTH sides of its
// begin dual pair (the operator-identity record AND the acting-as-tenant record, ADR-0187); an
// ENDED session (`endedAt` set) carries both sides of its `session.end` pair (a set `ended_at`
// with no end records is a torn end — the retention change landed but the evidence did not); the
// per-side record COUNTS match (every lifecycle step appends exactly one record per side, so an
// inequality is a torn dual append at begin/action/end); plus a non-empty justification and a
// bounded lifetime (expiresAt strictly after startedAt). The fact is gathered at the edge (the
// session rows / `endImpersonation` results + `AuditChainStore.load`/`verify` +
// `findDualRecordSeqs`), keeping this collector pure of any DB/chain import. An EMPTY session set
// with a valid chain is a truthful pass — "no support access occurred" is exactly what an auditor
// wants evidenced; a still-OPEN session (`endedAt: null`) legitimately has no end pair yet.
// Flag-never-guess: an unverifiable chain (`chainValid: null`) → `unresolved`; a failed
// verification, a missing/torn dual record, an empty reason, or an unbounded lifetime → `flagged`.
import type { JsonValue } from "@caisson-sh/kernel";
import {
  flaggedResult,
  passResult,
  unresolvedResult,
  type CollectorResult,
  type EvidenceCollector,
  type ManualAttachmentSlot,
} from "../collector.ts";

/** One impersonation session as gathered at the edge (ISO strings — canonicalize-able). */
export interface ImpersonationSessionFact {
  readonly id: string;
  readonly operatorId: string;
  readonly reason: string;
  readonly startedAt: string;
  readonly expiresAt: string;
  /** `null` while the session is still open. */
  readonly endedAt: string | null;
  /** The chain seq of the operator-identity begin record, or `null` when missing from the chain. */
  readonly operatorRecordSeq: number | null;
  /** The chain seq of the acting-as-tenant begin record, or `null` when missing from the chain. */
  readonly tenantRecordSeq: number | null;
  /** The `session.end` operator-identity record's seq; `null` = missing. Required once `endedAt`
   *  is set — an ended row with no end record is a torn end (flagged). */
  readonly endOperatorRecordSeq: number | null;
  /** The `session.end` acting-as-tenant record's seq; `null` = missing (as above). */
  readonly endTenantRecordSeq: number | null;
  /** Total operator-identity records on the chain for this session. Every lifecycle step appends
   *  exactly one record per side, so this must EQUAL `tenantRecordCount` (else: torn append). */
  readonly operatorRecordCount: number;
  /** Total acting-as-tenant records on the chain for this session. */
  readonly tenantRecordCount: number;
}

/** The base fact: the tenant's sessions + the chain-verification verdict over their dual records. */
export interface ImpersonationDualTrailFact {
  readonly sessions: readonly ImpersonationSessionFact[];
  /** `verify()` verdict over the target tenant's chain; `null` when verification could not run
   *  (no trusted anchor / chain unloadable) — the sessions are then unauditable → `unresolved`. */
  readonly chainValid: boolean | null;
}

export interface ImpersonationCollectorOptions {
  /** The canonical control id this evidences; defaults to the logical-access-control control. */
  readonly controlId?: string;
}

const DEFAULT_CONTROL_ID = "ACCESS-CONTROL.LOGICAL";
const COLLECTOR_ID = "substrate.impersonation-dual-trail";
const TITLE = "Support impersonation carries a chain-verified dual audit trail";

/** Every deficiency one session can carry, phrased for the recorded flag reason. */
function sessionDeficiencies(s: ImpersonationSessionFact): string[] {
  const problems: string[] = [];
  if (s.operatorRecordSeq === null) {
    problems.push(
      `session ${s.id}: operator-identity record missing from the audit chain`,
    );
  }
  if (s.tenantRecordSeq === null) {
    problems.push(
      `session ${s.id}: acting-as-tenant record missing from the audit chain`,
    );
  }
  if (s.endedAt !== null && s.endOperatorRecordSeq === null) {
    problems.push(
      `session ${s.id}: ended but the operator-identity session.end record is missing from the audit chain`,
    );
  }
  if (s.endedAt !== null && s.endTenantRecordSeq === null) {
    problems.push(
      `session ${s.id}: ended but the acting-as-tenant session.end record is missing from the audit chain`,
    );
  }
  if (s.operatorRecordCount !== s.tenantRecordCount) {
    problems.push(
      `session ${s.id}: dual-trail asymmetry, ${String(s.operatorRecordCount)} operator-identity vs ${String(s.tenantRecordCount)} acting-as-tenant record(s) (a torn dual append)`,
    );
  }
  if (s.reason.trim().length === 0) {
    problems.push(`session ${s.id}: no recorded justification`);
  }
  if (!(new Date(s.expiresAt).getTime() > new Date(s.startedAt).getTime())) {
    problems.push(
      `session ${s.id}: expiry ${s.expiresAt} is not after start ${s.startedAt} (unbounded or invalid lifetime)`,
    );
  }
  return problems;
}

function sessionsAsJson(
  sessions: readonly ImpersonationSessionFact[],
): JsonValue {
  return sessions.map((s) => ({
    id: s.id,
    operatorId: s.operatorId,
    reason: s.reason,
    startedAt: s.startedAt,
    expiresAt: s.expiresAt,
    endedAt: s.endedAt,
    operatorRecordSeq: s.operatorRecordSeq,
    tenantRecordSeq: s.tenantRecordSeq,
    endOperatorRecordSeq: s.endOperatorRecordSeq,
    endTenantRecordSeq: s.endTenantRecordSeq,
    operatorRecordCount: s.operatorRecordCount,
    tenantRecordCount: s.tenantRecordCount,
  }));
}

/** Build the impersonation dual-trail collector. Pure: a gathered fact in, an evidence result out. */
export function impersonationCollector(
  options: ImpersonationCollectorOptions = {},
): EvidenceCollector<ImpersonationDualTrailFact> {
  const controlId = options.controlId ?? DEFAULT_CONTROL_ID;
  const manualSlots: readonly ManualAttachmentSlot[] = [
    {
      id: "support-access-policy",
      label: "Written support-access / impersonation policy document",
      required: false,
    },
  ];

  return {
    id: COLLECTOR_ID,
    controlId,
    title: TITLE,
    manualSlots,
    collect(fact: ImpersonationDualTrailFact): CollectorResult {
      const sessionCount = fact.sessions.length;
      const facts = {
        sessionCount,
        chainValid: fact.chainValid,
        sessions: sessionsAsJson(fact.sessions),
      };

      // Chain verification never ran → the dual trail cannot be attested. Refuse to guess.
      if (fact.chainValid === null) {
        return unresolvedResult(
          {
            collectorId: COLLECTOR_ID,
            controlId,
            title: TITLE,
            summary:
              "the target tenant's audit chain could not be verified; impersonation sessions are unauditable",
            facts,
            manualSlots,
          },
          "chain verification did not run; the impersonation dual trail cannot be attested",
        );
      }

      const problems = fact.sessions.flatMap(sessionDeficiencies);
      if (!fact.chainValid) {
        problems.unshift(
          "the target tenant's audit chain failed verification against its trusted anchor",
        );
      }

      if (problems.length > 0) {
        return flaggedResult(
          {
            collectorId: COLLECTOR_ID,
            controlId,
            title: TITLE,
            summary: `impersonation dual-trail deficiencies found across ${String(sessionCount)} session(s)`,
            facts,
            manualSlots,
          },
          problems.join("; "),
        );
      }

      return passResult({
        collectorId: COLLECTOR_ID,
        controlId,
        title: TITLE,
        summary: `${String(sessionCount)} impersonation session(s) fully dual-recorded on a verified chain`,
        facts,
        manualSlots,
      });
    },
  };
}

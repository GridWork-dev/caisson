// Unit matrix for the impersonation dual-trail collector (ADR-0187, ADR-0058): pass iff the chain
// verifies AND every session carries both dual records, a justification, and a bounded lifetime;
// flagged with a precise recorded reason otherwise; unresolved when verification never ran.
import { describe, expect, test } from "bun:test";
import {
  impersonationCollector,
  type ImpersonationDualTrailFact,
  type ImpersonationSessionFact,
} from "./impersonation.ts";

function session(
  overrides: Partial<ImpersonationSessionFact> = {},
): ImpersonationSessionFact {
  return {
    id: "1f2e3d4c-5b6a-4798-8899-aabbccddeeff",
    operatorId: "support-operator-7",
    reason: "Investigating a customer-reported ticket.",
    startedAt: "2026-06-27T12:00:00.000Z",
    expiresAt: "2026-06-27T12:15:00.000Z",
    endedAt: "2026-06-27T12:05:00.000Z",
    operatorRecordSeq: 1,
    tenantRecordSeq: 2,
    endOperatorRecordSeq: 5,
    endTenantRecordSeq: 6,
    operatorRecordCount: 3,
    tenantRecordCount: 3,
    ...overrides,
  };
}

function fact(
  overrides: Partial<ImpersonationDualTrailFact> = {},
): ImpersonationDualTrailFact {
  return { sessions: [session()], chainValid: true, ...overrides };
}

describe("impersonationCollector — verdict matrix (flag-never-guess)", () => {
  test("passes when the chain verifies and every session is fully dual-recorded", () => {
    const result = impersonationCollector().collect(fact());
    expect(result.status).toBe("pass");
    expect(result.item.collectorId).toBe("substrate.impersonation-dual-trail");
    expect(result.item.controlId).toBe("ACCESS-CONTROL.LOGICAL");
    expect(result.item.facts["sessionCount"]).toBe(1);
  });

  test("an empty session set on a verified chain is a truthful pass (no support access occurred)", () => {
    const result = impersonationCollector().collect(fact({ sessions: [] }));
    expect(result.status).toBe("pass");
  });

  test("the control id is constructor-overridable (HIPAA workforce citation)", () => {
    const result = impersonationCollector({
      controlId: "ACCESS-CONTROL.WORKFORCE",
    }).collect(fact());
    expect(result.item.controlId).toBe("ACCESS-CONTROL.WORKFORCE");
  });

  test("flags a session missing its acting-as-tenant record, naming the session", () => {
    const result = impersonationCollector().collect(
      fact({ sessions: [session({ tenantRecordSeq: null })] }),
    );
    expect(result.status).toBe("flagged");
    expect(result.reason).toMatch(/acting-as-tenant record missing/);
    expect(result.reason).toMatch(session().id);
  });

  test("flags a session missing its operator-identity record", () => {
    const result = impersonationCollector().collect(
      fact({ sessions: [session({ operatorRecordSeq: null })] }),
    );
    expect(result.status).toBe("flagged");
    expect(result.reason).toMatch(/operator-identity record missing/);
  });

  test("flags an empty recorded justification", () => {
    const result = impersonationCollector().collect(
      fact({ sessions: [session({ reason: "   " })] }),
    );
    expect(result.status).toBe("flagged");
    expect(result.reason).toMatch(/no recorded justification/);
  });

  test("flags an unbounded lifetime (expiry not after start)", () => {
    const result = impersonationCollector().collect(
      fact({
        sessions: [session({ expiresAt: "2026-06-27T12:00:00.000Z" })],
      }),
    );
    expect(result.status).toBe("flagged");
    expect(result.reason).toMatch(/unbounded or invalid lifetime/);
  });

  test("flags an ENDED session whose session.end records are missing (torn end)", () => {
    const result = impersonationCollector().collect(
      fact({
        sessions: [
          session({
            endOperatorRecordSeq: null,
            endTenantRecordSeq: null,
            operatorRecordCount: 1,
            tenantRecordCount: 1,
          }),
        ],
      }),
    );
    expect(result.status).toBe("flagged");
    expect(result.reason).toMatch(
      /ended but the operator-identity session.end record is missing/,
    );
    expect(result.reason).toMatch(
      /ended but the acting-as-tenant session.end record is missing/,
    );
  });

  test("a still-OPEN session without end records passes (no end pair is owed yet)", () => {
    const result = impersonationCollector().collect(
      fact({
        sessions: [
          session({
            endedAt: null,
            endOperatorRecordSeq: null,
            endTenantRecordSeq: null,
            operatorRecordCount: 1,
            tenantRecordCount: 1,
          }),
        ],
      }),
    );
    expect(result.status).toBe("pass");
  });

  test("flags unequal per-side record counts (a torn dual append mid-lifecycle)", () => {
    const result = impersonationCollector().collect(
      fact({
        sessions: [session({ operatorRecordCount: 3, tenantRecordCount: 2 })],
      }),
    );
    expect(result.status).toBe("flagged");
    expect(result.reason).toMatch(/dual-trail asymmetry/);
    expect(result.reason).toMatch(/torn dual append/);
  });

  test("flags a failed chain verification even when every session looks complete", () => {
    const result = impersonationCollector().collect(
      fact({ chainValid: false }),
    );
    expect(result.status).toBe("flagged");
    expect(result.reason).toMatch(/failed verification/);
  });

  test("aggregates every deficiency into one recorded reason", () => {
    const result = impersonationCollector().collect(
      fact({
        chainValid: false,
        sessions: [session({ tenantRecordSeq: null, reason: " " })],
      }),
    );
    expect(result.status).toBe("flagged");
    expect(result.reason).toMatch(/failed verification/);
    expect(result.reason).toMatch(/acting-as-tenant record missing/);
    expect(result.reason).toMatch(/no recorded justification/);
  });

  test("unresolved when chain verification never ran (sessions unauditable)", () => {
    const result = impersonationCollector().collect(fact({ chainValid: null }));
    expect(result.status).toBe("unresolved");
    expect(result.reason).toMatch(/cannot be attested/);
  });

  test("declares the optional support-access-policy manual slot", () => {
    const result = impersonationCollector().collect(fact());
    expect(result.item.manualSlots).toEqual([
      {
        id: "support-access-policy",
        label: "Written support-access / impersonation policy document",
        required: false,
      },
    ]);
  });
});

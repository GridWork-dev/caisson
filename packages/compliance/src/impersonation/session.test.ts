// Unit proof for the impersonation begin boundary (ADR-0187) — fail-closed BEFORE any I/O. The
// schema cases run through `parseStrict` directly; the deps-untouched case runs the real
// `beginImpersonation` against throwing stubs, proving validation precedes every DB/chain touch.
// The DB-backed lifecycle (expiry, ended, RLS) is proven in `session.integration.test.ts`.
import { describe, expect, test } from "bun:test";
import { ValidationError, parseStrict } from "@caisson-sh/kernel";
import {
  MAX_IMPERSONATION_TTL_MS,
  beginImpersonation,
  beginImpersonationSchema,
  findDualRecordSeqs,
  type ImpersonationDeps,
} from "./session.ts";

const TARGET = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

/** A well-formed begin input; each case below breaks exactly one field. */
function validInput(): Record<string, unknown> {
  return {
    operatorId: "support-operator-7",
    targetAccountId: TARGET,
    reason: "Investigating a buyer-reported ticket.",
    ttlMs: 15 * 60 * 1000,
  };
}

describe("beginImpersonationSchema — fail-closed boundary (ADR-0187)", () => {
  test("accepts a well-formed input (with and without operatorEmail)", () => {
    expect(() =>
      parseStrict(beginImpersonationSchema, validInput()),
    ).not.toThrow();
    expect(() =>
      parseStrict(beginImpersonationSchema, {
        ...validInput(),
        operatorEmail: "support@caisson.sh",
      }),
    ).not.toThrow();
  });

  const rejected: Array<[string, Record<string, unknown>]> = [
    [
      "missing reason",
      (() => {
        const i = validInput();
        delete i["reason"];
        return i;
      })(),
    ],
    [
      "short reason (auditors reject empty justification)",
      { ...validInput(), reason: "fix" },
    ],
    ["whitespace-only reason", { ...validInput(), reason: "            " }],
    ["overlong reason", { ...validInput(), reason: "x".repeat(2001) }],
    ["ttl 0", { ...validInput(), ttlMs: 0 }],
    ["negative ttl", { ...validInput(), ttlMs: -1 }],
    ["non-integer ttl", { ...validInput(), ttlMs: 1000.5 }],
    [
      "ttl over the 8h shift bound",
      { ...validInput(), ttlMs: MAX_IMPERSONATION_TTL_MS + 1 },
    ],
    ["non-uuid target account", { ...validInput(), targetAccountId: "acct_a" }],
    ["empty operator id", { ...validInput(), operatorId: "" }],
    [
      "malformed operator email",
      { ...validInput(), operatorEmail: "not-an-email" },
    ],
    ["unknown extra field (.strict())", { ...validInput(), role: "admin" }],
  ];
  for (const [name, input] of rejected) {
    test(`rejects ${name}`, () => {
      expect(() => parseStrict(beginImpersonationSchema, input)).toThrow(
        ValidationError,
      );
    });
  }
});

describe("beginImpersonation — validation precedes all I/O", () => {
  test("an invalid input never touches the DB or the chain", async () => {
    const deps: ImpersonationDeps = {
      db: {
        transaction: () => {
          throw new Error("db reached before validation");
        },
      },
      chain: {
        append: () => {
          throw new Error("chain reached before validation");
        },
      },
    };
    await expect(
      beginImpersonation(deps, {
        operatorId: "support-operator-7",
        targetAccountId: TARGET,
        reason: "Investigating a buyer-reported ticket.",
        ttlMs: 0, // fail-closed: strictly positive TTLs only
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("findDualRecordSeqs — pure whole-lifecycle dual-trail scan", () => {
  const sid = "1f2e3d4c-5b6a-4798-8899-aabbccddeeff";
  const entries = [
    {
      seq: 0,
      prevHash: null,
      payload: { kind: "artifact.locked" },
      hash: "h0",
    },
    {
      seq: 1,
      prevHash: "h0",
      payload: {
        kind: "impersonation.operator",
        sessionId: sid,
        action: "session.begin",
      },
      hash: "h1",
    },
    {
      seq: 2,
      prevHash: "h1",
      payload: {
        kind: "impersonation.tenant",
        sessionId: sid,
        action: "session.begin",
      },
      hash: "h2",
    },
  ];

  test("locates both sides of the begin pair by sessionId (no end pair yet, counts 1/1)", () => {
    expect(findDualRecordSeqs(entries, sid)).toEqual({
      operatorRecordSeq: 1,
      tenantRecordSeq: 2,
      endOperatorRecordSeq: null,
      endTenantRecordSeq: null,
      operatorRecordCount: 1,
      tenantRecordCount: 1,
    });
  });

  test("returns nulls and zero counts for an unknown session (the collector flags them)", () => {
    expect(findDualRecordSeqs(entries, "other-session")).toEqual({
      operatorRecordSeq: null,
      tenantRecordSeq: null,
      endOperatorRecordSeq: null,
      endTenantRecordSeq: null,
      operatorRecordCount: 0,
      tenantRecordCount: 0,
    });
  });

  test("locates the session.end pair and counts each side across the whole lifecycle", () => {
    const withEnd = [
      ...entries,
      {
        seq: 3,
        prevHash: "h2",
        payload: {
          kind: "impersonation.operator",
          sessionId: sid,
          action: "session.end",
        },
        hash: "h3",
      },
      {
        seq: 4,
        prevHash: "h3",
        payload: {
          kind: "impersonation.tenant",
          sessionId: sid,
          action: "session.end",
        },
        hash: "h4",
      },
    ];
    expect(findDualRecordSeqs(withEnd, sid)).toEqual({
      operatorRecordSeq: 1,
      tenantRecordSeq: 2,
      endOperatorRecordSeq: 3,
      endTenantRecordSeq: 4,
      operatorRecordCount: 2,
      tenantRecordCount: 2,
    });
  });

  test("a torn end (operator side only) leaves the tenant end seq null and the counts unequal", () => {
    const torn = [
      ...entries,
      {
        seq: 3,
        prevHash: "h2",
        payload: {
          kind: "impersonation.operator",
          sessionId: sid,
          action: "session.end",
        },
        hash: "h3",
      },
    ];
    const scan = findDualRecordSeqs(torn, sid);
    expect(scan.endOperatorRecordSeq).toBe(3);
    expect(scan.endTenantRecordSeq).toBeNull();
    expect(scan.operatorRecordCount).toBe(2);
    expect(scan.tenantRecordCount).toBe(1);
  });
});

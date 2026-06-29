// account_entitlement store on PGlite + real withTenant RLS (ADR-0071/0005). Asserts: grant persists
// the purchased ids; read returns them sorted; a re-grant of a held id is idempotent (no extra row);
// an empty grant is a no-op; RLS isolates accounts (B never sees A's rows); and a cross-tenant write
// (account_id ≠ the bound GUC) is refused by the policy WITH CHECK (fail-closed). Each test uses its
// own account id so no cross-test cleanup is needed.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";
import {
  ENTITLEMENT_SCHEMA_SQL,
  grantEntitlements,
  readEntitlements,
} from "./entitlement-store.ts";

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

describe("account_entitlement store (ADR-0071, RLS)", () => {
  test("grant persists the purchased ids; read returns them sorted", async () => {
    const acct = "acct_grant";
    const n = await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["local-ai", "compliance"],
        sourceEventId: "in_1",
      }),
    );
    expect(n).toBe(2);
    const ids = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(ids).toEqual(["compliance", "local-ai"]);
  });

  test("a re-grant of a held id is idempotent — adds no row", async () => {
    const acct = "acct_idem";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_a",
      }),
    );
    // Same entitlement, a FRESH source event (a renewal cycle / manual resend) — still one row.
    const n2 = await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_b",
      }),
    );
    expect(n2).toBe(0); // already held → no new grant
    const ids = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(ids).toEqual(["compliance"]);
  });

  test("a partial re-grant counts only the newly added id", async () => {
    const acct = "acct_partial";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_p1",
      }),
    );
    const n = await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance", "ai-kit"], // compliance held, ai-kit new
        sourceEventId: "in_p2",
      }),
    );
    expect(n).toBe(1);
    const ids = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(ids).toEqual(["ai-kit", "compliance"]);
  });

  test("an empty grant is a no-op", async () => {
    const acct = "acct_empty";
    const n = await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: [],
        sourceEventId: "in_e",
      }),
    );
    expect(n).toBe(0);
    const ids = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(ids).toEqual([]);
  });

  test("RLS isolates accounts — B never sees A's entitlements", async () => {
    const a = "acct_a";
    const b = "acct_b";
    await withTenant(tp.pg, a, (tx) =>
      grantEntitlements(tx, {
        accountId: a,
        entitlementIds: ["ai-kit"],
        sourceEventId: "in_a",
      }),
    );
    // Under B's tenant scope, even querying A's id explicitly returns nothing — RLS, not the WHERE.
    const crossRead = await withTenant(tp.pg, b, (tx) =>
      readEntitlements(tx, a),
    );
    expect(crossRead).toEqual([]);
  });

  test("a cross-tenant write is refused by the policy WITH CHECK (fail-closed)", async () => {
    const owner = "acct_owner";
    const attacker = "acct_attacker";
    // Under withTenant(attacker), grantEntitlements inserts account_id = owner; the policy
    // WITH CHECK (account_id = GUC = attacker) rejects it — a forged cross-tenant grant cannot land.
    await expect(
      withTenant(tp.pg, attacker, (tx) =>
        grantEntitlements(tx, {
          accountId: owner,
          entitlementIds: ["compliance"],
          sourceEventId: "in_x",
        }),
      ),
    ).rejects.toThrow();
    const ids = await withTenant(tp.pg, owner, (tx) =>
      readEntitlements(tx, owner),
    );
    expect(ids).toEqual([]); // nothing was written under the owner
  });
});

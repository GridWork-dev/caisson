// entitlement_grant junction on PGlite + real withTenant RLS (ADR-0109/0071/0005). Asserts: a grant
// persists per-source rows; read returns the DISTINCT active ids sorted; a same-source re-grant is
// idempotent (refcount stays one); REFCOUNT — two sources granting the same edition keep it entitled
// until BOTH are revoked; subscription revoke strips only that subscription's grants; a one-time grant
// survives a subscription cancel; revokes are soft (status flips, row stays) + idempotent; RLS isolates
// accounts and refuses a cross-tenant write. Each test uses its own account id — no cross-test cleanup.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";
import {
  ENTITLEMENT_SCHEMA_SQL,
  grantEntitlements,
  readEntitlements,
  revokePurchaseGrants,
  revokeSubscriptionGrants,
} from "./entitlement-store.ts";

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

const sub = (subscriptionId: string) =>
  ({ kind: "subscription", subscriptionId }) as const;
const onetime = (purchaseId: string) =>
  ({ kind: "one_time", purchaseId }) as const;

describe("entitlement_grant junction (ADR-0109, RLS)", () => {
  test("grant persists the purchased ids; read returns the active set sorted", async () => {
    const acct = "acct_grant";
    const n = await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["local-ai", "compliance"],
        sourceEventId: "in_1",
        source: sub("sub_1"),
      }),
    );
    expect(n).toBe(2);
    const ids = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(ids).toEqual(["compliance", "local-ai"]);
  });

  test("a same-source re-grant is idempotent — refcount stays one (no extra row)", async () => {
    const acct = "acct_idem";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_a",
        source: sub("sub_idem"),
      }),
    );
    // Same entitlement + same subscription, FRESH source event (a renewal cycle) — still one grant.
    const n2 = await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_b",
        source: sub("sub_idem"),
      }),
    );
    expect(n2).toBe(0);
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
  });

  test("REFCOUNT: two sources back the same edition — revoke one, still entitled; revoke both, gone", async () => {
    const acct = "acct_refcount";
    // A subscription AND a one-time purchase both grant `compliance`.
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_sub",
        source: sub("sub_rc"),
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pi_rc",
        source: onetime("pi_rc"),
      }),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);

    // Revoke the subscription source — the one-time grant still backs the entitlement.
    const r1 = await withTenant(tp.pg, acct, (tx) =>
      revokeSubscriptionGrants(tx, {
        accountId: acct,
        subscriptionId: "sub_rc",
      }),
    );
    expect(r1).toBe(1);
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]); // refcount still > 0

    // Revoke the one-time source too — refcount hits 0, entitlement lost.
    const r2 = await withTenant(tp.pg, acct, (tx) =>
      revokePurchaseGrants(tx, { accountId: acct, purchaseId: "pi_rc" }),
    );
    expect(r2).toBe(1);
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]);
  });

  test("subscription revoke strips ONLY that subscription's grants", async () => {
    const acct = "acct_two_subs";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_x",
        source: sub("sub_keep"),
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["ai-kit"],
        sourceEventId: "in_y",
        source: sub("sub_drop"),
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      revokeSubscriptionGrants(tx, {
        accountId: acct,
        subscriptionId: "sub_drop",
      }),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]); // sub_keep's grant untouched
  });

  test("a soft-revoke is idempotent — revoking an already-revoked source revokes nothing", async () => {
    const acct = "acct_softidem";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pi_si",
        source: onetime("pi_si"),
      }),
    );
    const first = await withTenant(tp.pg, acct, (tx) =>
      revokePurchaseGrants(tx, { accountId: acct, purchaseId: "pi_si" }),
    );
    expect(first).toBe(1);
    const second = await withTenant(tp.pg, acct, (tx) =>
      revokePurchaseGrants(tx, { accountId: acct, purchaseId: "pi_si" }),
    );
    expect(second).toBe(0); // already revoked → no-op
  });

  test("an empty grant is a no-op", async () => {
    const acct = "acct_empty";
    const n = await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: [],
        sourceEventId: "in_e",
        source: sub("sub_e"),
      }),
    );
    expect(n).toBe(0);
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]);
  });

  test("RLS isolates accounts — B never sees A's entitlements", async () => {
    const a = "acct_a";
    const b = "acct_b";
    await withTenant(tp.pg, a, (tx) =>
      grantEntitlements(tx, {
        accountId: a,
        entitlementIds: ["ai-kit"],
        sourceEventId: "in_a",
        source: sub("sub_a"),
      }),
    );
    const crossRead = await withTenant(tp.pg, b, (tx) =>
      readEntitlements(tx, a),
    );
    expect(crossRead).toEqual([]);
  });

  test("a cross-tenant write is refused by the policy WITH CHECK (fail-closed)", async () => {
    const owner = "acct_owner";
    const attacker = "acct_attacker";
    await expect(
      withTenant(tp.pg, attacker, (tx) =>
        grantEntitlements(tx, {
          accountId: owner,
          entitlementIds: ["compliance"],
          sourceEventId: "in_x",
          source: sub("sub_x"),
        }),
      ),
    ).rejects.toThrow();
    const ids = await withTenant(tp.pg, owner, (tx) =>
      readEntitlements(tx, owner),
    );
    expect(ids).toEqual([]); // nothing was written under the owner
  });
});

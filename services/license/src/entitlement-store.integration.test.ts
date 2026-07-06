// entitlement_grant junction on PGlite + real withTenant RLS (ADR-0113/0071/0005). Asserts: a grant
// persists per-source rows; read returns the DISTINCT active ids sorted; a same-source re-grant is
// idempotent (refcount stays one); REFCOUNT — two sources granting the same edition keep it entitled
// until BOTH are revoked; subscription revoke strips only that subscription's grants; a one-time grant
// survives a subscription cancel; revokes are soft (status flips, row stays) + idempotent; RLS isolates
// accounts and refuses a cross-tenant write. Each test uses its own account id — no cross-test cleanup.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";
import {
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  ENTITLEMENT_SCHEMA_SQL,
  computeEntitledSince,
  computeUpdatesWindows,
  extendUpdatesWindow,
  grantEntitlements,
  readEntitlements,
  revokePurchaseGrants,
  revokePurchaseLineGrants,
  revokeSubscriptionGrants,
} from "./entitlement-store.ts";

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  await tp.exec(ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL);
});

afterAll(async () => {
  await tp.close();
});

const sub = (subscriptionId: string) =>
  ({ kind: "subscription", subscriptionId }) as const;
const onetime = (purchaseId: string) =>
  ({ kind: "one_time", purchaseId }) as const;

describe("entitlement_grant junction (ADR-0113, RLS)", () => {
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

  test("two cart lines granting the SAME id are two rows; per-line revoke keeps refcount (ADR-0218 B-1)", async () => {
    const acct = "acct_perline";
    // Same one-time purchase, same entitlement, TWO distinct line items → two grant rows.
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "txn_1",
        source: onetime("txn_1"),
        lineItemId: "txnitm_a",
      }),
    );
    const secondRow = await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "txn_1",
        source: onetime("txn_1"),
        lineItemId: "txnitm_b",
      }),
    );
    expect(secondRow).toBe(1); // a DISTINCT line item → a second row, not an ON CONFLICT no-op
    // Revoke line A only — line B still backs `compliance` (fork B-1 refcount).
    const revA = await withTenant(tp.pg, acct, (tx) =>
      revokePurchaseLineGrants(tx, {
        accountId: acct,
        purchaseId: "txn_1",
        lineItemId: "txnitm_a",
      }),
    );
    expect(revA).toBe(1);
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance"]);
    // Revoke line B — refcount 0, gone. A re-revoke of A is an idempotent no-op.
    const revB = await withTenant(tp.pg, acct, (tx) =>
      revokePurchaseLineGrants(tx, {
        accountId: acct,
        purchaseId: "txn_1",
        lineItemId: "txnitm_b",
      }),
    );
    expect(revB).toBe(1);
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]);
    const reRevA = await withTenant(tp.pg, acct, (tx) =>
      revokePurchaseLineGrants(tx, {
        accountId: acct,
        purchaseId: "txn_1",
        lineItemId: "txnitm_a",
      }),
    );
    expect(reRevA).toBe(0);
  });

  test("a subscription renewal with no line item still collapses to one row (COALESCE index)", async () => {
    const acct = "acct_sub_noline";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["ai-kit"],
        sourceEventId: "in_1",
        source: sub("sub_nl"),
      }),
    );
    // A renewal (fresh source event, same subscription, NULL line item) must not create a second row.
    const renew = await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["ai-kit"],
        sourceEventId: "in_2",
        source: sub("sub_nl"),
      }),
    );
    expect(renew).toBe(0);
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["ai-kit"]);
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

describe("updates windows (ADR-0244/0255 per-entitlement)", () => {
  /** Pin a grant's granted_at (superuser bypasses RLS) for deterministic baseline math. */
  const pinGrantedAt = (acct: string, iso: string) =>
    tp.query(
      `UPDATE entitlement_grant SET granted_at = $2 WHERE account_id = $1`,
      [acct, iso],
    );

  test("no active one-time grants → empty map (unbounded; subscription-only untouched, ADR-0244 §4)", async () => {
    const acct = "acct_win_none";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_w0",
        source: sub("sub_w0"),
      }),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)),
    ).toEqual({});
  });

  test("baseline = earliest one_time granted_at + 12 months, keyed by entitlement_id", async () => {
    const acct = "acct_win_base";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_w1",
        source: onetime("pay_w1"),
      }),
    );
    await pinGrantedAt(acct, "2026-01-05T00:00:00.000Z");
    expect(
      await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)),
    ).toEqual({ compliance: "2027-01-05T00:00:00.000Z" });
  });

  test("a renewal extends via updates_expires_at, which OVERRIDES the baseline for that key only", async () => {
    const acct = "acct_win_renew";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_w2",
        source: onetime("pay_w2"),
      }),
    );
    await pinGrantedAt(acct, "2026-01-05T00:00:00.000Z");
    const baseline = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    const extended = await withTenant(tp.pg, acct, (tx) =>
      extendUpdatesWindow(tx, {
        accountId: acct,
        entitlementId: "compliance",
        sourceEventId: "pay_renew_1",
      }),
    );
    expect(extended).toBe(1);
    const after = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    // A FIRST renewal bought mid-window STACKS onto the remaining months: GREATEST(now(),
    // granted_at + 12mo) + 12mo — with the base window end (2027-01-05) still in the future,
    // the result is exactly base-end + 12 months, never now() + 12 (which would silently drop
    // the un-elapsed window — the corrected ADR-0251 D5 formula).
    expect(after.compliance).toBe("2028-01-05T00:00:00.000Z");
    expect(Date.parse(after.compliance as string)).toBeGreaterThan(
      Date.parse(baseline.compliance ?? "0"),
    );

    // A SECOND renewal stacks the same way: GREATEST(now(), current expiry) + 12mo.
    await withTenant(tp.pg, acct, (tx) =>
      extendUpdatesWindow(tx, {
        accountId: acct,
        entitlementId: "compliance",
        sourceEventId: "pay_renew_2",
      }),
    );
    const second = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    expect(second.compliance).toBe("2029-01-05T00:00:00.000Z");
  });

  test("a duplicate re-purchase takes the pair's MOST FAVORABLE row (never the oldest purchase's window)", async () => {
    const acct = "acct_win_dup";
    // First purchase long ago (its 12-month window already lapsed) …
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_dup_1",
        source: onetime("pay_dup_1"),
      }),
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = $2
        WHERE account_id = $1 AND source_event_id = $3`,
      [acct, "2025-01-05T00:00:00.000Z", "pay_dup_1"],
    );
    // … then a fresh re-purchase of the same entitlement: the buyer paid again, so the claim
    // must carry the NEW purchase's window (max per-row bound), not min(granted_at) + 12mo.
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_dup_2",
        source: onetime("pay_dup_2"),
      }),
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = $2
        WHERE account_id = $1 AND source_event_id = $3`,
      [acct, "2026-06-01T00:00:00.000Z", "pay_dup_2"],
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)),
    ).toEqual({ compliance: "2027-06-01T00:00:00.000Z" });
  });

  test("renewing entitlement X extends ONLY X's window — an unrenewed entitled Y keeps its own", async () => {
    const acct = "acct_win_pair_map";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance", "local-ai"],
        sourceEventId: "pay_pair_map",
        source: onetime("pay_pair_map"),
      }),
    );
    await pinGrantedAt(acct, "2026-01-05T00:00:00.000Z");
    const before = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    expect(before).toEqual({
      compliance: "2027-01-05T00:00:00.000Z",
      "local-ai": "2027-01-05T00:00:00.000Z",
    });
    await withTenant(tp.pg, acct, (tx) =>
      extendUpdatesWindow(tx, {
        accountId: acct,
        entitlementId: "compliance",
        sourceEventId: "pay_pair_map_renew",
      }),
    );
    const after = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    // compliance moved; local-ai is UNTOUCHED — no cross-entitlement min/max coupling (ADR-0255 D2).
    expect(Date.parse(after.compliance as string)).toBeGreaterThan(
      Date.parse(before.compliance as string),
    );
    expect(after["local-ai"]).toBe(before["local-ai"]);
  });

  test("extendUpdatesWindow FAILS CLOSED on zero active one_time rows (never mints a grant)", async () => {
    // No grant at all.
    await expect(
      withTenant(tp.pg, "acct_win_nogrant", (tx) =>
        extendUpdatesWindow(tx, {
          accountId: "acct_win_nogrant",
          entitlementId: "compliance",
          sourceEventId: "pay_bad",
        }),
      ),
    ).rejects.toThrow(/extends no active/);

    // Subscription-only holder: a renewal is a one-time-purchase concept — still fail-closed.
    const acct = "acct_win_subonly";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_sub",
        source: sub("sub_only"),
      }),
    );
    await expect(
      withTenant(tp.pg, acct, (tx) =>
        extendUpdatesWindow(tx, {
          accountId: acct,
          entitlementId: "compliance",
          sourceEventId: "pay_bad2",
        }),
      ),
    ).rejects.toThrow(/extends no active/);

    // A REVOKED one_time grant does not extend either.
    const acct2 = "acct_win_revoked";
    await withTenant(tp.pg, acct2, (tx) =>
      grantEntitlements(tx, {
        accountId: acct2,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_r",
        source: onetime("pay_r"),
      }),
    );
    await withTenant(tp.pg, acct2, (tx) =>
      revokePurchaseGrants(tx, { accountId: acct2, purchaseId: "pay_r" }),
    );
    await expect(
      withTenant(tp.pg, acct2, (tx) =>
        extendUpdatesWindow(tx, {
          accountId: acct2,
          entitlementId: "compliance",
          sourceEventId: "pay_bad3",
        }),
      ),
    ).rejects.toThrow(/extends no active/);
  });

  test("a renewal extends ONLY the named entitlement's rows", async () => {
    const acct = "acct_win_pair";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance", "local-ai"],
        sourceEventId: "pay_pair",
        source: onetime("pay_pair"),
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      extendUpdatesWindow(tx, {
        accountId: acct,
        entitlementId: "compliance",
        sourceEventId: "pay_renew_pair",
      }),
    );
    const rows = await tp.query<{
      entitlement_id: string;
      extended: boolean;
    }>(
      `SELECT entitlement_id, (updates_expires_at IS NOT NULL) AS extended
         FROM entitlement_grant WHERE account_id = $1 ORDER BY entitlement_id`,
      [acct],
    );
    expect(rows).toEqual([
      { entitlement_id: "compliance", extended: true },
      { entitlement_id: "local-ai", extended: false },
    ]);
  });
});

describe("snapshot-at-sale entitledSince (ADR-0257 §1.2)", () => {
  const pinGrantedAt = (acct: string, iso: string, sourceEventId: string) =>
    tp.query(
      `UPDATE entitlement_grant SET granted_at = $2
        WHERE account_id = $1 AND source_event_id = $3`,
      [acct, iso, sourceEventId],
    );

  test("no active one-time grants → empty map (grandfathered; subscription-only never keyed)", async () => {
    const acct = "acct_since_none";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "since_sub_0",
        source: sub("since_sub_0"),
      }),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => computeEntitledSince(tx, acct)),
    ).toEqual({});
  });

  test("entitledSince = the one_time grant's granted_at, keyed by entitlement_id", async () => {
    const acct = "acct_since_one";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "since_pay_1",
        source: onetime("since_pay_1"),
      }),
    );
    await pinGrantedAt(acct, "2026-07-06T00:00:00.000Z", "since_pay_1");
    expect(
      await withTenant(tp.pg, acct, (tx) => computeEntitledSince(tx, acct)),
    ).toEqual({ compliance: "2026-07-06T00:00:00.000Z" });
  });

  test("a re-purchase takes the MOST FAVORABLE (latest) granted_at — the newer, larger snapshot", async () => {
    const acct = "acct_since_dup";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "since_dup_1",
        source: onetime("since_dup_1"),
      }),
    );
    await pinGrantedAt(acct, "2026-01-05T00:00:00.000Z", "since_dup_1");
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "since_dup_2",
        source: onetime("since_dup_2"),
      }),
    );
    await pinGrantedAt(acct, "2026-07-06T00:00:00.000Z", "since_dup_2");
    // MAX(granted_at) — a later re-purchase entitles the buyer to the newer snapshot, mirroring
    // computeUpdatesWindows' most-favorable rule (ADR-0255 D3).
    expect(
      await withTenant(tp.pg, acct, (tx) => computeEntitledSince(tx, acct)),
    ).toEqual({ compliance: "2026-07-06T00:00:00.000Z" });
  });

  test("subscription grants never appear (their expiry governs, not a snapshot)", async () => {
    const acct = "acct_since_mixed";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "since_ot",
        source: onetime("since_ot"),
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["local-ai"],
        sourceEventId: "since_sub",
        source: sub("since_sub"),
      }),
    );
    const since = await withTenant(tp.pg, acct, (tx) =>
      computeEntitledSince(tx, acct),
    );
    expect(Object.keys(since)).toEqual(["compliance"]);
  });
});

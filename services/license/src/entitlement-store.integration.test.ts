// entitlement_grant junction on PGlite + real withTenant RLS (ADR-0113/0071/0005). Asserts: a grant
// persists per-source rows; read returns the DISTINCT active ids sorted; a same-source re-grant is
// idempotent (refcount stays one); REFCOUNT — two sources granting the same edition keep it entitled
// until BOTH are revoked; subscription revoke strips only that subscription's grants; a one-time grant
// survives a subscription cancel; revokes are soft (status flips, row stays) + idempotent; RLS isolates
// accounts and refuses a cross-tenant write. Each test uses its own account id — no cross-test cleanup.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { LEGACY_ENTITLEMENT_ALIASES } from "@caisson/registry-schema";
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";

/**
 * Run `body` with a temporary MODULE-RENAME alias installed in the shared spine (ADR-0270 narrowed the
 * production spine to empty, but the read-back alias fold must survive for the NEXT rename). Injects
 * `old → current` for the duration, then restores — the surviving-alias stand-in the edition ids used to
 * be. The store read-backs (`extendUpdatesWindow`, `subscriptionCoverageHorizons`) fold this group in SQL.
 */
async function withRenameAlias(
  old: string,
  current: string,
  body: () => Promise<void>,
): Promise<void> {
  const spine = LEGACY_ENTITLEMENT_ALIASES as Map<string, string>;
  spine.set(old, current);
  try {
    await body();
  } finally {
    spine.delete(old);
  }
}
import {
  ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  RENEWAL_EXTENSION_MONTHS_MIGRATION_SQL,
  RENEWAL_EXTENSION_SCHEMA_SQL,
  ENTITLEMENT_SCHEMA_SQL,
  UPDATES_WINDOW_EXPIRY_NOTICE_SCHEMA_SQL,
  computeEntitledSince,
  computeUpdatesWindows,
  extendUpdatesWindow,
  grantEntitlements,
  readEntitlements,
  netCharged,
  readOneTimeEntitlements,
  reconcileCoverageGrants,
  recordLineRefund,
  reverseRenewalExtensions,
  revokePurchaseGrants,
  revokePurchaseLineGrants,
  revokeSubscriptionGrants,
  sweepUpdatesWindowExpiryNotices,
  upsertSubscriptionGrants,
} from "./entitlement-store.ts";

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  await tp.exec(ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL);
  await tp.exec(RENEWAL_EXTENSION_SCHEMA_SQL);
  await tp.exec(RENEWAL_EXTENSION_MONTHS_MIGRATION_SQL);
  await tp.exec(UPDATES_WINDOW_EXPIRY_NOTICE_SCHEMA_SQL);
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

  test("multi-year lever (R6 rider): years=2 stacks 24 months in ONE step, not two 12-month stacks", async () => {
    const acct = "acct_win_multiyear";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_my1",
        source: onetime("pay_my1"),
      }),
    );
    await pinGrantedAt(acct, "2026-01-05T00:00:00.000Z");
    // Baseline window end = 2027-01-05. A 2-year renewal bought mid-window stacks the full 24
    // months onto that end (GREATEST(now(), base-end) + 24mo), exactly like the 1-year case stacks
    // 12 — never two separate 12-month steps, which would land on the same instant here anyway
    // (2027-01-05 + 24mo == 2027-01-05 + 12mo + 12mo) but must NOT silently drop to a single
    // 12-month extension if `years` were ignored.
    const extended = await withTenant(tp.pg, acct, (tx) =>
      extendUpdatesWindow(tx, {
        accountId: acct,
        entitlementId: "compliance",
        sourceEventId: "pay_my_renew",
        years: 2,
      }),
    );
    expect(extended).toBe(1);
    const after = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    expect(after.compliance).toBe("2029-01-05T00:00:00.000Z");
  });

  test("extendUpdatesWindow FAILS CLOSED on a non-positive-integer years (malformed RENEWAL_BOOK row)", async () => {
    const acct = "acct_win_badyears";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_badyears",
        source: onetime("pay_badyears"),
      }),
    );
    for (const years of [0, -1, 1.5]) {
      await expect(
        withTenant(tp.pg, acct, (tx) =>
          extendUpdatesWindow(tx, {
            accountId: acct,
            entitlementId: "compliance",
            sourceEventId: "pay_badyears_renew",
            years,
          }),
        ),
      ).rejects.toThrow(/years must be a positive integer/);
    }
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

  test("a renewal under the CURRENT rename spelling extends a grant keyed to the OLD spelling (alias-group convergence)", async () => {
    // A buyer holds a one_time grant under a module's OLD slug ("mod-old"); a later rename makes the
    // canonical spelling "mod-new" (the surviving-alias stand-in for what the edition ids used to be,
    // ADR-0270). The alias-group match bridges the two spellings in SQL — without it the renewal would
    // fail-closed-throw. The next module rename is exactly this shape.
    const acct = "acct_win_alias";
    await withRenameAlias("mod-old", "mod-new", async () => {
      await withTenant(tp.pg, acct, (tx) =>
        grantEntitlements(tx, {
          accountId: acct,
          entitlementIds: ["mod-old"],
          sourceEventId: "pay_legacy",
          source: onetime("pay_legacy"),
        }),
      );
      const extended = await withTenant(tp.pg, acct, (tx) =>
        extendUpdatesWindow(tx, {
          accountId: acct,
          entitlementId: "mod-new",
          sourceEventId: "pay_renew_alias",
        }),
      );
      expect(extended).toBe(1);

      // The tolerance is a bridge, not a wildcard: an alias-group miss still fails closed.
      await expect(
        withTenant(tp.pg, acct, (tx) =>
          extendUpdatesWindow(tx, {
            accountId: acct,
            entitlementId: "compliance",
            sourceEventId: "pay_renew_miss",
          }),
        ),
      ).rejects.toThrow(/extends no active/);
    });
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

describe("renewal-extension ledger + reverse (un-extend, ADR-0251 Consequences)", () => {
  const pinGrantedAt = (acct: string, iso: string) =>
    tp.query(
      `UPDATE entitlement_grant SET granted_at = $2 WHERE account_id = $1`,
      [acct, iso],
    );
  const ledgerStatuses = async (acct: string) =>
    (
      await tp.query<{ status: string }>(
        `SELECT status FROM renewal_extension WHERE account_id = $1 ORDER BY line_item_id`,
        [acct],
      )
    ).map((r) => r.status);
  const windowOf = (acct: string) =>
    withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct));

  test("extendUpdatesWindow records a renewal_extension row keyed to the purchase + line", async () => {
    const acct = "acct_ren_ledger";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_rl",
        source: onetime("pay_rl"),
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      extendUpdatesWindow(tx, {
        accountId: acct,
        entitlementId: "compliance",
        sourceEventId: "pay_ren_rl",
        lineItemId: "txnitm_rl",
      }),
    );
    const rows = await tp.query<{
      entitlement_id: string;
      purchase_id: string;
      line_item_id: string;
      months: number;
      status: string;
    }>(
      `SELECT entitlement_id, purchase_id, line_item_id, months, status
         FROM renewal_extension WHERE account_id = $1`,
      [acct],
    );
    expect(rows).toEqual([
      {
        entitlement_id: "compliance",
        purchase_id: "pay_ren_rl",
        line_item_id: "txnitm_rl",
        months: 12,
        status: "active",
      },
    ]);
  });

  test("reverse un-extends the window back to the original purchase window (mid-window renewal)", async () => {
    const acct = "acct_ren_rev";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_rev",
        source: onetime("pay_rev"),
      }),
    );
    await pinGrantedAt(acct, "2026-01-05T00:00:00.000Z"); // baseline window end = 2027-01-05
    await withTenant(tp.pg, acct, (tx) =>
      extendUpdatesWindow(tx, {
        accountId: acct,
        entitlementId: "compliance",
        sourceEventId: "pay_ren_rev",
        lineItemId: "txnitm_rev",
      }),
    );
    expect((await windowOf(acct)).compliance).toBe("2028-01-05T00:00:00.000Z");

    const n = await withTenant(tp.pg, acct, (tx) =>
      reverseRenewalExtensions(tx, {
        accountId: acct,
        purchaseId: "pay_ren_rev",
      }),
    );
    expect(n).toBe(1);
    // Exactly back to the original purchase window — never below it.
    expect((await windowOf(acct)).compliance).toBe("2027-01-05T00:00:00.000Z");
    expect(await ledgerStatuses(acct)).toEqual(["reversed"]);
  });

  test("reverse un-extends the full tenor of a two-year renewal", async () => {
    const acct = "acct_ren_rev_2y";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_rev_2y",
        source: onetime("pay_rev_2y"),
      }),
    );
    await pinGrantedAt(acct, "2026-01-05T00:00:00.000Z"); // baseline window end = 2027-01-05
    await withTenant(tp.pg, acct, (tx) =>
      extendUpdatesWindow(tx, {
        accountId: acct,
        entitlementId: "compliance",
        sourceEventId: "pay_ren_rev_2y",
        lineItemId: "txnitm_rev_2y",
        years: 2,
      }),
    );
    expect((await windowOf(acct)).compliance).toBe("2029-01-05T00:00:00.000Z");
    expect(
      await tp.query<{ months: number }>(
        `SELECT months FROM renewal_extension
          WHERE account_id = $1 AND purchase_id = $2`,
        [acct, "pay_ren_rev_2y"],
      ),
    ).toEqual([{ months: 24 }]);

    const n = await withTenant(tp.pg, acct, (tx) =>
      reverseRenewalExtensions(tx, {
        accountId: acct,
        purchaseId: "pay_ren_rev_2y",
      }),
    );
    expect(n).toBe(1);
    expect((await windowOf(acct)).compliance).toBe("2027-01-05T00:00:00.000Z");
    expect(await ledgerStatuses(acct)).toEqual(["reversed"]);
  });

  test("a pre-migration renewal row with NULL months reverses as the legacy 12-month tenor", async () => {
    const acct = "acct_ren_rev_legacy";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_rev_legacy",
        source: onetime("pay_rev_legacy"),
      }),
    );
    await pinGrantedAt(acct, "2026-01-05T00:00:00.000Z");
    await withTenant(tp.pg, acct, (tx) =>
      extendUpdatesWindow(tx, {
        accountId: acct,
        entitlementId: "compliance",
        sourceEventId: "pay_ren_rev_legacy",
        lineItemId: "txnitm_rev_legacy",
      }),
    );
    await tp.query(
      `UPDATE renewal_extension SET months = NULL
        WHERE account_id = $1 AND purchase_id = $2`,
      [acct, "pay_ren_rev_legacy"],
    );

    await withTenant(tp.pg, acct, (tx) =>
      reverseRenewalExtensions(tx, {
        accountId: acct,
        purchaseId: "pay_ren_rev_legacy",
      }),
    );
    expect((await windowOf(acct)).compliance).toBe("2027-01-05T00:00:00.000Z");
  });

  test("a second refund event does not double-shrink (idempotent latch)", async () => {
    const acct = "acct_ren_idem";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_idem",
        source: onetime("pay_idem"),
      }),
    );
    await pinGrantedAt(acct, "2026-01-05T00:00:00.000Z");
    await withTenant(tp.pg, acct, (tx) =>
      extendUpdatesWindow(tx, {
        accountId: acct,
        entitlementId: "compliance",
        sourceEventId: "pay_ren_idem",
        lineItemId: "txnitm_idem",
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      reverseRenewalExtensions(tx, {
        accountId: acct,
        purchaseId: "pay_ren_idem",
      }),
    );
    const afterFirst = (await windowOf(acct)).compliance;
    // A SECOND refund delivery (distinct event) finds only a latched row → reverses nothing.
    const second = await withTenant(tp.pg, acct, (tx) =>
      reverseRenewalExtensions(tx, {
        accountId: acct,
        purchaseId: "pay_ren_idem",
      }),
    );
    expect(second).toBe(0);
    expect((await windowOf(acct)).compliance).toBe(afterFirst); // no double-shrink
    expect(afterFirst).toBe("2027-01-05T00:00:00.000Z");
  });

  test("reversing ONE of two stacked renewals removes exactly one interval (never below baseline)", async () => {
    const acct = "acct_ren_stack";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_stack",
        source: onetime("pay_stack"),
      }),
    );
    await pinGrantedAt(acct, "2026-01-05T00:00:00.000Z"); // baseline 2027-01-05
    // Two renewals from two distinct purchases → +24 months total (2029-01-05).
    for (const pay of ["pay_ren_stack_a", "pay_ren_stack_b"]) {
      await withTenant(tp.pg, acct, (tx) =>
        extendUpdatesWindow(tx, {
          accountId: acct,
          entitlementId: "compliance",
          sourceEventId: pay,
        }),
      );
    }
    expect((await windowOf(acct)).compliance).toBe("2029-01-05T00:00:00.000Z");
    // Refund only the second renewal purchase → drop exactly one 12-month interval.
    await withTenant(tp.pg, acct, (tx) =>
      reverseRenewalExtensions(tx, {
        accountId: acct,
        purchaseId: "pay_ren_stack_b",
      }),
    );
    expect((await windowOf(acct)).compliance).toBe("2028-01-05T00:00:00.000Z");
  });

  test("per-line reversal un-extends ONLY the refunded line's renewal", async () => {
    const acct = "acct_ren_line";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_line",
        source: onetime("pay_line"),
      }),
    );
    await pinGrantedAt(acct, "2026-01-05T00:00:00.000Z"); // baseline 2027-01-05
    // ONE purchase carrying TWO renewal lines for the same entitlement → +24 months.
    for (const line of ["txnitm_a", "txnitm_b"]) {
      await withTenant(tp.pg, acct, (tx) =>
        extendUpdatesWindow(tx, {
          accountId: acct,
          entitlementId: "compliance",
          sourceEventId: "pay_ren_line",
          lineItemId: line,
        }),
      );
    }
    expect((await windowOf(acct)).compliance).toBe("2029-01-05T00:00:00.000Z");
    // A per-line full refund of ONLY txnitm_a reverses one interval; txnitm_b stays.
    await withTenant(tp.pg, acct, (tx) =>
      reverseRenewalExtensions(tx, {
        accountId: acct,
        purchaseId: "pay_ren_line",
        lineItemIds: ["txnitm_a"],
      }),
    );
    expect((await windowOf(acct)).compliance).toBe("2028-01-05T00:00:00.000Z");
    expect(await ledgerStatuses(acct)).toEqual(["reversed", "active"]);
  });

  test("a renewal on a LAPSED window reverses to at-or-above the original purchase window (floor holds)", async () => {
    const acct = "acct_ren_lapsed";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_lapsed",
        source: onetime("pay_lapsed"),
      }),
    );
    // Original purchase long ago — its 12-month window is already lapsed (baseline 2025-01-05).
    await pinGrantedAt(acct, "2024-01-05T00:00:00.000Z");
    await withTenant(tp.pg, acct, (tx) =>
      extendUpdatesWindow(tx, {
        accountId: acct,
        entitlementId: "compliance",
        sourceEventId: "pay_ren_lapsed",
        lineItemId: "txnitm_lapsed",
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      reverseRenewalExtensions(tx, {
        accountId: acct,
        purchaseId: "pay_ren_lapsed",
      }),
    );
    // The floor (granted_at + 12mo = 2025-01-05) is never breached — a lapsed-window reversal may
    // over-restore toward now() (documented ceiling, favors the buyer), but never below baseline.
    const after = (await windowOf(acct)).compliance as string;
    expect(Date.parse(after)).toBeGreaterThanOrEqual(
      Date.parse("2025-01-05T00:00:00.000Z"),
    );
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

describe("ADR-0269 subscription-covered pairs (horizon-extended claims + the owned read + reconcile)", () => {
  test("readOneTimeEntitlements returns ONLY active one_time ids — never subscription, admin_comp, or revoked rows", async () => {
    const acct = "acct_owned_read";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance", "field-crypto"],
        sourceEventId: "own_1",
        source: onetime("own_1"),
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["local-ai"],
        sourceEventId: "own_sub",
        source: sub("sub_own"),
      }),
    );
    // An operator comp (admin_comp) — inserted superuser-side; comps are NOT "owned" (ADR-0269 D1).
    await tp.query(
      `INSERT INTO entitlement_grant
         (id, account_id, entitlement_id, source_kind, subscription_id, purchase_id, source_event_id)
       VALUES ('comp_own', $1, 'audit-worm', 'admin_comp', NULL, NULL, 'own_comp')`,
      [acct],
    );
    // A revoked one_time buy drops out.
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["ai-meter"],
        sourceEventId: "own_2",
        source: onetime("own_2"),
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      revokePurchaseGrants(tx, { accountId: acct, purchaseId: "own_2" }),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => readOneTimeEntitlements(tx, acct)),
    ).toEqual(["compliance", "field-crypto"]);
  });

  test("a subscription-covered pair EXTENDS its keys to the coverage horizon; the paid horizon is GRANDFATHERED across the subscription revoke", async () => {
    const acct = "acct_covered";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "cov_ot",
        source: onetime("cov_ot"),
      }),
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = $2 WHERE account_id = $1`,
      [acct, "2026-01-05T00:00:00.000Z"],
    );
    // Uncovered: the one_time-derived window + snapshot instant are signed.
    expect(
      await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)),
    ).toEqual({ compliance: "2027-01-05T00:00:00.000Z" });
    expect(
      Object.keys(
        await withTenant(tp.pg, acct, (tx) => computeEntitledSince(tx, acct)),
      ),
    ).toEqual(["compliance"]);
    // Covered (the Developer-plan re-grant shape, ANNUAL cadence): the pair's keys EXTEND to the
    // coverage horizon (now + 1 year) — present, bounded, never dropped (the drop read as
    // unbounded in a perpetual offline token no cancel could claw back; audit P1 2, 2026-07-06).
    await withTenant(tp.pg, acct, (tx) =>
      upsertSubscriptionGrants(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        subscriptionId: "sub_cov",
        sourceEventId: "cov_sub",
        cadence: "year",
        coverageMirror: true,
      }),
    );
    const covered = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    const horizon = Date.parse(covered.compliance ?? "");
    expect(horizon).toBeGreaterThan(Date.parse("2027-01-05T00:00:00.000Z"));
    expect(horizon).toBeGreaterThan(Date.now() + 360 * 86_400_000);
    const since = await withTenant(tp.pg, acct, (tx) =>
      computeEntitledSince(tx, acct),
    );
    expect(Date.parse(since.compliance ?? "")).toBe(horizon);
    // Revoked (subscription.canceled): the PAID horizon persists — a horizon is a fact about
    // money actually received (covered-period grandfathering, operator-locked 2026-07-06). The
    // bound stops EXTENDING at cancel; it never shrinks, so a re-mint and a saved stale token
    // agree. The stored one_time bound underneath is untouched.
    await withTenant(tp.pg, acct, (tx) =>
      revokeSubscriptionGrants(tx, {
        accountId: acct,
        subscriptionId: "sub_cov",
      }),
    );
    const afterCancel = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    expect(Date.parse(afterCancel.compliance ?? "")).toBe(horizon);
    // A LATE out-of-order re-grant after the cancel (audit P2 3) never resurrects or EXTENDS the
    // revoked mirror: the tombstone occupies the key, the bound stays the already-paid horizon.
    await withTenant(tp.pg, acct, (tx) =>
      upsertSubscriptionGrants(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        subscriptionId: "sub_cov",
        sourceEventId: "cov_sub_late",
        cadence: "year",
        coverageMirror: true,
      }),
    );
    expect(
      Date.parse(
        (await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)))
          .compliance ?? "",
      ),
    ).toBe(horizon);
  });

  test("each granting invoice EXTENDS the horizon monotonically (GREATEST — never shrinks)", async () => {
    const acct = "acct_horizon_ext";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "ext_ot",
        source: onetime("ext_ot"),
      }),
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = $2 WHERE account_id = $1`,
      [acct, "2020-01-05T00:00:00.000Z"], // lapsed own window — the horizon is the live bound
    );
    const mirror = (sourceEventId: string, cadence: "month" | "year") =>
      withTenant(tp.pg, acct, (tx) =>
        upsertSubscriptionGrants(tx, {
          accountId: acct,
          entitlementIds: ["compliance"],
          subscriptionId: "sub_ext",
          sourceEventId,
          cadence,
          coverageMirror: true,
        }),
      );
    await mirror("ext_inv_1", "month");
    const first = Date.parse(
      (await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)))
        .compliance ?? "",
    );
    expect(first).toBeGreaterThan(Date.now() + 25 * 86_400_000);
    await mirror("ext_inv_2", "year");
    const second = Date.parse(
      (await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)))
        .compliance ?? "",
    );
    expect(second).toBeGreaterThan(first);
    // A replay stamping an EARLIER horizon (month after year) never shrinks the bound.
    await mirror("ext_inv_3", "month");
    expect(
      Date.parse(
        (await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)))
          .compliance ?? "",
      ),
    ).toBe(second);
  });

  test("a legacy NULL-horizon subscription row lifts NOTHING (no unbounded coverage from pre-stamp rows)", async () => {
    const acct = "acct_null_horizon";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "nh_ot",
        source: onetime("nh_ot"),
      }),
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = $2 WHERE account_id = $1`,
      [acct, "2026-01-05T00:00:00.000Z"],
    );
    // A pre-horizon subscription grant (grantEntitlements — updates_expires_at NULL).
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "nh_sub",
        source: sub("sub_nh"),
      }),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => computeUpdatesWindows(tx, acct)),
    ).toEqual({ compliance: "2027-01-05T00:00:00.000Z" });
  });

  test("coverage is ALIAS-TOLERANT: a mirror under the CURRENT rename spelling extends an OLD-keyed one_time pair", async () => {
    const acct = "acct_covered_alias";
    await withRenameAlias("mod-old", "mod-new", async () => {
      // A one_time buy under the OLD module slug (the surviving-alias stand-in for a pre-rename buyer)…
      await withTenant(tp.pg, acct, (tx) =>
        grantEntitlements(tx, {
          accountId: acct,
          entitlementIds: ["mod-old"],
          sourceEventId: "al_ot",
          source: onetime("al_ot"),
        }),
      );
      await tp.query(
        `UPDATE entitlement_grant SET granted_at = $2 WHERE account_id = $1`,
        [acct, "2026-01-05T00:00:00.000Z"],
      );
      // …covered by a mirror written under the CURRENT (renamed) spelling.
      await withTenant(tp.pg, acct, (tx) =>
        upsertSubscriptionGrants(tx, {
          accountId: acct,
          entitlementIds: ["mod-new"],
          subscriptionId: "sub_al",
          sourceEventId: "al_sub",
          cadence: "year",
          coverageMirror: true,
        }),
      );
      const windows = await withTenant(tp.pg, acct, (tx) =>
        computeUpdatesWindows(tx, acct),
      );
      expect(Date.parse(windows["mod-old"] ?? "")).toBeGreaterThan(
        Date.parse("2027-01-05T00:00:00.000Z"),
      );
    });
  });

  test("reconcileCoverageGrants sweeps ONLY the orphaned mirror — backed mirrors and STATIC grants survive", async () => {
    const acct = "acct_reconcile";
    // Purchase P1 backs compliance; P2 backs field-crypto; both mirrored under the Developer sub.
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "rc_p1",
        source: onetime("rc_p1"),
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["field-crypto"],
        sourceEventId: "rc_p2",
        source: onetime("rc_p2"),
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      upsertSubscriptionGrants(tx, {
        accountId: acct,
        entitlementIds: ["compliance", "field-crypto"],
        subscriptionId: "sub_rc",
        sourceEventId: "rc_inv",
        cadence: "year",
        coverageMirror: true,
      }),
    );
    // A STATIC plan grant of compliance under a DIFFERENT subscription (paid for on its own).
    await withTenant(tp.pg, acct, (tx) =>
      upsertSubscriptionGrants(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        subscriptionId: "sub_static",
        sourceEventId: "rc_static_inv",
        cadence: "year",
      }),
    );
    // Refund P1 → its one_time row falls; the reconcile must fell ONLY compliance's MIRROR.
    await withTenant(tp.pg, acct, (tx) =>
      revokePurchaseGrants(tx, { accountId: acct, purchaseId: "rc_p1" }),
    );
    const swept = await withTenant(tp.pg, acct, (tx) =>
      reconcileCoverageGrants(tx, acct),
    );
    expect(swept).toBe(1);
    // compliance stays entitled through the STATIC grant; field-crypto through P2 + its mirror.
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual(["compliance", "field-crypto"]);
    // field-crypto's pair still carries the horizon (its mirror survived, backed by P2).
    const windows = await withTenant(tp.pg, acct, (tx) =>
      computeUpdatesWindows(tx, acct),
    );
    expect(Object.keys(windows)).toEqual(["field-crypto"]);
    expect(Date.parse(windows["field-crypto"] ?? "")).toBeGreaterThan(
      Date.now() + 360 * 86_400_000,
    );
    // Idempotent: a second reconcile sweeps nothing.
    expect(
      await withTenant(tp.pg, acct, (tx) => reconcileCoverageGrants(tx, acct)),
    ).toBe(0);
  });

  test("reconcile is REFCOUNT-aware: a mirror survives while ANY sibling purchase still backs its id", async () => {
    const acct = "acct_reconcile_refcount";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["ai-meter"],
        sourceEventId: "rr_p1",
        source: onetime("rr_p1"),
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["ai-meter"],
        sourceEventId: "rr_p2",
        source: onetime("rr_p2"),
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      upsertSubscriptionGrants(tx, {
        accountId: acct,
        entitlementIds: ["ai-meter"],
        subscriptionId: "sub_rr",
        sourceEventId: "rr_inv",
        cadence: "year",
        coverageMirror: true,
      }),
    );
    await withTenant(tp.pg, acct, (tx) =>
      revokePurchaseGrants(tx, { accountId: acct, purchaseId: "rr_p1" }),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => reconcileCoverageGrants(tx, acct)),
    ).toBe(0); // rr_p2 still backs ai-meter — the mirror stands
    await withTenant(tp.pg, acct, (tx) =>
      revokePurchaseGrants(tx, { accountId: acct, purchaseId: "rr_p2" }),
    );
    expect(
      await withTenant(tp.pg, acct, (tx) => reconcileCoverageGrants(tx, acct)),
    ).toBe(1); // last backing gone → the mirror falls with it
    expect(
      await withTenant(tp.pg, acct, (tx) => readEntitlements(tx, acct)),
    ).toEqual([]);
  });
});

interface CapturedSend {
  to: string;
  template: string;
  data: Record<string, unknown>;
}

function captureEmailer(): {
  emailer: { send: (msg: CapturedSend) => Promise<void> };
  sent: CapturedSend[];
} {
  const sent: CapturedSend[] = [];
  return {
    emailer: {
      send: async (msg: CapturedSend) => {
        sent.push(msg);
      },
    },
    sent,
  };
}

describe("sweepUpdatesWindowExpiryNotices (G24, buyer-lifecycle audit 2026-07-07)", () => {
  test("a window expiring within the notice horizon sends ONE notice and marks it", async () => {
    const acct = "acct_g24_due";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pi_g24_due",
        source: onetime("pi_g24_due"),
      }),
    );
    // Precise boundary control via raw SQL -- 10 days out, inside the default 30d window.
    await tp.exec(
      `UPDATE entitlement_grant SET updates_expires_at = now() + interval '10 days'
       WHERE account_id = 'acct_g24_due' AND entitlement_id = 'compliance'`,
    );
    const { emailer, sent } = captureEmailer();
    const count = await withTenant(tp.pg, acct, (tx) =>
      sweepUpdatesWindowExpiryNotices(tx, acct, {
        recipient: "buyer@example.test",
        emailer,
        dashboardUrl: "https://example.test/dashboard/license",
      }),
    );
    expect(count).toBe(1);
    expect(sent.length).toBe(1);
    expect(sent[0]?.to).toBe("buyer@example.test");
    expect(sent[0]?.template).toBe("updates-window-expiring");
    expect(sent[0]?.data.entitlementId).toBe("compliance");
    expect(sent[0]?.data.url).toBe("https://example.test/dashboard/license");
  });

  test("a replayed sweep sends nothing -- already noticed for this exact expiry", async () => {
    const { emailer, sent } = captureEmailer();
    const count = await withTenant(tp.pg, "acct_g24_due", (tx) =>
      sweepUpdatesWindowExpiryNotices(tx, "acct_g24_due", {
        recipient: "buyer@example.test",
        emailer,
        dashboardUrl: "https://example.test/dashboard/license",
      }),
    );
    expect(count).toBe(0);
    expect(sent).toEqual([]);
  });

  test("a window outside the notice horizon sends nothing (no updates_expires_at stamped)", async () => {
    const acct = "acct_g24_far";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pi_g24_far",
        source: onetime("pi_g24_far"),
      }),
    );
    // No updates_expires_at stamped -> computeUpdatesWindows would derive granted_at+12mo, but the
    // RAW column this sweep reads is still NULL -> excluded by "IS NOT NULL", not a false positive.
    const { emailer, sent } = captureEmailer();
    const count = await withTenant(tp.pg, acct, (tx) =>
      sweepUpdatesWindowExpiryNotices(tx, acct, {
        recipient: "buyer@example.test",
        emailer,
        dashboardUrl: "https://example.test/dashboard/license",
      }),
    );
    expect(count).toBe(0);
    expect(sent).toEqual([]);
  });

  test("a renewal that pushes the expiry to a NEW instant is a fresh notice-eligible window", async () => {
    const acct = "acct_g24_renew";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pi_g24_renew",
        source: onetime("pi_g24_renew"),
      }),
    );
    await tp.exec(
      `UPDATE entitlement_grant SET updates_expires_at = now() + interval '5 days'
       WHERE account_id = 'acct_g24_renew' AND entitlement_id = 'compliance'`,
    );
    const first = captureEmailer();
    expect(
      await withTenant(tp.pg, acct, (tx) =>
        sweepUpdatesWindowExpiryNotices(tx, acct, {
          recipient: "buyer@example.test",
          emailer: first.emailer,
          dashboardUrl: "https://example.test/dashboard/license",
        }),
      ),
    ).toBe(1);

    // The buyer renews -- a DIFFERENT expiry instant, still inside the window. Keying the marker
    // on the expiry INSTANT (not just the entitlement id) means this is a FRESH, distinct
    // notice-eligible window, not a stuck-forever marker.
    await tp.exec(
      `UPDATE entitlement_grant SET updates_expires_at = now() + interval '20 days'
       WHERE account_id = 'acct_g24_renew' AND entitlement_id = 'compliance'`,
    );
    const second = captureEmailer();
    expect(
      await withTenant(tp.pg, acct, (tx) =>
        sweepUpdatesWindowExpiryNotices(tx, acct, {
          recipient: "buyer@example.test",
          emailer: second.emailer,
          dashboardUrl: "https://example.test/dashboard/license",
        }),
      ),
    ).toBe(1);
    expect(second.sent.length).toBe(1);
  });
});

describe("recordLineRefund (ADR-0394 / release-audit F2)", () => {
  /** Grant one entitlement on `line` with a stamped charge, then return its stored row. */
  async function grantWithCharge(
    acct: string,
    line: string,
    amountMinorUnits: number,
  ): Promise<void> {
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: `pi_${line}`,
        source: onetime(`pi_${line}`),
        lineItemId: line,
        charged: { amountMinorUnits, currency: "USD" },
      }),
    );
  }

  async function refundState(
    acct: string,
  ): Promise<{ charged: number | null; refunded: number | null }> {
    const r = await withTenant(tp.pg, acct, (tx) =>
      tx.query<{
        charged_amount: number | null;
        refunded_amount: number | null;
      }>(
        `SELECT charged_amount, refunded_amount FROM entitlement_grant
          WHERE account_id = $1`,
        [acct],
      ),
    );
    const row = r.rows[0];
    return {
      charged: row?.charged_amount ?? null,
      refunded: row?.refunded_amount ?? null,
    };
  }

  test("a redelivery of the SAME adjustment adds nothing -- the defect that killed the in-place decrement", async () => {
    const acct = "acct_f2_replay";
    await grantWithCharge(acct, "txnitm_f2a", 164900);
    const first = await withTenant(tp.pg, acct, (tx) =>
      recordLineRefund(tx, {
        accountId: acct,
        lineItemId: "txnitm_f2a",
        amountMinorUnits: 40000,
        adjustmentId: "adj_f2_1",
      }),
    );
    expect(first).toBe(1);
    // Paddle redelivers the same adjustment. The reverted in-place decrement took 164900 -> 84900
    // here instead of 124900; this must be inert.
    const replay = await withTenant(tp.pg, acct, (tx) =>
      recordLineRefund(tx, {
        accountId: acct,
        lineItemId: "txnitm_f2a",
        amountMinorUnits: 40000,
        adjustmentId: "adj_f2_1",
      }),
    );
    expect(replay).toBe(0);
    const state = await refundState(acct);
    expect(state.charged).toBe(164900); // stamped charge NEVER mutates
    expect(state.refunded).toBe(40000);
    expect(netCharged(state.charged, state.refunded)).toBe(124900);
  });

  test("two DISTINCT sequential adjustments both apply", async () => {
    const acct = "acct_f2_two";
    await grantWithCharge(acct, "txnitm_f2b", 100000);
    for (const adj of ["adj_f2_a", "adj_f2_b"]) {
      await withTenant(tp.pg, acct, (tx) =>
        recordLineRefund(tx, {
          accountId: acct,
          lineItemId: "txnitm_f2b",
          amountMinorUnits: 15000,
          adjustmentId: adj,
        }),
      );
    }
    const state = await refundState(acct);
    expect(state.refunded).toBe(30000);
    expect(netCharged(state.charged, state.refunded)).toBe(70000);
  });

  test("a refund exceeding the charge floors the net at 0, never negative", async () => {
    const acct = "acct_f2_over";
    await grantWithCharge(acct, "txnitm_f2c", 9900);
    await withTenant(tp.pg, acct, (tx) =>
      recordLineRefund(tx, {
        accountId: acct,
        lineItemId: "txnitm_f2c",
        amountMinorUnits: 99900,
        adjustmentId: "adj_f2_over",
      }),
    );
    const state = await refundState(acct);
    expect(netCharged(state.charged, state.refunded)).toBe(0);
  });

  test("a line with no grants updates nothing (a credits-only line) and a zero refund is a no-op", async () => {
    const acct = "acct_f2_none";
    await grantWithCharge(acct, "txnitm_f2d", 5000);
    expect(
      await withTenant(tp.pg, acct, (tx) =>
        recordLineRefund(tx, {
          accountId: acct,
          lineItemId: "txnitm_nonexistent",
          amountMinorUnits: 1000,
          adjustmentId: "adj_f2_none",
        }),
      ),
    ).toBe(0);
    expect(
      await withTenant(tp.pg, acct, (tx) =>
        recordLineRefund(tx, {
          accountId: acct,
          lineItemId: "txnitm_f2d",
          amountMinorUnits: 0,
          adjustmentId: "adj_f2_zero",
        }),
      ),
    ).toBe(0);
    expect((await refundState(acct)).refunded).toBeNull();
  });

  test("an unattributable charge stays unknown -- NULL in, NULL out, never 0", () => {
    // Folding NULL to 0 would turn "we could not attribute this charge to one SKU" into "the buyer
    // paid nothing", which credits at retail-minus-nothing instead of retail.
    expect(netCharged(null, null)).toBeNull();
    expect(netCharged(null, 5000)).toBeNull();
    expect(netCharged(5000, null)).toBe(5000);
  });
});

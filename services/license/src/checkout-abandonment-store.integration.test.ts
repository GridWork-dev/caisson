// checkout_abandonment / checkout_abandonment_notice on PGlite + real withTenant RLS (ADR-0005),
// mirroring entitlement-store.integration.test.ts's `sweepUpdatesWindowExpiryNotices` suite shape.
// Asserts the three suppression contracts SPEC-abandoned-checkout-email.md §(b)/(c) name:
// converted-since-started (order_record), the 30-day cross-row notice guard, and marker-row
// idempotency (ON CONFLICT DO NOTHING) — plus RLS isolation for the write path.
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
import { type TestPg, newTestPg } from "@caisson/testing";
import {
  ADMIN_WRITE_ROLE_BOOTSTRAP_SQL,
  buildAdminSelectPolicySql,
} from "@caisson/org-controls";
import { type Transactor, withTenant } from "@caisson/tenancy-rls";
import {
  CHECKOUT_ABANDONMENT_NOTICE_SCHEMA_SQL,
  CHECKOUT_ABANDONMENT_SCHEMA_SQL,
  hasRecentAbandonedCheckoutNotice,
  listAbandonedCheckoutAccountIds,
  recordCheckoutAbandonment,
  sweepEligibleAbandonedCheckout,
} from "./checkout-abandonment-store.ts";
import { ORDER_RECORD_SCHEMA_SQL } from "./subscription-history-store.ts";

let tp: TestPg;
let db: Transactor;

const DELAY_HOURS = 24;

beforeAll(async () => {
  tp = await newTestPg();
  db = tp.pg as unknown as Transactor;
  await tp.exec(ADMIN_WRITE_ROLE_BOOTSTRAP_SQL);
  await tp.exec(CHECKOUT_ABANDONMENT_SCHEMA_SQL);
  await tp.exec(CHECKOUT_ABANDONMENT_NOTICE_SCHEMA_SQL);
  await tp.exec(ORDER_RECORD_SCHEMA_SQL);
  await tp.exec(buildAdminSelectPolicySql("checkout_abandonment"));
});

afterAll(async () => {
  await tp.close();
});

/** Backdate a checkout_abandonment row's started_at (bypasses the store's `now()` default so a
 *  test can control exactly how far past the delay window a row sits). */
async function backdate(id: string, hoursAgo: number): Promise<void> {
  await tp.exec(
    `UPDATE checkout_abandonment SET started_at = now() - interval '${String(hoursAgo)} hours' WHERE id = '${id}'`,
  );
}

describe("recordCheckoutAbandonment / listAbandonedCheckoutAccountIds (RLS)", () => {
  test("a row is written tenant-scoped and RLS-isolated from another account", async () => {
    await withTenant(db, "acct_rls_a", (tx) =>
      recordCheckoutAbandonment(tx, {
        id: "ca_rls_a",
        accountId: "acct_rls_a",
        items: [{ id: "compliance", label: "Compliance bundle" }],
      }),
    );

    // A different tenant's scoped read must see nothing — fail-closed RLS, not an app-level filter
    // (this query carries NO WHERE account_id clause at all; RLS is the only thing narrowing it).
    const crossTenant = await withTenant(db, "acct_rls_b", (tx) =>
      tx.query<{ id: string }>("SELECT id FROM checkout_abandonment"),
    );
    expect(crossTenant.rows).toEqual([]);

    const ownTenant = await withTenant(db, "acct_rls_a", (tx) =>
      tx.query<{ id: string }>("SELECT id FROM checkout_abandonment"),
    );
    expect(ownTenant.rows.map((r) => r.id)).toEqual(["ca_rls_a"]);
  });

  test("only accounts with a row past the delay window are enumerated, distinct + sorted", async () => {
    await withTenant(db, "acct_list_b", (tx) =>
      recordCheckoutAbandonment(tx, {
        id: "ca_list_b",
        accountId: "acct_list_b",
        items: [{ id: "x", label: "X" }],
      }),
    );
    await withTenant(db, "acct_list_a", (tx) =>
      recordCheckoutAbandonment(tx, {
        id: "ca_list_a_1",
        accountId: "acct_list_a",
        items: [{ id: "x", label: "X" }],
      }),
    );
    // A second row for the SAME account must not duplicate it in the list.
    await withTenant(db, "acct_list_a", (tx) =>
      recordCheckoutAbandonment(tx, {
        id: "ca_list_a_2",
        accountId: "acct_list_a",
        items: [{ id: "y", label: "Y" }],
      }),
    );
    // Too recent — must NOT be enumerated.
    await withTenant(db, "acct_list_too_recent", (tx) =>
      recordCheckoutAbandonment(tx, {
        id: "ca_list_recent",
        accountId: "acct_list_too_recent",
        items: [{ id: "x", label: "X" }],
      }),
    );
    await backdate("ca_list_b", DELAY_HOURS + 1);
    await backdate("ca_list_a_1", DELAY_HOURS + 1);
    await backdate("ca_list_a_2", DELAY_HOURS + 2);
    // ca_list_recent stays at now() — inside the window.

    const ids = await listAbandonedCheckoutAccountIds(db, DELAY_HOURS);
    expect(ids).toEqual(["acct_list_a", "acct_list_b"]);
  });
});

describe("sweepEligibleAbandonedCheckout (marker idempotency, 30-day guard, converted-since skip)", () => {
  test("an eligible row is returned and marked; a replayed sweep sends nothing (idempotency)", async () => {
    const acct = "acct_sweep_due";
    await withTenant(db, acct, (tx) =>
      recordCheckoutAbandonment(tx, {
        id: "ca_sweep_due",
        accountId: acct,
        items: [{ id: "compliance", label: "Compliance bundle" }],
      }),
    );
    await backdate("ca_sweep_due", DELAY_HOURS + 1);

    const first = await withTenant(db, acct, (tx) =>
      sweepEligibleAbandonedCheckout(tx, acct, DELAY_HOURS),
    );
    expect(first).not.toBeNull();
    expect(first?.lines).toEqual([
      { id: "compliance", label: "Compliance bundle" },
    ]);

    // Replayed sweep — the marker already exists (this exact row), so nothing is returned again.
    const replay = await withTenant(db, acct, (tx) =>
      sweepEligibleAbandonedCheckout(tx, acct, DELAY_HOURS),
    );
    expect(replay).toBeNull();
  });

  test("a row too recent (inside the delay window) is not eligible", async () => {
    const acct = "acct_sweep_recent";
    await withTenant(db, acct, (tx) =>
      recordCheckoutAbandonment(tx, {
        id: "ca_sweep_recent",
        accountId: acct,
        items: [{ id: "x", label: "X" }],
      }),
    );
    // No backdate — started_at stays at now(), inside the 24h window.

    const result = await withTenant(db, acct, (tx) =>
      sweepEligibleAbandonedCheckout(tx, acct, DELAY_HOURS),
    );
    expect(result).toBeNull();
  });

  test("a converted account (order_record landed after started_at) is skipped permanently", async () => {
    const acct = "acct_sweep_converted";
    await withTenant(db, acct, (tx) =>
      recordCheckoutAbandonment(tx, {
        id: "ca_sweep_converted",
        accountId: acct,
        items: [{ id: "x", label: "X" }],
      }),
    );
    await backdate("ca_sweep_converted", DELAY_HOURS + 1);
    // A granting order_record row for this account, created AFTER started_at — the "a purchase
    // landed" signal (G26), same one apply-billing-event's grant path writes.
    await tp.exec(
      `INSERT INTO order_record (id, account_id, source_event_id, kind, price_id, label, amount, currency)
       VALUES ('ord_conv_1', '${acct}', 'evt_conv_1', 'purchase', 'pri_x', 'Compliance', 79900, 'usd')`,
    );

    const result = await withTenant(db, acct, (tx) =>
      sweepEligibleAbandonedCheckout(tx, acct, DELAY_HOURS),
    );
    expect(result).toBeNull();
  });

  test("a second abandoned cart within 30 days of a sent notice is suppressed (one nudge per rolling month)", async () => {
    const acct = "acct_sweep_30d";
    await withTenant(db, acct, (tx) =>
      recordCheckoutAbandonment(tx, {
        id: "ca_sweep_30d_first",
        accountId: acct,
        items: [{ id: "x", label: "X" }],
      }),
    );
    await backdate("ca_sweep_30d_first", DELAY_HOURS + 1);
    const first = await withTenant(db, acct, (tx) =>
      sweepEligibleAbandonedCheckout(tx, acct, DELAY_HOURS),
    );
    expect(first).not.toBeNull();

    // A SECOND, DIFFERENT abandoned-cart row for the SAME account, also past the delay window —
    // still suppressed because a notice already fired for this account within 30 days.
    await withTenant(db, acct, (tx) =>
      recordCheckoutAbandonment(tx, {
        id: "ca_sweep_30d_second",
        accountId: acct,
        items: [{ id: "y", label: "Y" }],
      }),
    );
    await backdate("ca_sweep_30d_second", DELAY_HOURS + 1);
    const second = await withTenant(db, acct, (tx) =>
      sweepEligibleAbandonedCheckout(tx, acct, DELAY_HOURS),
    );
    expect(second).toBeNull();
  });

  test("a new cart after the 30-day window IS nudged (the rolling-month guard decides, not the old marked row)", async () => {
    const acct = "acct_sweep_after_30d";
    await withTenant(db, acct, (tx) =>
      recordCheckoutAbandonment(tx, {
        id: "ca_after_30d_first",
        accountId: acct,
        items: [{ id: "x", label: "X" }],
      }),
    );
    await backdate("ca_after_30d_first", DELAY_HOURS + 1);
    const first = await withTenant(db, acct, (tx) =>
      sweepEligibleAbandonedCheckout(tx, acct, DELAY_HOURS),
    );
    expect(first).not.toBeNull();

    // Age the sent notice past the rolling-month guard; a NEW cart, past the delay window, must
    // then be nudged — the due query has to advance past the already-marked older row instead of
    // returning it forever (which would conflict on the marker and suppress every future nudge).
    await tp.exec(
      `UPDATE checkout_abandonment_notice SET created_at = now() - interval '31 days' WHERE id = 'ca_after_30d_first'`,
    );
    await withTenant(db, acct, (tx) =>
      recordCheckoutAbandonment(tx, {
        id: "ca_after_30d_second",
        accountId: acct,
        items: [{ id: "y", label: "Y" }],
      }),
    );
    await backdate("ca_after_30d_second", DELAY_HOURS + 1);

    const second = await withTenant(db, acct, (tx) =>
      sweepEligibleAbandonedCheckout(tx, acct, DELAY_HOURS),
    );
    expect(second).not.toBeNull();
    expect(second?.lines[0]?.label).toBe("Y");
  });
});

describe("hasRecentAbandonedCheckoutNotice (posthog abandoned_checkout_converted precondition)", () => {
  test("true within the lookback window, false outside it and when absent", async () => {
    const acct = "acct_recent_notice";
    expect(
      await withTenant(db, acct, (tx) =>
        hasRecentAbandonedCheckoutNotice(tx, acct),
      ),
    ).toBe(false);

    await withTenant(db, acct, (tx) =>
      recordCheckoutAbandonment(tx, {
        id: "ca_recent_notice",
        accountId: acct,
        items: [{ id: "x", label: "X" }],
      }),
    );
    await backdate("ca_recent_notice", DELAY_HOURS + 1);
    await withTenant(db, acct, (tx) =>
      sweepEligibleAbandonedCheckout(tx, acct, DELAY_HOURS),
    );

    expect(
      await withTenant(db, acct, (tx) =>
        hasRecentAbandonedCheckoutNotice(tx, acct, 14),
      ),
    ).toBe(true);
    // Outside a 0-day window — always false regardless of when the notice landed.
    expect(
      await withTenant(db, acct, (tx) =>
        hasRecentAbandonedCheckoutNotice(tx, acct, 0),
      ),
    ).toBe(false);
  });
});
